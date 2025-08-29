import db from '../config/db.js';

class BridgeService {
  async populateNewBridge(bridgeId, city, bloodGroup, pincode) {
    try {
      console.log(`Populating bridge ${bridgeId} for city: ${city}, blood group: ${bloodGroup}, pincode: ${pincode}`);
      const { rows: bestDonors } = await db.query(
        'SELECT donor_id, final_score FROM find_donors_for_bridge($1, $2, $3, $4)',
        [city, bloodGroup, pincode, 5]
      );
      if (!bestDonors || bestDonors.length === 0) {
        console.warn(`No donors found for bridge ${bridgeId} with city: ${city}, blood group: ${bloodGroup}, pincode: ${pincode}`);
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
        error: error.message,
        city,
        bloodGroup,
        pincode,
      });
      throw new Error(`Failed to populate bridge: ${error.message}`);
    }
  }
}

export default new BridgeService();