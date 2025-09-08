// backend/src/services/bridgeService.js
import db from '../config/db.js';
import { normalizePhoneNumber } from '../utils/phoneHelper.js';

class BridgeService {
  /**
   * Finds the best active bridge for a new donor to join based on city and blood group.
   * "Best" is defined as the bridge with the fewest members, to ensure balance.
   */
  async findBestBridgeForDonor(city, bloodGroup) {
    const query = `
      SELECT bb.id, bb.name FROM blood_bridges bb
      LEFT JOIN bridge_members bm ON bb.id = bm.bridge_id
      WHERE bb.city ILIKE $1 AND bb.blood_group = $2 AND bb.active = true
      GROUP BY bb.id, bb.name
      HAVING COUNT(bm.id) < 10 -- Only consider bridges that are not full
      ORDER BY COUNT(bm.id) ASC, bb.created_at ASC -- Prioritize the least full, oldest bridge
      LIMIT 1;
    `;
    const { rows: [bestBridge] } = await db.query(query, [`%${city}%`, bloodGroup]);
    return bestBridge;
  }

  /**
   * Adds a donor to the best available bridge.
   * @param {string} donorId - The UUID of the donor to add.
   */
  async addDonorToBridge(donorId) {
    try {
      const { rows: [donor] } = await db.query('SELECT city, blood_group FROM users WHERE id = $1', [donorId]);
      if (!donor) throw new Error('Donor not found.');
      
      const bridge = await this.findBestBridgeForDonor(donor.city, donor.blood_group);
      if (!bridge) {
        console.log(`No active bridge with available space found for ${donor.city}/${donor.blood_group}.`);
        return { success: true, status: 'no_bridge_found' };
      }

      await db.query(
        "INSERT INTO bridge_members(bridge_id, donor_id, position) VALUES($1, $2, (SELECT COALESCE(MAX(position), 0) + 1 FROM bridge_members WHERE bridge_id = $1)) ON CONFLICT DO NOTHING",
        [bridge.id, donorId]
      );

      console.log(`Successfully added donor ${donorId} to bridge: ${bridge.name} (${bridge.id}).`);
      return { success: true, status: 'added_to_bridge' };
    } catch (error) {
      console.error('Error adding donor to bridge:', error);
      return { success: false, error };
    }
  }

  /**
   * Handles a request from a donor to join a bridge via their phone number.
   */
  async addDonorToBridgeByPhone(donorPhone) {
    const sanitizedPhone = normalizePhoneNumber(donorPhone);
    try {
      const { rows: [donor] } = await db.query('SELECT id, name, city, blood_group FROM users WHERE phone = $1', [sanitizedPhone]);
      if (!donor) {
        return "It looks like you're not registered yet. Please register first!";
      }
     
      const { rows: [existingMember] } = await db.query('SELECT id FROM bridge_members WHERE donor_id = $1', [donor.id]);
      if (existingMember) {
        return `Thank you, ${donor.name}! You are already a valued member of a Blood Bridge.`;
      }
      const bridge = await this.findBestBridgeForDonor(donor.city, donor.blood_group);
      if (!bridge) {
        return `Thank you for your interest, ${donor.name}! We don't have a Blood Bridge matching your profile right now, but we'll notify you when one becomes available.`;
      }
      await db.query(
        "INSERT INTO bridge_members(bridge_id, donor_id, position) VALUES($1, $2, (SELECT COALESCE(MAX(position), 0) + 1 FROM bridge_members WHERE bridge_id = $1)) ON CONFLICT DO NOTHING",
        [bridge.id, donor.id]
      );
     
      return `Welcome to ${bridge.name}! You are now part of a dedicated life-saving team. ❤️`;
    } catch (error) {
      console.error('Error adding donor to bridge by phone:', error);
      return 'Sorry, we encountered an error. Please try again later.';
    }
  }

  /**
   * Populates a newly created bridge with the best-matched donors from the general pool.
   */
  async populateNewBridge(bridgeId, city, bloodGroup, pincode) {
    try {
      console.log(`Populating bridge ${bridgeId} for city: ${city}, blood group: ${bloodGroup}, pincode: ${pincode}`);
      const { rows: bestDonors } = await db.query(
        'SELECT donor_id, final_score FROM find_donors_for_bridge($1, $2, $3, $4)',
        [city, bloodGroup, pincode, 8]
      );
      
      if (!bestDonors || bestDonors.length === 0) {
        console.warn(`No donors found for bridge ${bridgeId}`);
        return { success: true, count: 0 };
      }

      const insertQueries = bestDonors.map((donor, index) =>
        db.query(
          'INSERT INTO bridge_members(bridge_id, donor_id, position) VALUES($1, $2, $3)',
          [bridgeId, donor.donor_id, index + 1]
        )
      );

      await Promise.all(insertQueries);
      console.log(`Successfully populated bridge ${bridgeId} with ${bestDonors.length} donors`);
      return { success: true, count: bestDonors.length };
    } catch (error) {
      console.error(`Error populating bridge ${bridgeId}:`, {
        error: error.message, city, bloodGroup, pincode,
      });
      throw new Error(`Failed to populate bridge: ${error.message}`);
    }
  }
}

export default new BridgeService(); 