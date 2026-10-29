import { getCodeListItems } from './codeLists.js';

// Reads preserve historical/custom names even after their Code List is edited.
// Writes accept active configured choices or this transaction's retained value.
export const normalizePaymentMethod = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;
export const paymentMethodLabel = (value) => normalizePaymentMethod(value) || 'Not specified';
export const requirePaymentMethod = (value, configuredValues, previousValue) => {
  const normalized = normalizePaymentMethod(value);
  const choices = getCodeListItems('paymentMethods', configuredValues);
  if (!normalized || (!choices.includes(normalized) && normalized !== normalizePaymentMethod(previousValue))) {
    throw new Error('Choose an available payment method. Manage choices in Settings → Code Lists.');
  }
  return normalized;
};
