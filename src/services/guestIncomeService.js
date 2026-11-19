/* Shared income normalization and Guest-local persistence. */
import { upsertRecord } from '../utils/transactionRelations';
import { normalizeFinancialRecord } from '../utils/financialRecords.js';

const GUEST_INCOMES_KEY = 'dn_guest_incomes';

export const normalizeIncome = (item, fallbackId = '') => normalizeFinancialRecord(item, 'income', fallbackId);

export const getGuestIncomes = () => {
  try {
    const raw = localStorage.getItem(GUEST_INCOMES_KEY) || '[]';
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Guest income storage is invalid; no changes were made.');
    return parsed.map((item) => normalizeIncome(item));
  } catch (error) {
    console.error('Failed to load guest incomes:', error);
    throw error;
  }
};

export const setGuestIncomes = (items) => {
  localStorage.setItem(GUEST_INCOMES_KEY, JSON.stringify(items));
};

export const saveGuestIncome = (income) => {
  const next = upsertRecord(getGuestIncomes(), normalizeIncome(income));
  setGuestIncomes(next);
  return next;
};

export const removeGuestIncome = (incomeId) => {
  const list = getGuestIncomes().filter((item) => item.id !== incomeId);
  setGuestIncomes(list);
  return list;
};
