// backend/server.js

// Import required dependencies
import express from 'express'; // Express framework for building the server
import cors from 'cors'; // Middleware for enabling CORS
import morgan from 'morgan'; // Middleware for request logging
import config from './src/config/config.js'; // Configuration settings
import adminRoutes from './src/routes/adminRoutes.js'; // Admin dashboard routes
import { verifyWebhook } from './src/middleware/verifyWebhook.js'; // Webhook signature verification
import webhookController from './src/controllers/webhookController.js'; // Webhook handling controller
import BridgeCoordinationService from './src/services/bridgeCoordinationService.js';

// --- PHASE 1: PREDICTIVE ENGAGEMENT ---
import cron from 'node-cron'; // Import the cron scheduler library
import EngagementService from './src/services/engagementService.js'; // Import our new engagement service
// --- END PHASE 1 ---

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001; // Use environment PORT or default to 3001

// Middleware setup
app.use(cors()); // Enable CORS for all routes
app.use(morgan('tiny')); // Log HTTP requests in 'tiny' format

// API and Health Routes
app.get('/health', (req, res) => {
  // Health check endpoint to verify server status
  res.status(200).json({ status: 'healthy', now: new Date().toISOString() });
});

// Admin routes with JSON body parser
app.use('/api/admin', express.json({ limit: '1mb' }), adminRoutes);

// Webhook Routes
app.get('/webhook', webhookController.verifyToken); // Handle Meta webhook verification (GET)

app.post(
  '/webhook',
  express.json({
    verify: (req, res, buf) => {
req.rawBody = buf.toString();     }
  }),
  verifyWebhook, // This middleware will now use req.rawBody
  webhookController.handleMessage // This controller will use the parsed req.body
);

// Global Error Handling
app.use((err, req, res, next) => {
  // Handle errors from middleware or routes
  console.error('[ERROR HANDLER]', err.stack);
  res.status(500).json({ message: 'An internal server error occurred.' });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});


// --- PHASE 1: PREDICTIVE ENGAGEMENT SCHEDULER ---
// This task is scheduled to run at 9:00 AM every day in the Asia/Kolkata timezone.
// It will automatically find donors who are now eligible to donate again and send them a reminder.
console.log('🕒 Cron job for eligibility reminders scheduled to run every day at 9:00 AM.');
cron.schedule('0 9 * * *', () => {
  console.log('⏰ It is 9:00 AM. Triggering the eligibility reminder cron job...');
  // We create a new instance to ensure it's a fresh run
  const engagementService = new EngagementService();
  engagementService.sendEligibilityReminders();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata" // IMPORTANT: Set to your target timezone
});

console.log('🕒 Cron job for automatic bridge requests scheduled to run every day at 8:00 AM.');
cron.schedule('0 8 * * *', () => {
  console.log('⏰ It is 8:00 AM. Triggering automatic bridge requests...');
  const bridgeService = new BridgeCoordinationService();
  bridgeService.triggerAutomaticBridgeRequests();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// '0 10 * * 0' means at minute 0, hour 10, on day-of-week 0 (Sunday).
console.log('🕒 Cron job for inactive donor nudges scheduled to run every Sunday at 10:00 AM.');
cron.schedule('0 10 * * 0', () => {
    console.log('⏰ It is Sunday 10:00 AM. Triggering inactive donor nudge...');
    const engagementService = new EngagementService();
    engagementService.sendInactiveDonorNudges();
}, {
    scheduled: true,
    timezone: "Asia/Kolkata"
});
// --- END PHASE 1 ---


// Start the server
app.listen(PORT, () => {
  console.log(`✅ BloodBridge AI backend is running on port ${PORT}`);
});