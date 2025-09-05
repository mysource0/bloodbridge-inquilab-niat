// backend/src/services/engagementService.js
import db from '../config/db.js';
import whatsappService from './whatsappService.js';

class EngagementService {
  /**
   * Finds donors whose 90-day cooldown period has ended and reminds them
   * that they are now eligible to donate again.
   */
  async sendEligibilityReminders() {
    console.log('CRON JOB: Running sendEligibilityReminders...');
    try {
      // 1. Find all donors who are ready to be re-activated.
      // - Their cooldown must have expired (cooldown_until <= NOW()).
      // - Their status must currently be 'unavailable' (from their last donation).
      // - They must not have opted out of all notifications (dnd_status = false).
      const { rows: eligibleDonors } = await db.query(
        `SELECT id, name, phone
         FROM users
         WHERE user_type = 'donor'
           AND availability_status = 'unavailable'
           AND dnd_status = false
           AND cooldown_until <= NOW()`
      );

      if (eligibleDonors.length === 0) {
        console.log('CRON JOB: No donors are newly eligible today.');
        return;
      }

      console.log(`CRON JOB: Found ${eligibleDonors.length} newly eligible donors. Preparing to send reminders.`);

      // 2. Prepare all the database updates.
      // We will collect all the user IDs to update their status in a single efficient query.
      const donorIdsToUpdate = eligibleDonors.map(donor => donor.id);
      const updatePromise = db.query(
        "UPDATE users SET availability_status = 'available' WHERE id = ANY($1::uuid[])",
        [donorIdsToUpdate]
      );

      // 3. Prepare all the WhatsApp messages.
      // We will send messages concurrently for maximum speed.
      const messagePromises = eligibleDonors.map(donor => {
        const message = `Hi ${donor.name}! 👋\n\nGreat news! Your 90-day waiting period is over, and you are now eligible to save a life again.\n\nYour status has been updated to "Available". Thank you for being a vital part of the BloodBridge community! ❤️`;
        return whatsappService.sendTextMessage(donor.phone, message);
      });

      // 4. Execute all promises (database updates and messages).
      // Promise.allSettled is used so that if one message fails, it doesn't stop the others.
      const results = await Promise.allSettled([updatePromise, ...messagePromises]);

      // 5. Log the results for monitoring.
      let successCount = 0;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (index > 0) successCount++; // Don't count the DB update as a message
        } else {
          console.error(`CRON JOB: Failed to process reminder for donor ID ${donorIdsToUpdate[index - 1]}:`, result.reason);
        }
      });
      console.log(`CRON JOB: Successfully sent ${successCount} eligibility reminders.`);
      console.log(`CRON JOB: Updated ${donorIdsToUpdate.length} donors to 'available' status.`);

    } catch (error) {
      console.error('CRITICAL ERROR in cron job sendEligibilityReminders:', error);
    }
  }


   /**
   * Finds active, eligible donors who have not donated in a long time
   * and sends them a personalized re-engagement message.
   */
  async sendInactiveDonorNudges() {
    console.log('CRON JOB: Running Inactive Donor Nudge...');
    try {
      // 1. Find donors who are available but haven't donated in over 6 months (180 days).
      const { rows: inactiveDonors } = await db.query(
        `SELECT id, name, phone 
         FROM users
         WHERE 
           user_type = 'donor' AND
           availability_status = 'available' AND
           dnd_status = false AND
           (snooze_until IS NULL OR snooze_until < NOW()) AND
           (last_donation IS NULL OR last_donation < NOW() - INTERVAL '180 days')`
      );

      if (inactiveDonors.length === 0) {
        console.log('CRON JOB: No inactive donors to nudge this week.');
        return;
      }

      console.log(`CRON JOB: Found ${inactiveDonors.length} inactive donors. Sending nudges...`);
      for (const donor of inactiveDonors) {
        const nudgeMessage = `Hi ${donor.name}! We miss you. Patients in your area are still in need of heroes like you. We hope you'll consider donating again soon. Your support makes a huge difference!`;
        await whatsappService.sendTextMessage(donor.phone, nudgeMessage);
        // Add a small delay to avoid spamming the WhatsApp API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error("CRITICAL ERROR in cron job sendInactiveDonorNudges:", error);
    }
  }
  // In backend/src/services/engagementService.js, inside the class

/**
 * Finds active, eligible donors who have not donated in a long time
 * and sends them a personalized re-engagement message.
 */
async sendInactiveDonorNudges() {
  console.log('CRON JOB: Running Inactive Donor Nudge...');
  try {
    // 1. Find donors who are available but haven't donated in over 6 months (180 days).
    const { rows: inactiveDonors } = await db.query(
      `SELECT id, name, phone 
       FROM users
       WHERE 
         user_type = 'donor' AND
         availability_status = 'available' AND
         dnd_status = false AND
         (snooze_until IS NULL OR snooze_until < NOW()) AND
         (last_donation IS NULL OR last_donation < NOW() - INTERVAL '180 days')`
    );

    if (inactiveDonors.length === 0) {
      console.log('CRON JOB: No inactive donors to nudge this week.');
      return;
    }

    console.log(`CRON JOB: Found ${inactiveDonors.length} inactive donors. Sending nudges...`);
    for (const donor of inactiveDonors) {
      const nudgeMessage = `Hi ${donor.name}! We miss you. Patients in your area are still in need of heroes like you. We hope you'll consider donating again soon. Your support makes a huge difference!`;
      await whatsappService.sendTextMessage(donor.phone, nudgeMessage);
    }
  } catch (error) {
    console.error("CRITICAL ERROR in cron job sendInactiveDonorNudges:", error);
  }
}
}

export default new EngagementService();