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
import bridgeService from '../services/bridgeService.js';
import { normalizePhoneNumber } from '../utils/phoneHelper.js';
import { detectLanguage } from '../utils/languageHelper.js';
import translationService from '../utils/translationService.js';
import { triggerInactiveDonorNudges, triggerAutomaticBridgeRequests } from '../services/schedulerService.js';
import loggingService from '../services/loggingService.js';

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
  
  const detectedLang = await detectLanguage(userMessage);
  if (detectedLang && detectedLang !== 'en') {
      userMessage = await translationService.translateToEnglish(userMessage);
  }
  
  const lowerUserMessage = userMessage.toLowerCase();
  console.log(`--- Processing Message --- From: ${from}, Processed Message: "${userMessage}"`);
  await loggingService.logIncoming(from, userMessage);

  // --- PRIORITY 1: Rigid Commands & State-Based Replies ---
  
  // Smart parser for the multi-line donor registration format
  const registrationDetailsMatch = userMessage.match(/(?:name|full name):\s*(?<name>.+)\s*city:\s*(?<city>.+)\s*blood group:\s*(?<blood_group>.+)/is);
  if (registrationDetailsMatch) {
    console.log(`✅ Message handled by: Donor Registration Details Parser.`);
    await registrationService.completeDonorRegistration(from, registrationDetailsMatch.groups);
    return;
  }
  
  // Keyword match for DONOR registration
  const isDonorRequest = lowerUserMessage.includes('donor') || lowerUserMessage.includes('donate');
  if (lowerUserMessage.includes('register') && isDonorRequest && !lowerUserMessage.includes('patient')) {
    console.log(`✅ Message handled by: Donor Registration keyword.`);
    await registrationService.handleNewDonor({}, from);
    return;
  }

  // Keyword match for PATIENT registration
  if ((lowerUserMessage.includes('register') && lowerUserMessage.includes('patient')) || lowerUserMessage.includes('help for a thalassemia patient')) {
    console.log(`✅ Message handled by: Patient Registration keyword.`);
    await patientService.handleNewPatient({}, from);
    return;
  }

  // Conversational flows and standard replies
  if (await patientService.processOnboardingReply(userMessage, from)) return;
  if (lowerUserMessage === 'apply' && await patientService.startApplication(from)) return;
  if (/^\d{6}$/.test(userMessage)) { await responseService.verifyOTPAndConfirm(from, userMessage); return; }
  if (lowerUserMessage === 'no') { await responseService.handleSimpleDecline(from); return; }
  const responseMatch = userMessage.match(/^(?:YES)\s+(\d{4})$/i);
  if (responseMatch) { await responseService.handleDonorReplyWithShortCode(from, responseMatch[1]); return; }
  if (lowerUserMessage === 'yes') {
    const { rows: [userWithCode] } = await db.query("SELECT last_request_short_code FROM users WHERE phone = $1", [from]);
    if (userWithCode && userWithCode.last_request_short_code) {
        await responseService.handleDonorReplyWithShortCode(from, userWithCode.last_request_short_code);
        return;
    }
  }

  // Demo commands
  if (lowerUserMessage.startsWith('/demo')) {
    console.log('DEMO MODE ACTIVATED');
    if (lowerUserMessage === '/demo nudge') {
        await triggerInactiveDonorNudges();
        await whatsappService.sendTextMessage(from, `🎬 Executed Inactive Donor Nudge.`);
    } else if (lowerUserMessage === '/demo bridge_request') {
        await triggerAutomaticBridgeRequests();
        await whatsappService.sendTextMessage(from, `🎬 Executed Automatic Bridge Requests.`);
    } else {
        await whatsappService.sendTextMessage(from, `Unknown demo command.`);
    }
    return;
  }

  // --- PRIORITY 2: AI-Powered Intent Routing (with context) ---
  console.log(`No direct keyword match found. Routing to AI with conversation context...`);
  const { rows: [user] } = await db.query('SELECT role FROM users WHERE phone = $1', [from]);
  const userRole = user ? user.role : 'Unregistered';
  
  const { rows: historyRows } = await db.query(
    `SELECT message, response FROM conversations WHERE user_phone = $1 ORDER BY created_at DESC LIMIT 3`,
    [from]
  );
  
  const chatHistory = historyRows.reverse().flatMap(row => [
    { role: 'user', parts: [{ text: row.message }] },
    ...(row.response ? [{ role: 'model', parts: [{ text: row.response }] }] : [])
  ]);

  const route = await aiRouterService.routeMessageWithContext(userMessage, userRole, chatHistory);
  
  if (route && route.tool) {
    console.log(`AI routed to tool: ${route.tool}`);
    switch (route.tool) {
      case 'handle_emergency_request':
        await emergencyService.handleEmergencyRequest(userMessage, from);
        break;
      case 'handle_donor_registration':
        await registrationService.handleNewDonor(route.params, from);
        break;
      case 'handle_patient_onboarding':
        await patientService.handleNewPatient(route.params, from);
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
      case 'handle_join_bridge_request': {
        const msg = await bridgeService.addDonorToBridgeByPhone(from);
        await whatsappService.sendTextMessage(from, msg);
        break;
      }
      case 'handle_snooze_request':
        await donorPreferenceService.handleSnooze(from, route.params);
        break;
      default:
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
  res.sendStatus(200);

  try {
    const messageData = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!messageData) {
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