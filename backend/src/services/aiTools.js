// backend/src/services/aiTools.js

/**
 * TOOL_DEFINITIONS is a manifest of functions the Gemini AI can call.
 * This is for the original, non-LangChain aiRouterService.
 * The descriptions are critical, as they tell the AI *when* to use each tool.
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'handle_emergency_request',
    description: `Use for any urgent blood request. The message may contain details like blood group, city, or hospital. Extract these if present.`,
    parameters: {
      type: 'object',
      properties: {
        patient_name: { type: 'string', description: 'Name of the patient needing blood. If not mentioned, use "Unknown".' },
        blood_group: { type: 'string', description: 'The blood group needed, like A+, O-, AB+.' },
        city: { type: 'string', description: 'The city where the hospital is located.' }
      },
      required: ['blood_group', 'city']
    }
  },
  {
    name: 'handle_donor_registration',
    description: `Use this ONLY for messages where the user explicitly states they want to perform the ACTION of registering. This is the correct tool for phrases like "I want to donate blood", "register me as a donor", "sign me up", or "I want to become a Blood Warrior". DO NOT use this for general questions about donation requirements.`,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name of the new donor. Default to "Unknown" if not provided.' },
        blood_group: { type: 'string', description: 'The blood group of the person. Default to "Unknown" if not provided.' },
        city: { type: 'string', description: 'The city where the donor lives. Default to "Unknown" if not provided.' }
      },
      required: []
    }
  },
  {
    name: 'handle_snooze_request',
    description: 'Use when a donor wants to temporarily pause notifications. It can understand durations like "a month", "10 days", "2 weeks".',
    parameters: {
      type: 'object',
      properties: {
        duration: { type: 'integer', description: 'The number value for the duration (e.g., 10 for "10 days").' },
        unit: { type: 'string', enum: ['day', 'week', 'month'], description: 'The unit of time for the snooze.' }
      },
      required: ['duration', 'unit']
    }
  },
   {
    name: 'get_my_dashboard',
    description: 'Use this when a registered donor asks for their personal status, points, badges, or "mydashboard". It requires no parameters.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_leaderboard',
    description: 'Use this when a user asks to see the "leaderboard", "top donors", or "rankings". It requires no parameters.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
];