// backend/src/services/whatsappService.js
import axios from 'axios';
import config from '../config/config.js';

class WhatsAppService {
  constructor() {
    this.token = config.whatsappToken;
    this.phoneNumberId = config.whatsappPhoneNumberId;

    if (!this.token || !this.phoneNumberId) {
      console.warn('WhatsApp token or Phone Number ID are missing from configuration. Messages will not be sent.');
    }

    this.client = axios.create({
      baseURL: `https://graph.facebook.com/v18.0/${this.phoneNumberId}`,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Sends a text message.
   * @param {string} to - The recipient's phone number (e.g., '918000000000').
   * @param {string} text - The message body.
   */
  async sendTextMessage(to, text) {
    if (!this.token) return { success: false, error: "WhatsApp service not configured." };

    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'text',
      text: { body: text }
    };
    try {
      const response = await this.client.post('/messages', payload);
      console.log(`✅ Message sent successfully to ${to}.`);
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`🔴 FAILED to send message to ${to}.`);
      if (error.response) {
        console.error(`Error Details: ${error.response.data.error?.message}`);
      }
      return { success: false, error: error.message };
    }
  }
}

export default new WhatsAppService();