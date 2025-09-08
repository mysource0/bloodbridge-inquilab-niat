// backend/src/services/schedulerService.js
import cron from 'node-cron';
// ✅ FIX: Import the already-created INSTANCES of the services
import engagementService from './engagementService.js';
import bridgeCoordinationService from './bridgeCoordinationService.js';

// ✅ FIX: Use the imported instances directly in these functions
export const triggerEligibilityReminders = () => {
  console.log('MANUAL TRIGGER: Running eligibility reminders...');
  return engagementService.sendEligibilityReminders();
};

export const triggerAutomaticBridgeRequests = () => {
  console.log('MANUAL TRIGGER: Running automatic bridge requests...');
  return bridgeCoordinationService.triggerAutomaticBridgeRequests();
};

export const triggerInactiveDonorNudges = () => {
  console.log('MANUAL TRIGGER: Running inactive donor nudges...');
  return engagementService.sendInactiveDonorNudges();
};

class SchedulerService {
  start() {
    console.log('🕒 Cron job for eligibility reminders scheduled to run every day at 9:00 AM.');
    cron.schedule('0 9 * * *', triggerEligibilityReminders, { timezone: "Asia/Kolkata" });
    
    console.log('🕒 Cron job for automatic bridge requests scheduled to run every day at 8:00 AM.');
    cron.schedule('0 8 * * *', triggerAutomaticBridgeRequests, { timezone: "Asia/Kolkata" });
    
    console.log('🕒 Cron job for inactive donor nudges scheduled to run every Sunday at 10:00 AM.');
    cron.schedule('0 10 * * 0', triggerInactiveDonorNudges, { timezone: "Asia/Kolkata" });
  }
}

export const Scheduler = new SchedulerService();