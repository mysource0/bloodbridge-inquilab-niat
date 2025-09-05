// backend/src/services/responseService.js
import db from '../config/db.js';
import whatsappService from './whatsappService.js';
import { generateOTP } from '../utils/otpHelper.js';
import gamificationService from './gamificationService.js';
import bridgeService from './bridgeService.js';
import BridgeCoordinationService from './bridgeCoordinationService.js';

class ResponseService {
    /**
     * Handles the donor's initial reply (e.g., "YES 1234").
     * It validates the code and sends back a 6-digit OTP to verify.
     */
    async handleDonorReplyWithShortCode(donorPhone, shortCode) {
        try {
            const { rows: [request] } = await db.query(`SELECT id FROM emergency_requests WHERE short_code = $1 AND status = 'active'`, [shortCode]);
            if (!request) {
                await whatsappService.sendTextMessage(donorPhone, `Sorry, we couldn't find an active request with code ${shortCode}. It may have been fulfilled.`);
                return;
            }

            const { rows: [user] } = await db.query(`SELECT id FROM users WHERE phone = $1`, [donorPhone]);
            if (!user) {
                await whatsappService.sendTextMessage(donorPhone, "We couldn't find your registration. Please register first.");
                return;
            }

            const otp = generateOTP();
            await db.query(
                `INSERT INTO donor_responses (donor_id, request_id, response, otp, otp_expires_at)
                 VALUES ($1, $2, 'pending', $3, NOW() + INTERVAL '10 minutes')
                 ON CONFLICT (donor_id, request_id) DO UPDATE SET response = 'pending', otp = $3, otp_expires_at = NOW() + INTERVAL '10 minutes';`,
                [user.id, request.id, otp]
            );

            const otpMessage = `Thank you for your quick response! To finalize your confirmation, please reply with *only* the following 6-digit code:\n\n*${otp}*`;
            await whatsappService.sendTextMessage(donorPhone, otpMessage);
        } catch (error) {
            console.error('Error in handleDonorReplyWithShortCode:', error);
            await whatsappService.sendTextMessage(donorPhone, "There was a system error processing your reply.");
        }
    }

    /**
     * Verifies the 6-digit OTP and finalizes the donation confirmation.
     * This function uses a database transaction to ensure all updates succeed or none do.
     */

      async handleSimpleDecline(donorPhone) {
    try {
      const { rows: [user] } = await db.query('SELECT id FROM users WHERE phone = $1', [donorPhone]);
      if (!user) return; // User not registered, do nothing.

      // Find the last active request this donor was notified for.
      const { rows: [lastRequest] } = await db.query(
        `SELECT r.id FROM emergency_requests r 
         JOIN donor_responses dr ON r.id = dr.request_id
         WHERE dr.donor_id = $1 AND r.status = 'active' AND dr.response = 'pending'
         ORDER BY dr.created_at DESC LIMIT 1;`,
        [user.id]
      );
      
      if (lastRequest) {
        // Mark their response as 'declined'.
        await db.query(
          "UPDATE donor_responses SET response = 'declined' WHERE donor_id = $1 AND request_id = $2",
          [user.id, lastRequest.id]
        );
        
        await whatsappService.sendTextMessage(donorPhone, "Thank you for letting us know. We will contact the next available donor immediately.");
        
        // Immediately trigger the escalation to the next batch.
        emergencyService.findNextDonorForRequest(lastRequest.id);
      } else {
        await whatsappService.sendTextMessage(donorPhone, "Thank you for your response. There are no active requests pending for you at this moment.");
      }
    } catch (error) {
      console.error("Error handling simple decline:", error);
    }
  }
    // In responseService.js
async verifyOTPAndConfirm(donorPhone, otp) {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: [response] } = await client.query(
            // Add request_type and bridge_id to the SELECT statement
            `SELECT dr.id, dr.request_id, u.name as donor_name, u.id as donor_id, 
                    er.patient_name, er.requested_by_phone, er.request_type, er.bridge_id
             FROM donor_responses dr JOIN users u ON dr.donor_id = u.id JOIN emergency_requests er ON dr.request_id = er.id
             WHERE u.phone = $1 AND dr.otp = $2 AND dr.otp_expires_at > NOW() AND dr.response = 'pending' FOR UPDATE;`,
            [donorPhone, otp]
        );

        if (!response) {
            await whatsappService.sendTextMessage(donorPhone, "Invalid or expired OTP. Please try the 'YES [code]' step again.");
            await client.query('ROLLBACK');
            return;
        }

        // Perform all database updates
        await client.query(`UPDATE users SET last_donation = NOW(), availability_status = 'unavailable', cooldown_until = NOW() + INTERVAL '90 days', donations_confirmed = donations_confirmed + 1, streak_count = streak_count + 1 WHERE id = $1`, [response.donor_id]);
        await client.query("UPDATE donor_responses SET response = 'accepted', confirmed_at = NOW(), otp = NULL WHERE id = $1", [response.id]);
        await client.query("UPDATE emergency_requests SET status = 'fulfilled' WHERE id = $1", [response.request_id]);
        
        // --- NEW LOGIC: ROTATE THE BRIDGE IF APPLICABLE ---
        // We pass the active transaction client to the rotation function
        if (response.request_type === 'bridge' && response.bridge_id) {
            await bridgeCoordinationService.rotateBridge(response.bridge_id, client);
        }
        // --- END NEW LOGIC ---

        await client.query('COMMIT');

        // Send confirmations and award points
        const donorConfirmationMessage = `✅ Confirmed! Thank you, ${response.donor_name}!\n\nYour donation for *${response.patient_name}* is confirmed. Please coordinate with the hospital. You are a true hero!`;
        await whatsappService.sendTextMessage(donorPhone, donorConfirmationMessage);

        if (response.requested_by_phone && response.requested_by_phone !== 'system') {
            const requesterUpdate = `✅ Good News! A donor has been confirmed for your request for *${response.patient_name}*.`;
            await whatsappService.sendTextMessage(response.requested_by_phone, requesterUpdate);
        }
        gamificationService.awardPoints(response.donor_id, 'EMERGENCY_RESPONSE', donorPhone);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error verifying OTP:", error);
        await whatsappService.sendTextMessage(donorPhone, "A system error occurred during OTP verification.");
    } finally {
        client.release();
    }
}
}

export default new ResponseService();