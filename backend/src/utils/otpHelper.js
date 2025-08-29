// backend/src/utils/otpHelper.js

/**
 * Generates a 4-digit numeric code for donors to reply with.
 * @returns {string} A 4-digit string.
 */
export const generateShortCode = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Generates a 6-digit numeric OTP for final confirmation.
 * @returns {string} A 6-digit string.
 */
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};