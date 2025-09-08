// backend/src/services/registrationService.js
import db from '../config/db.js';
import whatsappService from './whatsappService.js';
import gamificationService from './gamificationService.js';
import { normalizePhoneNumber } from '../utils/phoneHelper.js';
import { normalizeBloodGroup } from '../utils/dataSanitizer.js';

class RegistrationService {
  /**
   * ✅ REWRITTEN: A single, intelligent function to handle all donor registration.
   */
    async handleNewDonor(params, phone) {
    const sanitizedPhone = normalizePhoneNumber(phone);
    try {
      const { rows: [existingUser] } = await db.query(
        "SELECT id, name, registration_status FROM users WHERE phone = $1", 
        [sanitizedPhone]
      );

      if (existingUser && existingUser.registration_status === 'completed') {
        await whatsappService.sendTextMessage(sanitizedPhone, `Welcome back, ${existingUser.name}! You are already registered.`);
        return;
      }

      const { name, city, blood_group } = params;

      // CASE 1: The AI successfully extracted the details from the user's message.
      if (name && name !== 'Unknown' && city && city !== 'Unknown' && blood_group && blood_group !== 'Unknown') {
        const normalizedBG = normalizeBloodGroup(blood_group);
        
        const { rows: [newUser] } = await db.query(
          `INSERT INTO users(name, city, blood_group, phone, user_type, registration_status, role)
           VALUES($1, $2, $3, $4, 'donor', 'completed', 'Emergency Donor')
           ON CONFLICT (phone) DO UPDATE SET 
             name = EXCLUDED.name, city = EXCLUDED.city, blood_group = EXCLUDED.blood_group, 
             registration_status = 'completed', role = 'Emergency Donor'
           RETURNING *;`,
          [name.trim(), city.trim(), normalizedBG, sanitizedPhone]
        );

        const successMessage = `✅ Registration Complete!\n\nWelcome, ${newUser.name}! You are now a registered Blood Warrior in ${newUser.city}.`;
        await whatsappService.sendTextMessage(sanitizedPhone, successMessage);
        await gamificationService.awardPoints(newUser.id, 'FIRST_REGISTRATION', sanitizedPhone);

        // ✅ NEW LOGIC: Send the interactive prompt to join a bridge.
        const bridgeQuestion = `Would you like to join a "Blood Bridge"?\n\nThis is a dedicated group of donors who support a specific patient with regular transfusions.`;
        const buttons = [
            { id: `join_bridge_${newUser.id}`, title: "Yes, sign me up!" },
            { id: `decline_bridge_${newUser.id}`, title: "Maybe later" }
        ];
        
        // Use a small delay so messages arrive in the correct order
        setTimeout(() => {
            whatsappService.sendInteractiveMessage(sanitizedPhone, bridgeQuestion, buttons);
        }, 1500); // 1.5 second delay

        return;
      }

      // CASE 2: The AI determined the user wants to register but couldn't find the details.
      const followupMessage = 
        "Great! To get you registered as a donor, please reply with your Name, City, and Blood Group.";
      
      await whatsappService.sendTextMessage(sanitizedPhone, followupMessage);

    } catch (error) {
      console.error('Critical error in handleNewDonor:', error);
      await whatsappService.sendTextMessage(sanitizedPhone, 'We encountered an error during registration.');
    }
  }
}

export default new RegistrationService();