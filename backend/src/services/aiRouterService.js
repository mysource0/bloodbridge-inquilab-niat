// backend/src/services/aiRouterService.js
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TOOL_DEFINITIONS } from './aiTools.js'; // ✅ This import MUST be in this file.
import config from '../config/config.js';

class AIRouterService {
  constructor() {
    if (!config.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    this.genAI = new GoogleGenerativeAI(config.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash-latest',
      // This line now works because TOOL_DEFINITIONS is correctly imported above.
      tools: { functionDeclarations: TOOL_DEFINITIONS }
    });
  }

  // ✅ This is the complete, context-aware version of this function.
  async routeMessageWithContext(userMessage, userRole, chatHistory = []) {
    const systemPrompt = `You are "Bridge AI", an AI assistant. Your goal is to understand the user's message in the context of the conversation and call the appropriate function. The user's role is "${userRole}".`;
    
    const fullHistory = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Understood." }] },
      ...chatHistory
    ];
    
    try {
      const chat = this.model.startChat({ history: fullHistory });
      const result = await chat.sendMessage(userMessage);
      const call = result.response.functionCalls()?.[0];
      
      if (call) {
        console.log(`AI decided to call tool: ${call.name} with params:`, call.args);
        return { tool: call.name, params: call.args };
      }
      console.log("AI did not call a specific tool for this message.");
      return null;
    } catch (error) {
      console.error('Error routing message with Gemini:', error.message);
      return null;
    }
  }
}

export default new AIRouterService();