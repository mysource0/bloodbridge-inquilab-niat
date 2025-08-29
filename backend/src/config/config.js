// backend/src/config/config.js
import 'dotenv/config'; // Loads variables from .env into process.env

// This object maps environment variables to a clean, accessible config object.
const config = {
    port: process.env.PORT,
    jwtSecret: process.env.JWT_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    geminiApiKey: process.env.GEMINI_API_KEY,
    mlServiceUrl: process.env.ML_SERVICE_URL,
    whatsappToken: process.env.WHATSAPP_TOKEN,
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    whatsappAppSecret: process.env.WHATSAPP_APP_SECRET,
    whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
    adminDemoPhone: process.env.ADMIN_DEMO_PHONE,
    demoVerifiedPhoneNumbers: process.env.DEMO_VERIFIED_PHONE_NUMBERS
};

// This validation step ensures the application fails fast if critical secrets are missing.
// It's a crucial security and stability feature.
const requiredConfig = ['port', 'jwtSecret', 'databaseUrl'];
const missingConfig = requiredConfig.filter(key => !config[key]);

if (missingConfig.length > 0) {
    console.error(`🔴 FATAL ERROR: Missing required environment variables: ${missingConfig.join(', ')}`);
    // Exit the application with an error code.
    process.exit(1);
}

export default config;