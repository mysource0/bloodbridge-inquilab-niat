import db from '../config/db.js';

class BridgeService {
  // In backend/src/services/bridgeService.js
async populateNewBridge(bridgeId, city, bloodGroup, pincode) {
    try {
      console.log(`Populating bridge ${bridgeId} for city: ${city}, blood group: ${bloodGroup}, pincode: ${pincode}`);
      
      // --- THE FIX IS HERE ---
      // The SQL function `find_donors_for_bridge` returns two columns: `donor_id` and `final_score`.
      // We must select exactly those columns.
      const { rows: bestDonors } = await db.query(
        'SELECT donor_id, final_score FROM find_donors_for_bridge($1, $2, $3, $4)',
        [city, bloodGroup, pincode, 8] // We are populating with the top 8 donors
      );
      // --- END OF FIX ---

      if (!bestDonors || bestDonors.length === 0) {
        console.warn(`No donors found for bridge ${bridgeId}`);
        return { success: true, count: 0 };
      }

      // Use the donor_id from the function's result to insert into bridge_members
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