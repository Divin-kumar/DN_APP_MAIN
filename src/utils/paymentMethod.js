// One optional stored field for both existing income and expense collections.
// Missing/legacy values remain unclassified until the owner explicitly edits.
export const PAYMENT_METHODS = Object.freeze(['Cash', 'Online']);
export const normalizePaymentMethod = (value) =>
  typeof value === 'string' && PAYMENT_METHODS.includes(value.trim()) ? value.trim() : null;
export const paymentMethodLabel = (value) => normalizePaymentMethod(value) || 'Not specified';
export const requirePaymentMethod = (value) => {
  const normalized = normalizePaymentMethod(value);
  if (!normalized) throw new Error('Choose Cash or Online as the payment method.');
  return normalized;
};
