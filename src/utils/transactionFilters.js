// The transaction UI is unified; Firestore collections and guest backups remain backward-compatible.
import { plainRichText } from './richText.js';

export const transactionMonthKey = (date) => {
  if (typeof date !== 'string') return null;
  const match = /^(\d{4})-(\d{2})(?:-|$)/.exec(date);
  if (match) return Number(match[2]) >= 1 && Number(match[2]) <= 12 ? match[1] + '-' + match[2] : null;
  const parsed = new Date(date);
  if (!Number.isFinite(parsed.getTime())) return null;
  return String(parsed.getFullYear()).padStart(4, '0') + '-' + String(parsed.getMonth() + 1).padStart(2, '0');
};

export const toTransactions = (incomes = [], expenses = []) => [
  ...incomes.map((record, index) => ({
    ...record, transactionKind: 'income', stableTransactionKey: 'income:' + String(record.id || record.firestoreId || index),
  })),
  ...expenses.map((record, index) => ({
    ...record, transactionKind: 'expense', stableTransactionKey: 'expense:' + String(record.id || record.firestoreId || index),
  })),
];

export const filterTransactions = (transactions, { type = 'all', month = 'all', search = '' } = {}) => {
  const query = search.trim().toLowerCase();
  return transactions.filter((item) => {
    if (type !== 'all' && item.transactionKind !== type) return false;
    if (month !== 'all' && transactionMonthKey(item.date) !== month) return false;
    if (!query) return true;
    return [
      item.name, item.title, plainRichText(item.description), plainRichText(item.notes), item.category, item.type,
      item.amount, item.date, item.activityTitle, item.eventTitle,
    ].some((value) => String(value ?? '').toLowerCase().includes(query));
  });
};

export const transactionMonthOptions = (transactions) => {
  // A month is selectable only if a transaction actually exists there.
  const months = new Set(transactions.map((item) => transactionMonthKey(item.date)).filter(Boolean));
  return [...months].sort().reverse().map((month) => {
    const [year, number] = month.split('-').map(Number);
    const date = new Date(year, number - 1, 1);
    return {
      value: month,
      label: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      shortLabel: date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
    };
  });
};

export const sortTransactions = (transactions, sort = 'date-desc') => {
  const [field, direction] = String(sort).split('-');
  const sign = direction === 'asc' ? 1 : -1;
  return [...transactions].sort((a, b) => {
    let comparison;
    if (field === 'amount') comparison = (Number(a.amount) || 0) - (Number(b.amount) || 0);
    else if (field === 'title') comparison = String(a.name || a.title || '').localeCompare(String(b.name || b.title || ''), undefined, { sensitivity: 'base' });
    else comparison = String(a.date || '').localeCompare(String(b.date || ''));
    return sign * comparison || a.stableTransactionKey.localeCompare(b.stableTransactionKey);
  });
};

export const summarizeTransactions = (transactions) => {
  const totals = transactions.reduce((result, item) => {
    const amount = Number(item.amount);
    if (!Number.isFinite(amount)) return result;
    if (item.transactionKind === 'income') result.income += amount;
    if (item.transactionKind === 'expense') result.expense += amount;
    return result;
  }, { income: 0, expense: 0 });
  return { ...totals, balance: totals.income - totals.expense };
};

// Normalizes the unified form to existing persisted record shapes. No data migration required.
export const transactionPayload = (form) => {
  const common = {
    name: String(form.title || '').trim(),
    amount: Number(form.amount),
    date: form.date,
    description: String(form.notes || ''),
    notes: String(form.notes || ''),
    eventId: form.eventId || null,
    activityId: form.activityId || null,
  };
  if (form.transactionKind === 'income') return { ...common, type: form.category };
  if (form.transactionKind === 'expense') return { ...common, category: form.category };
  throw new Error('Select a valid transaction type.');
};
