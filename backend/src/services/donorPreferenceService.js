// backend/src/services/donorPreferenceService.js
import db from '../config/db.js';
import whatsappService from './whatsappService.js';

class DonorPreferenceService {
  /**
   * Sets a snooze period for a donor, pausing notifications.
   * @param {string} phone - The donor's phone number.
   * @param {object} params - Parameters from the AI, e.g., { duration: 1, unit: 'week' }.
   */
  async handleSnooze(phone, params) {
    const { duration = 15, unit = 'day' } = params; // Default to 15 days if AI provides no params
    
    try {
      const interval = `${duration} ${unit}`;
      const { rows: [user] } = await db.query(
        "UPDATE users SET snooze_until = NOW() + $1::interval WHERE phone = $2 RETURNING snooze_until",
        [interval, phone]
      );

      if (user && user.snooze_until) {
        const snoozeDate = new Date(user.snooze_until).toLocaleDateString('en-IN');
        const message = `Got it. I've paused all non-critical notifications for you until ${snoozeDate}. We'll reach out again after that. Thank you for being a donor!`;
        await whatsappService.sendTextMessage(phone, message);
      }
    } catch (error) {
      console.error(`Error setting snooze for ${phone}:`, error);
      await whatsappService.sendTextMessage(phone, "I'm sorry, I encountered an error while setting your preferences.");
    }
  }

  /**
   * Sets the Do Not Disturb (DND) status for a donor, permanently stopping notifications.
   * @param {string} phone - The donor's phone number.
   */
  async handleDnd(phone) {
    try {
      await db.query(
        "UPDATE users SET dnd_status = true, availability_status = 'unavailable' WHERE phone = $1",
        [phone]
      );
      const message = "You have been unsubscribed from all future notifications. We're sad to see you go, but we respect your decision. If you ever change your mind, just send 'Register' to sign up again.";
      await whatsappService.sendTextMessage(phone, message);
    } catch (error) {
      console.error(`Error setting DND for ${phone}:`, error);
      await whatsappService.sendTextMessage(phone, "I'm sorry, I encountered an error while updating your DND status.");
    }
  }
}

export default new DonorPreferenceService();