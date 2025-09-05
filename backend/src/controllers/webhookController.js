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
import gamificationService from '../services/gamificationService.js';
import whatsappService from '../services/whatsappService.js';
import { normalizePhoneNumber } from '../utils/phoneHelper.js';
// ✅ ADDING FEATURES FROM THE MORE ADVANCED VERSION
import { detectLanguage } from '../utils/languageHelper.js';
import translationService from '../utils/translationService.js';
import bridgeService from '../services/bridgeService.js';


/**
 * Handles the GET request from Meta for webhook verification.
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
 */
const processMessage = async (messageData) => {
  const from = normalizePhoneNumber(messageData.from);

  // --- PRIORITY 0: Handle Non-Text Message Types ---
  if (messageData.type === 'interactive' && messageData.interactive.type === 'button_reply') {
    const buttonId = messageData.interactive.button_reply.id;
    console.log(`--- Interactive Reply --- From: ${from}, Button ID: ${buttonId}`);
    if (buttonId.startsWith('join_bridge_')) {
      await bridgeService.addDonorToBridge(buttonId.replace('join_bridge_', ''));
      await whatsappService.sendTextMessage(from, "Thank you for joining a Blood Bridge! You are now part of a dedicated life-saving team. ❤️");
    } else if (buttonId.startsWith('decline_bridge_')) {
      await whatsappService.sendTextMessage(from, "No problem! We appreciate you being a regular donor and will keep you in mind for general requests.");
    }
    return;
  }
  
  if (messageData.type === 'location') {
    console.log(`--- Location Message --- From: ${from}`);
    await emergencyService.handleLocationReply(from, messageData.location);
    return;
  }

  if (messageData.type !== 'text') {
    console.log(`Ignoring non-text message of type '${messageData.type}' from ${from}.`);
    return;
  }

  // --- Text Message Processing ---
  let userMessage = messageData.text.body.trim();
  
  // Multi-language Support
  const detectedLang = await detectLanguage(userMessage);
  if (detectedLang && detectedLang !== 'en') {
      console.log(`Language Detected: ${detectedLang}. Translating to English...`);
      userMessage = await translationService.translateToEnglish(userMessage);
      console.log(`Translated Message: "${userMessage}"`);
  }
  
  const lowerUserMessage = userMessage.toLowerCase();
  console.log(`--- Processing Message --- From: ${from}, Processed Message: "${userMessage}"`);

  // --- PRIORITY 1: Rigid Commands & State-Based Replies ---
  // Patient Onboarding Flow
  if (await patientService.processOnboardingReply(userMessage, from)) return;
  if (lowerUserMessage === 'apply' && await patientService.startApplication(from)) return;
  
  // Donor Response Flow
  if (/^\d{6}$/.test(userMessage)) {
    await responseService.verifyOTPAndConfirm(from, userMessage);
    return;
  }
  if (lowerUserMessage === 'no') {
    await responseService.handleSimpleDecline(from);
    return;
  }
  const responseMatch = userMessage.match(/^(?:YES)\s+(\d{4})$/i);
  if (responseMatch) {
    await responseService.handleDonorReplyWithShortCode(from, responseMatch[1]);
    return;
  }
  if (lowerUserMessage === 'yes') {
    const { rows: [userWithCode] } = await db.query("SELECT last_request_short_code FROM users WHERE phone = $1", [from]);
    if (userWithCode && userWithCode.last_request_short_code) {
        await responseService.handleDonorReplyWithShortCode(from, userWithCode.last_request_short_code);
        return;
    }
  }

  // Demo Commands for Testing
  if (lowerUserMessage.startsWith('/demo')) {
    // Add logic for demo commands if needed, e.g., triggering cron jobs manually
    console.log('DEMO MODE ACTIVATED');
    return;
  }

  // --- PRIORITY 2: AI-Powered Intent Routing ---
  console.log(`No direct keyword match found. Routing to AI to determine intent...`);
  const { rows: [user] } = await db.query('SELECT role FROM users WHERE phone = $1', [from]);
  const userRole = user ? user.role : 'Unregistered';
  
  const route = await aiRouterService.routeMessageWithContext(userMessage, userRole);
  if (route && route.tool) {
    console.log(`AI routed to tool: ${route.tool} with params:`, route.params);
    switch (route.tool) {
      case 'handle_emergency_request':
        await emergencyService.handleEmergencyRequest(userMessage, from);
        break;
      case 'handle_donor_registration':
        await registrationService.handleNewDonor(route.params, from);
        break;
      case 'get_my_dashboard': {
        const statusMessage = await gamificationService.getDonorStatus(from);
        await whatsappService.sendTextMessage(from, statusMessage);
        break;
      }
      case 'get_leaderboard': {
        const leaderboardMessage = await gamificationService.getLeaderboardMessage(from);
        await whatsappService.sendTextMessage(from, leaderboardMessage);
        break;
      }
      case 'handle_snooze_request':
        await donorPreferenceService.handleSnooze(from, route.params);
        break;
      default:
        console.log(`AI chose unhandled tool '${route.tool}'. Defaulting to FAQ.`);
        await faqService.handleFaq(userMessage, from);
        break;
    }
    return;
  }

  // --- PRIORITY 3: Final Fallback ---
  console.log(`AI did not select a tool. Handling as a general FAQ.`);
  await faqService.handleFaq(userMessage, from);
};

/**
 * The main entry point for the /webhook POST request.
 */
const handleMessage = async (req, res) => {
  res.sendStatus(200); // Acknowledge receipt to Meta immediately

  try {
    const messageData = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!messageData) {
      // This is often just a status update from WhatsApp, not an error.
      return;
    }

    const messageId = messageData.id;
    const { rows } = await db.query('SELECT 1 FROM processed_messages WHERE message_id = $1', [messageId]);
    if (rows.length > 0) {
      console.warn(`Duplicate message ignored: ${messageId}`);
      return;
    }
    
    await db.query('INSERT INTO processed_messages(message_id) VALUES($1)', [messageId]);
    await processMessage(messageData);

  } catch (error) {
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