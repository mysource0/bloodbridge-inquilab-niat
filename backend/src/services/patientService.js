// backend/src/services/patientService.js
import db from '../config/db.js';
import whatsappService from './whatsappService.js';
import aiRouterService from './aiRouterService.js';
import { normalizeBloodGroup } from '../utils/dataSanitizer.js';
import { normalizePhoneNumber } from '../utils/phoneHelper.js';

class PatientService {
  /**
   * Handles the initial message from a potential patient.
   * Uses AI to pre-fill an application or starts a conversation.
   */
  async handleNewPatient(userMessage, phone) {
    const sanitizedPhone = normalizePhoneNumber(phone);
    try {
      const { rows: [existingUser] } = await db.query("SELECT id FROM users WHERE phone = $1", [sanitizedPhone]);
      if (existingUser) {
        await whatsappService.sendTextMessage(sanitizedPhone, `Welcome back! Our records show you are already registered. An admin will be in touch shortly.`);
        return;
      }

      // Use the AI to attempt to extract details from the first message.
      const route = await aiRouterService.routeMessageWithContext(userMessage, 'Unregistered');
      
      let patientName = 'Awaiting Input';
      let bloodGroup = 'N/A';
      let city = 'N/A';

      if (route && route.tool === 'handle_patient_onboarding' && route.params.patient_name) {
          patientName = route.params.patient_name;
          bloodGroup = normalizeBloodGroup(route.params.blood_group) || 'N/A';
          city = route.params.city || 'N/A';
      }
      
      // Use a transaction to create both a 'user' and a 'patient' record.
      const client = await db.pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: [newUser] } = await client.query(
            `INSERT INTO users (name, phone, blood_group, city, role, user_type)
             VALUES ($1, $2, $3, $4, 'Patient', 'patient') RETURNING id;`,
            [patientName, sanitizedPhone, bloodGroup, city]
        );
        const { rows: [newPatient] } = await client.query(
            `INSERT INTO patients (user_id, name, phone, blood_group, city, status)
             VALUES ($1, $2, $3, $4, $5, 'pending_opt_in') RETURNING id;`,
            [newUser.id, patientName, sanitizedPhone, bloodGroup, city]
        );
        await client.query('COMMIT');
        
        console.log(`New patient lead logged. User ID: ${newUser.id}, Patient ID: ${newPatient.id}`);
        
        if (patientName !== 'Awaiting Input') {
            await db.query("UPDATE patients SET status = 'pending_verification' WHERE id = $1", [newPatient.id]);
            await whatsappService.sendTextMessage(sanitizedPhone, `Thank you! We have pre-filled your application for *${patientName}*. An admin will contact you shortly to verify.`);
        } else {
            await whatsappService.sendTextMessage(sanitizedPhone, `Thank you for reaching out. To begin your application for our Blood Bridge support program, please reply with: *APPLY*`);
        }
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error in handleNewPatient:', error);
      await whatsappService.sendTextMessage(sanitizedPhone, 'Sorry, we encountered an error logging your request.');
    }
  }
  
  /**
   * Starts the conversational form after the user replies "APPLY".
   */
  async startApplication(phone) {
      const { rows: [patient] } = await db.query("SELECT id FROM patients WHERE phone = $1 AND status = 'pending_opt_in'", [phone]);
      if (!patient) return false; // Not a user waiting to apply

      await db.query("UPDATE patients SET status = 'pending_details' WHERE id = $1", [patient.id]);
      await this.continueOnboarding(patient.id, phone);
      return true;
  }

  /**
   * The "state machine" that asks the next question based on what info is missing.
   */
  async continueOnboarding(patientId, phone) {
    const { rows: [patient] } = await db.query("SELECT * FROM patients WHERE id = $1", [patientId]);
    if (!patient) return;

    if (patient.name === 'Awaiting Input') {
      await whatsappService.sendTextMessage(phone, "Great! Let's begin.\n\nFirst, what is the patient's full name?");
      return;
    }
    if (patient.blood_group === 'N/A') {
      await whatsappService.sendTextMessage(phone, `Thank you. What is ${patient.name}'s blood group? (e.g., O+, AB-)`);
      return;
    }
    if (patient.city === 'N/A') {
      await whatsappService.sendTextMessage(phone, `Got it. In which city does the patient receive treatment?`);
      return;
    }

    // All details are collected.
    await db.query("UPDATE patients SET status = 'pending_verification' WHERE id = $1", [patientId]);
    const finalMessage = `Thank you! We have all the initial information we need for *${patient.name}*.\n\nAn admin has been notified and will contact you on this number to verify the details.`;
    await whatsappService.sendTextMessage(phone, finalMessage);
  }

  /**
   * Processes a user's reply during the conversational form.
   */
  async processOnboardingReply(message, phone) {
    const { rows: [patient] } = await db.query("SELECT * FROM patients WHERE phone = $1 AND status = 'pending_details'", [phone]);
    if (!patient) return false; // User is not in the middle of an application.

    let columnToUpdate = null;
    let valueToUpdate = message;
    
    if (patient.name === 'Awaiting Input') columnToUpdate = 'name';
    else if (patient.blood_group === 'N/A') {
      columnToUpdate = 'blood_group';
      valueToUpdate = normalizeBloodGroup(message);
    } else if (patient.city === 'N/A') columnToUpdate = 'city';
    
    if (columnToUpdate) {
        await db.query(`UPDATE patients SET ${columnToUpdate} = $1 WHERE id = $2`, [valueToUpdate, patient.id]);
        await db.query(`UPDATE users SET ${columnToUpdate} = $1 WHERE id = $2`, [valueToUpdate, patient.user_id]);
        
        // Ask the next question after a short delay
        setTimeout(() => { this.continueOnboarding(patient.id, phone); }, 500);
        return true; // The message was handled.
    }
    return false;
  }
}

export default new PatientService();