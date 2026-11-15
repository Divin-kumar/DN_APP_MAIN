import { financialDate } from './financialRecords.js';
import { parseMomentDate } from './momentDates.js';
import { transactionMonthKey } from './transactionFilters.js';

export const financeReportCategory = (item) => (
  String(item.transactionKind === 'income' ? item.type || item.category || '' : item.category || '').trim() || 'Other'
);

export const groupFinanceMonths = (transactions) => {
  const months = new Map();
  for (const item of transactions) {
    const date = financialDate(item.date);
    const key = transactionMonthKey(date);
    if (!key || !parseMomentDate(date)) continue;
    if (!months.has(key)) months.set(key, []);
    months.get(key).push({ ...item, date });
  }
  return new Map([...months].sort(([first], [second]) => second.localeCompare(first)));
};

export const financeReportCategories = (transactions) => {
  const groups = { income: new Map(), expense: new Map() };
  for (const item of transactions) {
    const category = financeReportCategory(item);
    const group = groups[item.transactionKind];
    const bucket = group.get(category) || { category, amount: 0, count: 0 };
    const amount = Number(item.amount);
    bucket.amount += Number.isFinite(amount) ? amount : 0;
    bucket.count += 1;
    group.set(category, bucket);
  }
  const sortByTotal = (group) => [...group.values()]
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
  return { income: sortByTotal(groups.income), expense: sortByTotal(groups.expense) };
};
