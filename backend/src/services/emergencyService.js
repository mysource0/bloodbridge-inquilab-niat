// backend/src/services/emergencyService.js
import db from '../config/db.js';
import whatsappService from './whatsappService.js';
import aiRouterService from './aiRouterService.js';
import mlService from './mlService.js';
import geocodingService from './geocodingService.js';
import { getDistanceInKm } from '../utils/distanceHelper.js';
import { normalizeBloodGroup } from '../utils/dataSanitizer.js';
import { normalizePhoneNumber } from '../utils/phoneHelper.js';

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const activeTimeouts = new Map();

class EmergencyService {
  async handleEmergencyRequest(userMessage, requesterPhone) {
    const sanitizedPhone = normalizePhoneNumber(requesterPhone);
    try {
      const route = await aiRouterService.routeMessageWithContext(userMessage, 'Unregistered');
      if (route && route.tool === 'handle_emergency_request' && route.params.blood_group && route.params.city) {
        console.log("AI successfully extracted details:", route.params);
        await this.createEmergencyRequest(route.params, sanitizedPhone);
      } else {
        console.log('AI could not extract necessary details. Prompting user.');
        const followupMessage = "I understand this is an emergency. To find a donor, please provide the patient's blood group (e.g., A+, O-) and the city where the hospital is located.";
        await whatsappService.sendTextMessage(sanitizedPhone, followupMessage);
      }
    } catch (error) {
      console.error('CRITICAL ERROR in handleEmergencyRequest:', error);
      await whatsappService.sendTextMessage(requesterPhone, 'We could not process your request due to a system error.');
    }
  }  

  async createEmergencyRequest(params, requesterPhone) {
    const { 
      patient_name = 'Unknown', 
      blood_group, 
      city, 
      hospital_name = 'Unknown', 
      units_needed = 1
    } = params;
    try {
      const normalizedBG = normalizeBloodGroup(blood_group);
      if (!VALID_BLOOD_GROUPS.includes(normalizedBG)) {
        const validationErrorMessage = `Sorry, "${blood_group}" is not a recognized blood group. Please use a valid one (e.g., O+, AB-).`;
        await whatsappService.sendTextMessage(requesterPhone, validationErrorMessage);
        return;
      }
      
      const coords = await geocodingService.getCoords(hospital_name, city, null).catch(err => {
        console.error("Geocoding service failed, but continuing without coordinates.", err);
        return null;
      });

      const shortCode = Math.floor(1000 + Math.random() * 9000).toString();

      const { rows: [request] } = await db.query(
        `INSERT INTO emergency_requests (patient_name, blood_group, city, hospital_name, requested_by_phone, short_code, latitude, longitude, units_needed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;`,
        [patient_name, normalizedBG, city, hospital_name, requesterPhone, shortCode, coords?.latitude, coords?.longitude, units_needed]
      );
      
      console.log(`Successfully created emergency request ID: ${request.id}`);
      await whatsappService.sendTextMessage(requesterPhone, `✅ Emergency request active! We are now running a hyperlocal search for *${patient_name}*.`);
      
      await this.findAndNotifyDonors(request);
    } catch (error) {
      console.error('CRITICAL ERROR creating emergency request in database:', error);
      await whatsappService.sendTextMessage(requesterPhone, 'We could not process your request due to a system error.');
    }
  }
  
  async findAndNotifyDonors(request) {
    const TIMEOUT_IN_MINUTES = 2;
    const { id: requestId, requested_by_phone } = request;
    
    try {
      // 1. Find all donors who have already been contacted for this request.
      const { rows: notifiedDonors } = await db.query(
        'SELECT donor_id FROM donor_responses WHERE request_id = $1',
        [requestId]
      );
      const excludedDonorIds = notifiedDonors.map(d => d.donor_id);

      // 2. Find the next best available donors.
      let topScoredDonors = await this.findAndRankGeneralDonors(request.blood_group, request.city, excludedDonorIds);

      // 3. Handle the case where no donors are left.
      if (topScoredDonors.length === 0) {
        console.warn(`Search complete for request ${requestId}: No new donors found.`);
        const alertMessage = `⚠️ We have contacted all available donors in our network for *${request.patient_name}*. This request has been flagged for admin review.`;
        await whatsappService.sendTextMessage(requested_by_phone, alertMessage);
        await db.query("INSERT INTO inbox_messages (user_phone, user_message, reason) VALUES ($1, $2, $3)", [requested_by_phone, `Donor search exhausted for patient ${request.patient_name}`, 'Donor Search Exhausted']);
        return;
      }

      // 4. Select only the single best donor from the list.
      const bestDonor = topScoredDonors[0];
      
      const notificationMessage = 
          `🚨 URGENT: A patient needs your help!\n\n` +
          `Patient: *${request.patient_name}*\n` +
          `Blood Group: *${request.blood_group}*\n` +
          `Location: ${request.hospital_name}, ${request.city}\n\n` +
          `To confirm you can donate, please reply with: *YES ${request.short_code}*\n\n` +
          `If you are unable to help, please reply "NO" so we can find another hero quickly.`;
        
      // 5. Log the attempt and send the message to the single best donor.
      await db.query(`INSERT INTO donor_responses (donor_id, request_id, response) VALUES ($1, $2, 'pending') ON CONFLICT (donor_id, request_id) DO UPDATE SET response = 'pending'`, [bestDonor.id, requestId]);
      await db.query('UPDATE users SET notifications_received = notifications_received + 1 WHERE id = $1', [bestDonor.id]);
      await whatsappService.sendTextMessage(bestDonor.phone, notificationMessage);
      
      // 6. Inform the requester and set the automatic escalation timeout.
      const adminMessage = `✅ Search ongoing... Notifying the best match: *${bestDonor.name}*. If they don't respond in ${TIMEOUT_IN_MINUTES} minutes, we will contact the next donor.`;
      await whatsappService.sendTextMessage(requested_by_phone, adminMessage);

      const timeoutId = setTimeout(() => {
        console.log(`[TIMEOUT] Donor ${bestDonor.name} did not respond for request ${requestId}. Escalating...`);
        this.findNextDonorForRequest(requestId);
      }, TIMEOUT_IN_MINUTES * 60 * 1000);

      activeTimeouts.set(requestId.toString(), timeoutId);

    } catch (error) {
      console.error(`CRITICAL ERROR in findAndNotifyDonors for request ${requestId}:`, error);
      await whatsappService.sendTextMessage(requested_by_phone, 'We encountered a system error while searching for donors. Our team has been notified.');
    }
  }

  async findNextDonorForRequest(requestId) {
    console.log(`[ESCALATION] Finding next donor batch for request ${requestId}`);
    this.clearEmergencyTimeout(requestId);
    const { rows: [requestInfo] } = await db.query(`SELECT * FROM emergency_requests WHERE id = $1`, [requestId]);
    
    if (requestInfo && requestInfo.status === 'active') {
      await this.findAndNotifyDonors(requestInfo);
    } else {
      console.warn(`[ESCALATION] Not proceeding for request ${requestId}, status is '${requestInfo ? requestInfo.status : 'NOT FOUND'}'`);
    }
  }

  async escalateRequest(requestId) {
    const BATCH_SIZE = 10;
    try {
      const { rows: [request] } = await db.query(
          'SELECT * FROM emergency_requests WHERE id = $1 AND status = \'active\'',
          [requestId]
      );
      if (!request) {
          throw new Error('Active emergency request not found.');
      }

      const { rows: notifiedDonors } = await db.query(
          'SELECT donor_id FROM donor_responses WHERE request_id = $1',
          [requestId]
      );
      const excludedDonorIds = notifiedDonors.map(d => d.donor_id);
      console.log(`Escalating request ${requestId}. Excluding ${excludedDonorIds.length} already-notified donor(s).`);
      
      const nextDonors = await this.findAndRankGeneralDonors(
          request.blood_group,
          request.city,
          excludedDonorIds
      );
      if (nextDonors.length === 0) {
          throw new Error('No additional available donors found in the network for this request.');
      }

      const batchToNotify = nextDonors.slice(0, BATCH_SIZE);
      const notificationPromises = batchToNotify.map(async (donor) => {
          try {
              const notificationMessage = `🚨 URGENT (Escalated): You are a top match for an emergency!\n\nPatient *${request.patient_name}* needs your help (${request.blood_group}).\n\nReply *YES ${request.short_code}* to help.`;
              
              await db.query(`INSERT INTO donor_responses (donor_id, request_id, response) VALUES ($1, $2, 'pending') ON CONFLICT (donor_id, request_id) DO NOTHING;`, [donor.id, requestId]);
              const result = await whatsappService.sendTextMessage(donor.phone, notificationMessage);
              
              if(result.success) {
                  await db.query('UPDATE users SET notifications_received = notifications_received + 1 WHERE id = $1', [donor.id]);
              }
          } catch (err) {
              console.error(`Failed to notify donor ${donor.id} for request ${requestId}:`, err.message);
          }
      });

      await Promise.all(notificationPromises);
      const adminMessage = `✅ Escalation successful. Notified a batch of ${batchToNotify.length} new top-ranked donors.`;
      await whatsappService.sendTextMessage(request.requested_by_phone, adminMessage);
      
      return { success: true, message: `Successfully escalated request and notified ${batchToNotify.length} new donors.` };
    } catch (error) {
      console.error(`CRITICAL ERROR during escalation for request ${requestId}:`, error);
      throw error;
    }
  }
  
  clearEmergencyTimeout(requestId) {
    if (activeTimeouts.has(requestId.toString())) {
      clearTimeout(activeTimeouts.get(requestId.toString()));
      activeTimeouts.delete(requestId.toString());
      console.log(`[TIMEOUT CLEARED] Timeout for request ${requestId} has been stopped.`);
    }
  }

  async findAndRankGeneralDonors(bloodGroup, city, excludedDonorIds = []) {
    const { rows: availableDonors } = await db.query(
      `SELECT id, name, phone, last_donation, notifications_received, donations_confirmed, streak_count, latitude, longitude
       FROM users
       WHERE user_type = 'donor' AND blood_group = $1 AND city ILIKE $2
         AND availability_status = 'available' AND dnd_status = false
         AND (snooze_until IS NULL OR snooze_until < NOW())
         AND id NOT IN (SELECT unnest($3::uuid[]))
       LIMIT 50;`,
      [normalizeBloodGroup(bloodGroup), city, excludedDonorIds]
    );
    if (!availableDonors || availableDonors.length === 0) return [];
    
    const scoringPromises = availableDonors.map(donor => mlService.scoreSingleDonor(donor));
    const results = await Promise.allSettled(scoringPromises);
    
    const scoredDonors = availableDonors.map((donor, index) => {
        const score = results[index].status === 'fulfilled' ? results[index].value.final_score : 0;
        return { ...donor, final_score: score };
    });
    
    scoredDonors.sort((a, b) => b.final_score - a.final_score);
    return scoredDonors;
  }
}

export default new EmergencyService();