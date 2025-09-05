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
        "SELECT id, name, city, blood_group, registration_status FROM users WHERE phone = $1",
        [sanitizedPhone]
      );

      const { name, city, blood_group } = params;

      // ✅ CASE 1: Already registered
      if (existingUser && existingUser.registration_status === 'completed') {
        const msg = `Welcome back, ${existingUser.name}! You are already registered and ready to help.`;
        await whatsappService.sendTextMessage(sanitizedPhone, msg);
        return {
          status: 'complete',
          user: existingUser,
          needs: [],
          message: msg
        };
      }

      // ✅ CASE 2: User provides all details (complete registration in one go)
      if (name && name !== 'Unknown' && city && city !== 'Unknown' && blood_group && blood_group !== 'Unknown') {
        const normalizedBG = normalizeBloodGroup(blood_group);
        let newUser;

        if (existingUser) {
          // Update pending → completed
          const { rows } = await db.query(
            `UPDATE users
             SET name = $1, city = $2, blood_group = $3,
                 registration_status = 'completed',
                 role = 'Emergency Donor',
                 user_type = 'donor'
             WHERE id = $4
             RETURNING *;`,
            [name, city, normalizedBG, existingUser.id]
          );
          newUser = rows[0];
        } else {
          // Fresh complete registration
          const { rows } = await db.query(
            `INSERT INTO users(name, city, blood_group, phone, user_type, registration_status, role)
             VALUES($1, $2, $3, $4, 'donor', 'completed', 'Emergency Donor')
             RETURNING *;`,
            [name, city, normalizedBG, sanitizedPhone]
          );
          newUser = rows[0];
        }

        const successMessage =
          `✅ Registration Complete!\n\nWelcome, ${newUser.name}! ` +
          `You are now a registered Blood Warrior in ${newUser.city}.`;

        await whatsappService.sendTextMessage(sanitizedPhone, successMessage);
        await gamificationService.awardPoints(newUser.id, 'FIRST_REGISTRATION', sanitizedPhone);

        return {
          status: 'complete',
          user: newUser,
          needs: [],
          message: successMessage
        };
      }

      // ✅ CASE 3: User says "I want to register" (no details)
      if (!existingUser) {
        // Only create placeholder if not already present
        console.log(`Creating a new 'pending' donor record for ${sanitizedPhone}.`);
        await db.query(
          `INSERT INTO users(name, phone, user_type, registration_status, role)
           VALUES ($1, $2, 'donor', 'pending', 'Unregistered')`,
          ['Pending User', sanitizedPhone]
        );
      }

      const followupMessage =
        "Thank you for your interest! To complete your registration, " +
        "please reply with your details in this format:\n\n" +
        "*Register: [Your Name], [Your City], [Your Blood Group]*";

      await whatsappService.sendTextMessage(sanitizedPhone, followupMessage);

      return {
        status: 'partial',
        user: existingUser || { phone: sanitizedPhone, registration_status: 'pending' },
        needs: ['name', 'city', 'blood_group'],
        message: followupMessage
      };
    } catch (error) {
      console.error('Critical error in handleNewDonor:', error);

      const errMsg = 'We encountered an error during registration. Please try again later.';
      await whatsappService.sendTextMessage(sanitizedPhone, errMsg);

      return {
        status: 'error',
        user: null,
        needs: [],
        message: errMsg
      };
    }
  }
}

export default new RegistrationService();
