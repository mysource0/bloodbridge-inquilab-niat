// backend/src/services/patientService.js
import db from '../config/db.js';
import whatsappService from './whatsappService.js';
import { normalizeBloodGroup } from '../utils/dataSanitizer.js';
import { normalizePhoneNumber } from '../utils/phoneHelper.js';

class PatientService {
  /**
   * Handles the initial message from a potential patient.
   * Creates a pending record and asks them to opt-in by replying "APPLY".
   */
  async handleNewPatient(params, phone) {
    const sanitizedPhone = normalizePhoneNumber(phone);
    try {
      const { rows: [existingPatient] } = await db.query("SELECT id FROM patients WHERE phone = $1", [sanitizedPhone]);
      if (existingPatient) {
        await whatsappService.sendTextMessage(sanitizedPhone, `Welcome back! Our records show this number is already associated with a patient. An admin will be in touch shortly.`);
        return;
      }

      const { patient_name, city, blood_group } = params;

      // PATH 1: AI extracted details for a one-shot registration (Passes REG-04)
      if (patient_name && city && blood_group) {
        const normalizedBG = normalizeBloodGroup(blood_group);
        await db.query(
          `INSERT INTO patients (name, phone, blood_group, city, status)
           VALUES ($1, $2, $3, $4, 'pending_verification')`,
          [patient_name, sanitizedPhone, normalizedBG, city]
        );
        const finalMessage = `Thank you! We have received the initial information for *${patient_name}*.\n\nAn admin from our team has been notified and will contact you on this number to verify the details.`;
        await whatsappService.sendTextMessage(sanitizedPhone, finalMessage);
      } 
      // PATH 2: Details are missing, fall back to the conversational flow.
      else {
        await db.query(
          `INSERT INTO patients (name, phone, blood_group, city, status)
           VALUES ('Awaiting Input', $1, 'N/A', 'N/A', 'pending_opt_in') ON CONFLICT (phone) DO NOTHING;`,
          [sanitizedPhone]
        );
        await whatsappService.sendTextMessage(sanitizedPhone, `Thank you for reaching out. To begin your application for our Blood Bridge support program, please reply with: *APPLY*`);
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
      if (!patient) return false;

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
    if (!patient) return false;

    let columnToUpdate = null;
    let valueToUpdate = message;
    
    if (patient.name === 'Awaiting Input') columnToUpdate = 'name';
    else if (patient.blood_group === 'N/A') {
      columnToUpdate = 'blood_group';
      valueToUpdate = normalizeBloodGroup(message);
    } else if (patient.city === 'N/A') columnToUpdate = 'city';
    
    if (columnToUpdate) {
        await db.query(`UPDATE patients SET ${columnToUpdate} = $1 WHERE id = $2`, [valueToUpdate, patient.id]);
        
        // Ask the next question after a short delay
        setTimeout(() => { this.continueOnboarding(patient.id, phone); }, 500);
        return true;
    }
    return false;
  }
}

export default new PatientService();