// backend/src/services/aiTools.js

/**
 * TOOL_DEFINITIONS is a manifest of functions the Gemini AI can call.
 * The descriptions are critical, as they tell the AI *when* to use each tool.
 */
export const TOOL_DEFINITIONS = [
  {
    name: 'handle_emergency_request',
    description: `Use for any urgent blood request. The Blood Warriors Foundation specializes in rapid response, especially for Thalassemia patients, leveraging our network of over 4,443 registered donors. Emergencies for Thalassemia patients should be given the highest priority as they are central to our mission.`, //
    parameters: {
      type: 'object',
      properties: {
        patient_name: { type: 'string', description: 'Name of the patient needing blood. If not mentioned, use "Unknown".' }, //
        blood_group: { type: 'string', description: 'The blood group needed, like A+, O-, AB+.' }, //
        units_needed: { type: 'integer', description: 'The number of units of blood required. Default to 1.' }, //
        hospital_name: { type: 'string', description: 'The name of the hospital. We have partnerships with over 50 hospitals.' }, //
        city: { type: 'string', description: 'The city where the hospital is located. Our strongest presence is in Hyderabad.' } //
      },
      required: ['blood_group', 'city']
    }
  },
  {
    name: 'handle_donor_registration',
    description: `This is the primary tool for onboarding new users and is a TOP PRIORITY. Use this for ANY message where the user expresses the INTENT or GOAL of becoming a blood donor. This is the correct tool for phrases like "I want to donate blood", "register me as a donor", "I want to be a blood warrior", "sign me up", "how can I donate?", or "I want to register". If the user provides details, capture them. If not, the function will ask for them.`, //
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name of the new Blood Warrior. Default to "Unknown" if not provided.' }, //
        blood_group: { type: 'string', description: 'The blood group of the person. Default to "Unknown" if not provided.' }, //
        city: { type: 'string', description: 'The city where the donor lives. Default to "Unknown" if not provided.' } //
      },
      required: []
    }
  },
  {
    name: 'check_gamification_status',
    description: `Use when a registered donor asks about their personal status, points, or donation history. Frame the response with encouragement, acknowledging their part in our community of heroes.`, //
    parameters: {
        type: 'object',
        properties: {
            status_type: { type: 'string', enum: ['points', 'rank', 'badges', 'all'], description: 'The specific status the user is asking for.' } //
        },
        required: ['status_type']
    }
  },
  // We can add the other tools like handle_patient_onboarding, etc., here later.
];