// backend/src/services/registrationService.js
import db from '../config/db.js';
import whatsappService from '../services/whatsappService.js';
import gamificationService from './gamificationService.js';
import { normalizePhoneNumber } from '../utils/phoneHelper.js';
import { normalizeBloodGroup } from '../utils/dataSanitizer.js';

class RegistrationService {
  async handleNewDonor(params, phone) {
    const sanitizedPhone = normalizePhoneNumber(phone);
    try {
      const { rows: [existingUser] } = await db.query(
        "SELECT id, name, registration_status FROM users WHERE phone = $1",
        [sanitizedPhone]
      );

      if (existingUser && existingUser.registration_status === 'completed') {
        await whatsappService.sendTextMessage(sanitizedPhone, `Welcome back, ${existingUser.name}! You are already registered and ready to help.`);
        return;
      }

      const { name, city, blood_group } = params;

      // SCENARIO 1: User provides all details (e.g., "Register: John, Delhi, A+")
      if (name && city && blood_group) {
        const normalizedBG = normalizeBloodGroup(blood_group);
        let newUser;
        if (existingUser) { // If user was 'pending' and now provides details
          const { rows } = await db.query(
            "UPDATE users SET name = $1, city = $2, blood_group = $3, registration_status = 'completed', role = 'Emergency Donor', user_type = 'donor' WHERE id = $4 RETURNING *;",
            [name, city, normalizedBG, existingUser.id]
          );
          newUser = rows[0];
        } else { // A completely new user provides all details at once
          const { rows } = await db.query(
            "INSERT INTO users(name, city, blood_group, phone, user_type, registration_status, role) VALUES($1, $2, $3, $4, 'donor', 'completed', 'Emergency Donor') RETURNING *;",
            [name, city, normalizedBG, sanitizedPhone]
          );
          newUser = rows[0];
        }
        const successMessage = `✅ Registration Complete!\n\nWelcome, ${newUser.name}! You are now a registered Blood Warrior in ${city}.`;
        await whatsappService.sendTextMessage(sanitizedPhone, successMessage);
        await gamificationService.awardPoints(newUser.id, 'FIRST_REGISTRATION', sanitizedPhone);
        return;
      }

      // SCENARIO 2: User just says "I want to register" (No details)
      if (!existingUser) {
        // --- THIS IS THE CORRECTED CODE BLOCK ---
        // We create a placeholder user record and ask for more details.
        // We MUST include the `user_type` to satisfy the NOT NULL constraint.
        console.log(`Creating a new 'pending' donor record for ${sanitizedPhone}.`);
        await db.query(
          "INSERT INTO users(name, phone, user_type, registration_status, role) VALUES ($1, $2, 'donor', 'pending', 'Unregistered')",
          ['Pending User', sanitizedPhone]
        );
        // --- END OF CORRECTION ---
      }

      const followupMessage = "Thank you for your interest! To complete your registration, please reply with your details in this format:\n\n*Register: [Your Name], [Your City], [Your Blood Group]*";
      await whatsappService.sendTextMessage(sanitizedPhone, followupMessage);

    } catch (error) {
      console.error('Critical error in handleNewDonor:', error);
      // This is the fallback message the user received.
      await whatsappService.sendTextMessage(sanitizedPhone, 'We encountered an error during registration. Please try again later.');
    }
  }
}

export default new RegistrationService();