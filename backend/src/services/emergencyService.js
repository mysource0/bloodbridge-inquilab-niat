// backend/src/services/emergencyService.js
import db from '../config/db.js';
import whatsappService from './whatsappService.js';
import aiRouterService from './aiRouterService.js';
import mlService from './mlService.js';
import geocodingService from './geocodingService.js';
import { getDistanceInKm } from '../utils/distanceHelper.js';
import { normalizeBloodGroup } from '../utils/dataSanitizer.js';
import { normalizePhoneNumber } from '../utils/phoneHelper.js';

class EmergencyService {
  async handleEmergencyRequest(userMessage, requesterPhone) {
    let params = {};
    const sanitizedPhone = normalizePhoneNumber(requesterPhone);

    const bloodGroupRegex = /\b([ABO]{1,2}\s*[\+-])\b/i;
    const cityRegex = /\b(hyderabad|mumbai|delhi|bangalore|chennai)\b/i;

    const bloodGroupMatch = userMessage.match(bloodGroupRegex);
    const cityMatch = userMessage.match(cityRegex);

    if (bloodGroupMatch && cityMatch) {
      console.log("Regex successfully extracted critical details.");
      params.blood_group = normalizeBloodGroup(bloodGroupMatch[0]);
      params.city = cityMatch[0].charAt(0).toUpperCase() + cityMatch[0].slice(1);
    } else {
      console.log("Regex failed. Engaging AI for detail extraction...");
      const route = await aiRouterService.routeMessageWithContext(userMessage, 'Unregistered');
      if (route && route.tool === 'handle_emergency_request' && route.params.blood_group && route.params.city) {
        console.log("AI successfully extracted details.");
        params = route.params;
      } else {
        console.log('AI also failed. Prompting user and setting conversation state.');
        await db.query(`
          UPDATE users SET conversation_state = 'awaiting_emergency_details'
          WHERE phone = $1;
        `, [sanitizedPhone]);
        const followupMessage = "I understand this is an emergency. To find a donor, please provide the patient's blood group and the city where the hospital is located.";
        await whatsappService.sendTextMessage(sanitizedPhone, followupMessage);
        return;
      }
    }
    await this.createEmergencyRequest(params, sanitizedPhone);
  }

  async createEmergencyRequest(params, requesterPhone) {
    const { patient_name = 'Unknown', blood_group, city, hospital_name = 'Unknown' } = params;
    try {
      const coords = await geocodingService.getCoords(hospital_name, city, null);
      const shortCode = Math.floor(1000 + Math.random() * 9000).toString();
      const { rows: [request] } = await db.query(
        `INSERT INTO emergency_requests (patient_name, blood_group, city, hospital_name, requested_by_phone, short_code, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;`,
        [patient_name, normalizeBloodGroup(blood_group), city, hospital_name, requesterPhone, shortCode, coords?.latitude, coords?.longitude]
      );
      
      console.log(`Successfully created emergency request ID: ${request.id}`);
      await whatsappService.sendTextMessage(requesterPhone, `✅ Emergency request active! We are now running a hyperlocal search for the best donor for *${patient_name}*.`);
      
      this.findAndNotifyDonors(request);

    } catch (error) {
      console.error('Error creating emergency request:', error);
      await whatsappService.sendTextMessage(requesterPhone, 'We could not process your request due to a system error.');
    }
  }

  /**
   * Finds potential donors, ranks them using the ML service, and notifies the best match.
   */
  async findAndNotifyDonors(request) {
    const { id: requestId, blood_group, city, requested_by_phone, latitude: hospitalLat, longitude: hospitalLon } = request;
    
    let topScoredDonors = await this.findAndRankGeneralDonors(blood_group, city, []);

    if (topScoredDonors.length === 0) {
      await whatsappService.sendTextMessage(requested_by_phone, '⚠️ We searched our network but could not find any available donors at this moment.');
      return;
    }

    if (hospitalLat && hospitalLon) {
        topScoredDonors.forEach(donor => {
            donor.distance = donor.latitude ? getDistanceInKm(hospitalLat, hospitalLon, donor.latitude, donor.longitude) : Infinity;
        });
        topScoredDonors.sort((a, b) => a.distance - b.distance);
    }

    const bestDonor = topScoredDonors[0];
    const notificationMessage = `🚨 URGENT: You are a top-ranked match!\n\nPatient *${request.patient_name}* needs your help (${request.blood_group}) at ${request.hospital_name}.\n\nReply *YES ${request.short_code}* to help.`;
    
    await whatsappService.sendTextMessage(bestDonor.phone, notificationMessage);
    await db.query('UPDATE users SET notifications_received = notifications_received + 1 WHERE id = $1', [bestDonor.id]);
    
    let adminMessage = `✅ Hyperlocal search complete. Notifying the best match: *${bestDonor.name}* (Score: ${bestDonor.final_score.toFixed(1)}, Dist: ${bestDonor.distance ? bestDonor.distance.toFixed(1) + ' km' : 'N/A'}).`;
    await whatsappService.sendTextMessage(requested_by_phone, adminMessage);
  }

  /**
   * Helper to find and score donors via the ML service.
   */
  async findAndRankGeneralDonors(bloodGroup, city, excludedDonorIds = []) {
    const { rows: availableDonors } = await db.query(
      `SELECT id, name, phone, last_donation, notifications_received, donations_confirmed, streak_count, latitude, longitude
       FROM users
       WHERE user_type = 'donor' AND blood_group = $1 AND city ILIKE $2
         AND availability_status = 'available' AND dnd_status = false
         AND (snooze_until IS NULL OR snooze_until < NOW())
         AND id NOT IN (SELECT unnest($3::uuid[]))
       LIMIT 50;`, [normalizeBloodGroup(bloodGroup), city, excludedDonorIds]
    );

    if (!availableDonors || availableDonors.length === 0) return [];
    
    const scoringPromises = availableDonors.map(donor => mlService.scoreSingleDonor(donor));
    const results = await Promise.allSettled(scoringPromises);

    const scoredDonors = availableDonors.map((donor, index) => {
        const score = results[index].status === 'fulfilled' ? results[index].value.final_score : 0;
        return { ...donor, final_score: score };
    });

    scoredDonors.sort((a, b) => b.final_score - a.final_score);
    return scoredDonors.slice(0, 5);
  }
}

export default new EmergencyService();