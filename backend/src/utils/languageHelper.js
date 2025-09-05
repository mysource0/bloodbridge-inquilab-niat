// backend/src/utils/languageHelper.js
import { franc } from 'franc';

// This utility uses a lightweight library to guess the language of a message.
export async function detectLanguage(text) {
  try {
    // franc returns a 3-letter ISO 639-3 code. 'und' means undetermined.
    const langCode = franc(text);
    if (langCode === 'und') {
      return null; // Could not determine language
    }
    // Map common 3-letter codes to 2-letter codes for simplicity
    const langMap = {
        'eng': 'en',
        'hin': 'hi', // Hindi
        'tel': 'te'  // Telugu
    };
    return langMap[langCode] || null;
  } catch (error) {
    console.error("Language detection error:", error);
    return null;
  }
}