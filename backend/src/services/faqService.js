// backend/src/services/faqService.js
import db from '../config/db.js';
import whatsappService from './whatsappService.js';
import mlService from './mlService.js';
import { GoogleGenerativeAI } from '@google/generative-ai'; // ✅ ADDED: Import Google AI SDK
import config from '../config/config.js'; // ✅ ADDED: Import config for API key

// ✅ ADDED: Initialize the generative model for dynamic answers
const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

const SENSITIVE_KEYWORDS = ['problem', 'pain', 'issue', 'bad', 'reaction', 'scared', 'help me', 'confused', 'afraid'];

class FaqService {
  async handleFaq(query, phone) {
    const disclaimer = "\n\n_Disclaimer: This is automated information. For medical advice, please consult a doctor._";
    try {
      // 1. First, try the RAG system for a precise, pre-written answer.
      const ragResponse = await mlService.client.post('/generate-faq-answer', { query });

      if (ragResponse.data && ragResponse.data.source_found) {
        console.log(`RAG HIT: Found a precise answer for "${query}".`);
        await whatsappService.sendTextMessage(phone, ragResponse.data.answer + disclaimer);
        // We can stop here because we found a perfect answer.
        return;
      }

      // 2. ✅ NEW: If RAG fails, fallback to the generative model with live data.
      console.log(`RAG MISS: Falling back to generative model with live data for "${query}".`);
      
      let contextString = 'You are a helpful and compassionate assistant for BloodBridge AI. Answer the user\'s question concisely.';
      const lowerQuery = query.toLowerCase();

      // Check for keywords and inject live data into the context.
      if (lowerQuery.includes('patient') || lowerQuery.includes('support')) {
        const { rows } = await db.query("SELECT COUNT(*) as count FROM patients WHERE status = 'bridged'");
        const patientCount = rows[0].count;
        if (patientCount > 0) {
          contextString += ` IMPORTANT CONTEXT: We are currently supporting ${patientCount} long-term patients.`;
        }
      } else if (lowerQuery.includes('donor') || lowerQuery.includes('donors')) {
        const { rows } = await db.query("SELECT COUNT(*) as count FROM users WHERE user_type = 'donor' AND availability_status = 'available'");
        const donorCount = rows[0].count;
        if (donorCount > 0) {
          contextString += ` IMPORTANT CONTEXT: We have ${donorCount} active and eligible donors ready to help.`;
        }
      }
      
      // 3. Generate the dynamic answer using the context.
      const prompt = `${contextString}\n\nUser's Question: "${query}"`;
      const result = await generativeModel.generateContent(prompt);
      const response = await result.response;
      const aiText = response.text();

      await whatsappService.sendTextMessage(phone, aiText + disclaimer);

      // 4. Finally, check for sensitive keywords.
     if (SENSITIVE_KEYWORDS.some(keyword => lowerQuery.includes(keyword))) {
        console.log(`Sensitive keyword detected in "${query}". Escalating to admin inbox.`);
        await db.query( "INSERT INTO inbox_messages (user_phone, user_message, reason) VALUES ($1, $2, $3)", [phone, query, 'Sensitive Keyword Detected']);
        const escalationMessage = "It sounds like you might have a specific concern. I have notified an NGO volunteer, and they will contact you on this number shortly.";
        setTimeout(() => { whatsappService.sendTextMessage(phone, escalationMessage); }, 1500);
      }

    } catch (error) {
      console.error("Error calling FAQ service:", error.message);
      const fallbackMessage = "Thank you for your question. An NGO volunteer will get back to you shortly.";
      await whatsappService.sendTextMessage(phone, fallbackMessage);
    }
  }
}

export default new FaqService();