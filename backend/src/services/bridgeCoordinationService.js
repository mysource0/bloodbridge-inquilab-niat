// backend/src/services/bridgeCoordinationService.js
import db from '../config/db.js';
import whatsappService from './whatsappService.js';
import { generateShortCode } from '../utils/otpHelper.js';

class BridgeCoordinationService {
  async requestTransfusion(bridgeId) {
    const { rows: [bridge] } = await db.query(
      `SELECT bb.*, p.name as patient_name
       FROM blood_bridges bb
       JOIN patients p ON bb.patient_id = p.id
       WHERE bb.id = $1`,
      [bridgeId]
    );
    if (!bridge) throw new Error(`Blood Bridge with ID ${bridgeId} not found.`);

    // --- NEW LOGIC: PREVENT DUPLICATE REQUESTS ---
    if (bridge.active_request_id) {
      throw new Error(`Request failed: Patient ${bridge.patient_name} already has an active bridge request.`);
    }
    // --- END NEW LOGIC ---

    const { rows: members } = await db.query(
      // Find the next donor who is currently 'available'
      `SELECT u.id, u.name, u.phone
       FROM bridge_members bm
       JOIN users u ON bm.donor_id = u.id
       WHERE bm.bridge_id = $1 AND bm.status = 'active' AND u.availability_status = 'available'
       ORDER BY bm.position ASC`,
      [bridgeId]
    );

    if (members.length === 0) {
      // This is a "Bridge Failure" scenario. We need to escalate.
      // For now, we'll throw an error that the admin will see.
      // In Task 4 (Escalation), we will automate this.
      throw new Error(`No available donors found in the bridge for ${bridge.patient_name}. Please escalate to a general emergency.`);
    }

    const donorToNotify = members[0]; // The SQL query now only returns available donors in order

    const shortCode = generateShortCode();
    // Create the request and get its ID back
    const { rows: [newRequest] } = await db.query(
      `INSERT INTO emergency_requests (patient_name, blood_group, city, requested_by_phone, short_code, request_type, bridge_id, units_needed)
       VALUES ($1, $2, $3, 'system', $4, 'bridge', $5, 1) RETURNING id;`,
      [bridge.patient_name, bridge.blood_group, bridge.city, shortCode, bridge.id]
    );

    // --- NEW LOGIC: LINK THE ACTIVE REQUEST TO THE BRIDGE ---
    await db.query(
        'UPDATE public.blood_bridges SET active_request_id = $1 WHERE id = $2',
        [newRequest.id, bridgeId]
    );
    // --- END NEW LOGIC ---

    const message = `Hi ${donorToNotify.name}, it's your turn in the Blood Bridge for patient *${bridge.patient_name}*.\n\nYour help is needed for their scheduled transfusion. Please reply with *YES ${shortCode}* to confirm your availability.`;
    await whatsappService.sendTextMessage(donorToNotify.phone, message);

    return { success: true, message: `Successfully notified ${donorToNotify.name} for patient ${bridge.patient_name}.` };
  }
  
  async rotateBridge(bridgeId, client = db) {
    // This function now does two things: rotates the position AND clears the active request ID.
    const { rows: [bridge] } = await client.query('SELECT rotation_position FROM blood_bridges WHERE id = $1', [bridgeId]);
    const { rows: [{ count }] } = await client.query('SELECT COUNT(*) FROM bridge_members WHERE bridge_id = $1 AND status = \'active\'', [bridgeId]);

    if (!bridge || count === '0') {
      console.error(`Cannot rotate bridge ${bridgeId}: Bridge or members not found.`);
      return;
    }

    const totalMembers = parseInt(count, 10);
    // We use the current position to find the next one, ensuring rotation
    const currentPositionInList = (bridge.rotation_position - 1);
    const nextPosition = (currentPositionInList % totalMembers) + 1;

    // Update bridge: clear active request and set new rotation position
    await client.query(
      'UPDATE blood_bridges SET rotation_position = $1, active_request_id = NULL WHERE id = $2',
      [nextPosition, bridgeId]
    );
    console.log(`Blood Bridge ${bridgeId} rotated successfully to position ${nextPosition} and cleared active request.`);
  }  // In backend/src/services/bridgeCoordinationService.js, inside the class

  /**
   * Finds all bridged patients who are due for a transfusion and initiates the request.
   * This is designed to be run automatically by a scheduler.
   */
  async triggerAutomaticBridgeRequests() {
    console.log('CRON JOB: Checking for due bridge patients...');
    try {
      // 1. Find all patients who are bridged and due for a transfusion today or in the past.
      const { rows: duePatients } = await db.query(
        `SELECT p.id, p.name, bb.id as bridge_id
         FROM patients p
         JOIN blood_bridges bb ON p.id = bb.patient_id
         WHERE 
           p.status = 'bridged' AND 
           p.last_transfusion_date IS NOT NULL AND 
           p.frequency_in_days IS NOT NULL AND
           (p.last_transfusion_date + p.frequency_in_days * INTERVAL '1 day') <= NOW() AND
           bb.active_request_id IS NULL -- IMPORTANT: Only trigger if there isn't one already active
        `
      );

      if (duePatients.length === 0) {
        console.log('CRON JOB: No patients are due for an automatic bridge request today.');
        return;
      }

      console.log(`CRON JOB: Found ${duePatients.length} patient(s) due for transfusion. Initiating requests...`);

      // 2. Loop through each due patient and call the existing requestTransfusion function.
      for (const patient of duePatients) {
        console.log(`CRON JOB: Initiating request for patient ${patient.name} (Bridge ID: ${patient.bridge_id})`);
        try {
          // We reuse the same logic that the admin dashboard button uses.
          await this.requestTransfusion(patient.bridge_id);
        } catch (error) {
          console.error(`CRON JOB: Failed to initiate request for bridge ${patient.bridge_id}. Reason: ${error.message}`);
          // In a production system, you might send an alert to an admin here.
        }
      }
    } catch (error) {
      console.error("CRITICAL ERROR in cron job triggerAutomaticBridgeRequests:", error);
    }
  }

/**
 * Finds all bridged patients who are due for a transfusion and initiates the request.
 * This is designed to be run automatically by a scheduler.
 */
async triggerAutomaticBridgeRequests() {
  console.log('CRON JOB: Checking for due bridge patients...');
  try {
    // 1. Find all patients who are bridged and due for a transfusion today or in the past.
    const { rows: duePatients } = await db.query(
      `SELECT p.id, p.name, bb.id as bridge_id
       FROM patients p
       JOIN blood_bridges bb ON p.id = bb.patient_id
       WHERE 
         p.status = 'bridged' AND 
         p.last_transfusion_date IS NOT NULL AND 
         p.frequency_in_days IS NOT NULL AND
         (p.last_transfusion_date + p.frequency_in_days * INTERVAL '1 day') <= NOW() AND
         bb.active_request_id IS NULL -- IMPORTANT: Only trigger if there isn't one already active
      `
    );

    if (duePatients.length === 0) {
      console.log('CRON JOB: No patients are due for an automatic bridge request today.');
      return;
    }

    console.log(`CRON JOB: Found ${duePatients.length} patient(s) due for transfusion. Initiating requests...`);

    // 2. Loop through each due patient and call the existing requestTransfusion function.
    for (const patient of duePatients) {
      console.log(`CRON JOB: Initiating request for patient ${patient.name} (Bridge ID: ${patient.bridge_id})`);
      try {
        // We reuse the same logic that the admin dashboard button uses.
        await this.requestTransfusion(patient.bridge_id);
      } catch (error) {
        console.error(`CRON JOB: Failed to initiate request for bridge ${patient.bridge_id}. Reason: ${error.message}`);
        // In a production system, you might send an alert to an admin here.
      }
    }
  } catch (error) {
    console.error("CRITICAL ERROR in cron job triggerAutomaticBridgeRequests:", error);
  }
}
}

export default new BridgeCoordinationService();