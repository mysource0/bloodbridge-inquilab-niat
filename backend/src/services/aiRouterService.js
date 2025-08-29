// backend/src/services/aiRouterService.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TOOL_DEFINITIONS } from './aiTools.js';
import config from '../config/config.js';

/**
 * This service acts as the central "brain" for the chatbot.
 * It takes a user's message and uses the Gemini AI with function-calling
 * to determine the user's intent and extract relevant information.
 */
class AIRouterService {
  constructor() {
    if (!config.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not set in the environment variables."); //
    }
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey); //
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash-latest',
      tools: { functionDeclarations: TOOL_DEFINITIONS } //
    });
  }

  /**
   * Routes a user's message to the appropriate tool using the AI model.
   * @param {string} userMessage - The message from the user.
   * @param {string} userRole - The role of the user (e.g., 'Admin', 'Unregistered').
   * @returns {Promise<{tool: string, params: object}|null>} The decided tool and its parameters, or null if no tool is called.
   */
  async routeMessageWithContext(userMessage, userRole) {
    const systemPrompt = `You are "Bridge AI" 🌉, an operational AI assistant. Your primary goal is to understand the user's message and call the appropriate function. The user's role is "${userRole}". Prioritize action-oriented tasks.`; //
    
    const chatHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. Ready to assist." }] }, //
    ];
    
    try {
      const chat = this.model.startChat({ history: chatHistory }); //
      const result = await chat.sendMessage(userMessage); //
      const call = result.response.functionCalls()?.[0];
      
      if (call) {
        console.log(`AI decided to call tool: ${call.name} with params:`, call.args);
        return { tool: call.name, params: call.args }; //
      }
      console.log("AI did not call a specific tool for this message.");
      return null;

    } catch (error) {
      console.error('Error routing message with Gemini:', error.message); //
      return null;
    }
  }
}

// Export a single instance of the class
export default new AIRouterService();