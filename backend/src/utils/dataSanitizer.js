// backend/src/utils/dataSanitizer.js
export const normalizeBloodGroup = (group) => {
  if (!group) return 'Unknown';
  const upperGroup = group.toUpperCase();
  let normalized = upperGroup.replace(/\s/g, '').replace('POSITIVE', '+').replace('NEGATIVE', '-');
  if (normalized.endsWith('POS')) normalized = normalized.replace('POS', '+');
  if (normalized.endsWith('NEG')) normalized = normalized.replace('NEG', '-');
  return normalized.slice(0, 5);
};