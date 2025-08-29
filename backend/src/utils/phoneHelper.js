// backend/src/utils/phoneHelper.js
export const normalizePhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  } else if (digits.length === 10) {
    return `+91${digits}`;
  }
  return `+${digits}`;
};