// backend/src/services/aiTools.js

/**
 * TOOL_DEFINITIONS is a manifest of functions the Gemini AI can call.
 * The descriptions are critical, as they tell the AI *when* to use each tool.
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'handle_emergency_request',
    description: `Use for any urgent, one-time blood request. The message may contain details like blood group, city, or hospital.`,
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
    // ✅ UPDATED: This tool can now extract parameters from a detailed message.
    name: 'handle_patient_onboarding',
    description: `Use when a user wants to register a PATIENT for long-term support. This is for long-term care, not one-time emergencies. Extract the patient's name, city, and blood group if provided.`,
    parameters: {
      type: 'object',
      properties: {
        patient_name: { type: 'string', description: 'The name of the patient. Default to "the patient" if not specified.' },
        city: { type: 'string', description: 'The city where the patient needs support.' },
        blood_group: { type: 'string', description: "The patient's blood group." }
      },
      required: [] // Parameters are optional, the bot can ask for them if missing.
    }
  },
  {
    // ✅ This description is now more specific to donors.
    name: 'handle_donor_registration',
    description: `Use when a user wants to register as a DONOR or makes a generic registration request like "register me" or "create an account". Key phrases are "I want to donate", "register me as a donor", or "sign me up". Do NOT use this tool if the user mentions "patient".`,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name of the new donor. Default to "Unknown".' },
        blood_group: { type: 'string', description: 'The blood group of the person. Default to "Unknown".' },
        city: { type: 'string', description: 'The city where the donor lives. Default to "Unknown".' }
      },
      required: []
    }
  },
  {
    name: 'handle_join_bridge_request',
    description: `Use when an EXISTING registered donor specifically asks to join a "Blood Bridge". This is a rotational system for supporting a specific patient.`,
    parameters: { 
      type: 'object', 
      properties: {}
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
    description: 'Use this when a registered donor asks for their personal status, points, badges, or "mydashboard".',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_leaderboard',
    description: 'Use this when a user asks to see the "leaderboard", "top donors", or "rankings".',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
];