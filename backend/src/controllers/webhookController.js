// backend/src/controllers/webhookController.js

// Import required dependencies
import config from '../config/config.js';
import db from '../config/db.js';
import emergencyService from '../services/emergencyService.js';
import registrationService from '../services/registrationService.js';
import responseService from '../services/responseService.js';
import patientService from '../services/patientService.js';
import donorPreferenceService from '../services/donorPreferenceService.js';
import aiRouterService from '../services/aiRouterService.js';
import faqService from '../services/faqService.js';
import { normalizePhoneNumber } from '../utils/phoneHelper.js';

/**
 * Handles the GET request from Meta for webhook verification.
 * This is a one-time setup step.
 */
const verifyToken = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsappVerifyToken) {
    console.log('✅ Webhook verified successfully!');
    return res.status(200).send(challenge);
  }

  console.warn('Webhook verification failed. Make sure your verify token is correct.');
  res.status(403).send('Verification failed');
};

/**
 * Processes a single, validated incoming WhatsApp message.
 * This function contains the main routing logic for the chatbot.
 * @param {object} messageData - The message object from the Meta webhook payload.
 */
const processMessage = async (messageData) => {
  // 1. Extract and Normalize Message Data
  const from = normalizePhoneNumber(messageData.from);
  // Ignore any non-text messages (like images or audio)
  if (messageData.type !== 'text') {
    console.log(`Ignoring non-text message of type '${messageData.type}' from ${from}.`);
    return;
  }
  const userMessage = messageData.text.body.trim();
  const lowerUserMessage = userMessage.toLowerCase();
  console.log(`--- Processing Message --- From: ${from}, Message: "${userMessage}"`);

  // 2. High-Priority Keyword & Pattern Matching
  // These checks handle common, structured commands without needing to call the AI.

  // Check for ongoing patient application replies first
  const wasHandledByOnboarding = await patientService.processOnboardingReply(userMessage, from);
  if (wasHandledByOnboarding) {
    console.log(`✅ Message handled by: Patient Onboarding continuation for ${from}.`);
    return;
  }
  
  // Check for patient application start keyword
  if (lowerUserMessage === 'apply') {
    const started = await patientService.startApplication(from);
    if (started) {
      console.log(`✅ Message handled by: Patient Application start for ${from}.`);
      return;
    }
  }

  // Check for 6-digit OTP
  if (/^\d{6}$/.test(userMessage)) {
    console.log(` OTP Detected. Passing to Response Service...`);
    await responseService.verifyOTPAndConfirm(from, userMessage);
    console.log(`✅ Message handled by: OTP Verification for ${from}.`);
    return;
  }
  
  // Check for donor response with 4-digit short code (e.g., "YES 1234")
  const responseMatch = userMessage.match(/^(?:YES)\s+(\d{4})$/i);
  if (responseMatch) {
    console.log(` Donor Reply Detected. Passing to Response Service...`);
    const shortCode = responseMatch[1];
    await responseService.handleDonorReplyWithShortCode(from, shortCode);
    console.log(`✅ Message handled by: Donor Reply for ${from} with code ${shortCode}.`);
    return;
  }

  // 3. Fallback to AI-Powered Intent Routing
  // If no simple keywords match, use Gemini AI to understand the user's intent.
  console.log(`No direct keyword match found. Routing to AI to determine intent...`);

  let userRole = 'Unregistered';
  try {
    const { rows: [user] } = await db.query('SELECT role FROM users WHERE phone = $1', [from]);
    if (user) userRole = user.role;
  } catch (dbError) {
    console.error("CRITICAL: Database query for user role failed in AI router.", dbError);
    // Do not proceed if we can't check the user's role.
    return;
  }
  
  const route = await aiRouterService.routeMessageWithContext(userMessage, userRole);

  // If the AI determines a specific tool (function) to call
  if (route && route.tool) {
    console.log(`AI routed to tool: ${route.tool} with params:`, route.params);
    switch (route.tool) {
      case 'handle_emergency_request':
        await emergencyService.handleEmergencyRequest(userMessage, from);
        break;
      case 'handle_donor_registration':
        await registrationService.handleNewDonor(route.params, from);
        break;
      case 'handle_patient_onboarding':
         await patientService.handleNewPatient(userMessage, from);
         break;
      case 'handle_snooze_request':
        await donorPreferenceService.handleSnooze(from, route.params);
        break;
      case 'handle_dnd_request':
        await donorPreferenceService.handleDnd(from);
        break;
      default:
        // If AI chooses a tool we haven't implemented, fallback to FAQ
        console.log(`AI chose unhandled tool '${route.tool}'. Defaulting to FAQ.`);
        await faqService.handleFaq(userMessage, from);
        break;
    }
    console.log(`✅ Message handled by: AI-routed tool '${route.tool}' for ${from}.`);
    return;
  }

  // 4. Final Fallback
  // If no keywords matched and the AI did not choose a specific tool, treat it as a general question.
  console.log(`AI did not select a tool. Handling as a general FAQ.`);
  await faqService.handleFaq(userMessage, from);
  console.log(`✅ Message handled by: Fallback FAQ for ${from}.`);
};

/**
 * The main entry point for the /webhook POST request.
 * It validates the message and then calls processMessage.
 */
const handleMessage = async (req, res) => {
  // Immediately send a 200 OK response to Meta.
  // This is required, or Meta will think the webhook is failing and will disable it.
  res.sendStatus(200);

  try {
    const messageData = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    // If the payload is not a valid message, ignore it.
    if (!messageData) {
      console.warn('Webhook received a payload that was not a message.', req.body);
      return;
    }

    const messageId = messageData.id;

    // --- Database Interaction Point ---
    // This is where the ECONNREFUSED error is happening.
    // We check if we've already processed this message ID to prevent duplicate actions.
    let isDuplicate = false;
    try {
      const { rows } = await db.query('SELECT 1 FROM processed_messages WHERE message_id = $1', [messageId]);
      if (rows.length > 0) {
        isDuplicate = true;
      }
    } catch (dbError) {
      console.error(`CRITICAL: Database connection failed while checking for duplicate message ID. Error: ${dbError.message}`);
      // Stop execution if the database is down.
      return;
    }
    
    if (isDuplicate) {
      console.warn(`Duplicate message ignored: ${messageId}`);
      return;
    }
    // --- End of Database Interaction Point ---

    // Record the message ID in the database so we don't process it again.
    await db.query('INSERT INTO processed_messages(message_id) VALUES($1)', [messageId]);

    // Finally, process the message's content.
    await processMessage(messageData);

  } catch (error) {
    // This is a catch-all for any unexpected errors during message handling.
    console.error('CRITICAL ERROR in handleMessage:', {
      message: error.message,
      stack: error.stack,
    });
  }
};

export default {
  verifyToken,
  handleMessage,
};