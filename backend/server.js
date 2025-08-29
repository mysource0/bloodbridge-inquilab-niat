// backend/server.js

// Import required dependencies
import express from 'express'; // Express framework for building the server
import cors from 'cors'; // Middleware for enabling CORS
import morgan from 'morgan'; // Middleware for request logging
import config from './src/config/config.js'; // Configuration settings (e.g., WHATSAPP_TOKEN)
import adminRoutes from './src/routes/adminRoutes.js'; // Admin dashboard routes
import { verifyWebhook } from './src/middleware/verifyWebhook.js'; // Webhook signature verification middleware (named import)
import webhookController from './src/controllers/webhookController.js'; // Webhook handling controller

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

// --- THIS IS THE CORRECTED SECTION ---
// The webhook POST route now uses express.json() with a special `verify` function.
// This function saves the raw, unparsed request body to `req.rawBody`
// BEFORE it gets parsed. This is essential for the signature check.
app.post(
  '/webhook',
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  }),
  verifyWebhook, // This middleware will now use req.rawBody
  webhookController.handleMessage // This controller will use the parsed req.body
);
// --- END OF CORRECTION ---

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

// Start the server
app.listen(PORT, () => {
  console.log(`✅ BloodBridge AI backend is running on port ${PORT}`);
});