// backend/src/services/faqService.js
import db from '../config/db.js';
import whatsappService from './whatsappService.js';
import mlService from './mlService.js'; // Use the mlService client

const SENSITIVE_KEYWORDS = ['problem', 'pain', 'issue', 'bad', 'reaction', 'scared', 'help me', 'confused', 'afraid'];

class FaqService {
  async handleFaq(query, phone) {
    console.log(`Getting RAG-powered FAQ answer for: "${query}"`);
    const disclaimer = "\n\n_Disclaimer: This is automated information. For medical advice, please consult a doctor._";
    
    try {
      const response = await mlService.client.post('/generate-faq-answer', { query });
      let answer = response.data?.answer || "Sorry, I couldn't find an answer to that question.";
      answer += disclaimer;
      await whatsappService.sendTextMessage(phone, answer);

      const lowerQuery = query.toLowerCase();
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