// backend/src/services/translationService.js
// In a real application, this would connect to a service like Google Translate.
// For this project, we are mocking the translation for a few specific phrases.
class TranslationService {
  async translateToEnglish(text) {
    if (text.includes("कैसे पंजीकरण") || text.includes("रक्तदान कैसे करें")) {
      console.log('Translation Mock: Detected Hindi registration query.');
      return "How can I register to donate blood?";
    }
    if (text.includes("నమోదు") || text.includes("ఎలా నమోదు")) {
        console.log('Translation Mock: Detected Telugu registration query.');
        return "How can I register to donate blood?";
    }
    // If no match is found, return the original text.
    return text;
  }
}

export default new TranslationService();