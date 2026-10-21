// Shared, deterministic transaction filtering. The UI decides only how to render it.
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
].sort((a, b) => {
  const dateOrder = String(b.date || '').localeCompare(String(a.date || ''));
  return dateOrder || a.stableTransactionKey.localeCompare(b.stableTransactionKey);
});

export const filterTransactions = (transactions, { type = 'all', month = 'all', search = '' } = {}) => {
  const query = search.trim().toLowerCase();
  return transactions.filter((item) => {
    if (type !== 'all' && item.transactionKind !== type) return false;
    if (month !== 'all' && transactionMonthKey(item.date) !== month) return false;
    if (!query) return true;
    return [item.name, item.title, item.description, item.category, item.type, item.amount, item.date]
      .some((value) => String(value ?? '').toLowerCase().includes(query));
  });
};

export const transactionMonthOptions = (transactions, now = new Date()) => {
  const months = new Set(transactions.map((item) => transactionMonthKey(item.date)).filter(Boolean));
  // Keep the recent months available even when a month has no records.
  const current = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let offset = 0; offset < 12; offset += 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - offset, 1);
    months.add(date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0'));
  }
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
