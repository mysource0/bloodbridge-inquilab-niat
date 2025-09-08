// backend/src/services/whatsappService.js
import axios from 'axios';
import config from '../config/config.js';
import loggingService from './loggingService.js';

class WhatsAppService {
  constructor() {
    this.token = config.whatsappToken;
    this.phoneNumberId = config.whatsappPhoneNumberId;
    if (!this.token || !this.phoneNumberId) {
      console.warn('WhatsApp token or Phone Number ID are missing. Messages will not be sent.');
    }

    this.client = axios.create({
      baseURL: `https://graph.facebook.com/v18.0/${this.phoneNumberId}`,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });
  }
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
      
      // ✅ MODIFIED LINE: This now prints the message content to the console.
      console.log(`✅ Message sent to ${to}: "${text}"`);
      
      await loggingService.logOutgoing(to, text);
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`🔴 FAILED to send message to ${to}.`);
      if (error.response) {
        console.error(`Error Details: ${error.response.data.error?.message}`);
      }
      return { success: false, error: error.message };
    }
  }

    /**
   * ✅ NEW FUNCTION
   * Sends an interactive message with reply buttons.
   * @param {string} to - The recipient's phone number.
   * @param {string} text - The message body.
   * @param {Array<object>} buttons - Array of button objects, e.g., [{ id: '1', title: 'Yes' }]
   */
  async sendInteractiveMessage(to, text, buttons) {
    if (!this.token) return { success: false, error: "WhatsApp service not configured." };

    const payload = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: text },
        action: {
          buttons: buttons.map(btn => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title }
          }))
        }
      }
    };
    
    try {
      const response = await this.client.post('/messages', payload);
      console.log(`✅ Interactive message sent to ${to}: "${text}"`);
      await loggingService.logOutgoing(to, text); // Also log this message
      return { success: true, data: response.data };
    } catch (error) {
      console.error(`🔴 FAILED to send interactive message to ${to}.`);
      if (error.response) {
        console.error(`Error Details: ${error.response.data.error?.message}`);
      }
      return { success: false, error: error.message };
    }
  }

}

export default new WhatsAppService();