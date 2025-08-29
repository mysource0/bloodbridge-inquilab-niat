// backend/src/services/faqService.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import db from '../config/db.js';
import config from '../config/config.js';
import whatsappService from './whatsappService.js';

// Initialize the Generative AI client
const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const generativeModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

const SENSITIVE_KEYWORDS = ['problem', 'pain', 'issue', 'bad', 'reaction', 'scared', 'help me', 'confused', 'afraid'];

class FaqService {
  /**
   * Handles general user questions by generating a response from the AI model.
   * It enriches the AI's context with live data from our database.
   */
  async handleFaq(query, phone) {
    console.log(`Getting smart, generative FAQ answer for: "${query}"`);
    const disclaimer = "\n\n_Disclaimer: I am an AI assistant. This is not medical advice. Please consult a doctor for any health concerns._";
    try {
      let contextString = 'You are a helpful and compassionate assistant for BloodBridge AI, a blood donation NGO. Answer the user\'s question concisely and warmly.';
      const lowerQuery = query.toLowerCase();
      
      // --- Context Injection ---
      // Before calling the AI, we fetch live stats to make its answer more relevant.
      if (lowerQuery.includes('patient')) {
        const { rows } = await db.query("SELECT COUNT(*) as count FROM patients WHERE status = 'bridged'");
        contextString += ` IMPORTANT: Use this live statistic in your answer: We are currently supporting ${rows[0].count} long-term patients.`;
      } else if (lowerQuery.includes('donor')) {
        const { rows } = await db.query("SELECT COUNT(*) as count FROM users WHERE user_type = 'donor' AND availability_status = 'available'");
        contextString += ` IMPORTANT: Use this live statistic in your answer: We have ${rows[0].count} active and eligible donors.`;
      }

      const prompt = `${contextString}\n\nUser's Question: "${query}"`;
      
      const result = await generativeModel.generateContent(prompt);
      const response = await result.response;
      const aiText = response.text();
      let answer = aiText + disclaimer;
      await whatsappService.sendTextMessage(phone, answer);

      // --- Sensitive Keyword Escalation ---
      // If the query seems sensitive, create an inbox message for an admin to review.
      if (SENSITIVE_KEYWORDS.some(keyword => lowerQuery.includes(keyword))) {
        console.log(`Sensitive keyword detected. Escalating to admin inbox...`);
        await db.query(
          "INSERT INTO inbox_messages (user_phone, user_message, reason) VALUES ($1, $2, $3)",
          [phone, query, 'Sensitive Keyword Detected']
        );
        const escalationMessage = "It sounds like you might have a specific concern. I have notified an NGO volunteer, and they will contact you on this number shortly.";
        setTimeout(() => {
            whatsappService.sendTextMessage(phone, escalationMessage);
        }, 1500);
      }

    } catch (error) {
      console.error("Error generating FAQ answer with Gemini:", error);
      const fallbackMessage = "Thank you for your question. An NGO volunteer will get back to you shortly.";
      await whatsappService.sendTextMessage(phone, fallbackMessage);
    }
  }
}

export default new FaqService();