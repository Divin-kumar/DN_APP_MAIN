import { activityTime } from './activityTime.js';
import { plainRichText } from './richText.js';

// The caller supplies the exact on-screen cohort and order. Never mutate ledgers.
export const TRANSACTION_CSV_HEADERS = Object.freeze([
  'Type', 'Date', 'Time', 'Title', 'Category', 'Amount (INR)',
  'Payment method', 'Moment', 'Activity', 'Notes',
]);
const cell = (value, numeric = false) => {
  let text = String(value ?? '');
  // Neutralize spreadsheet formula prefixes, including leading whitespace/control chars.
  if (!numeric && /^[\s\x00-\x1f]*[=+\-@]/u.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
};
export const transactionsToCsv = (transactions = [], events = []) => {
  const rows = [TRANSACTION_CSV_HEADERS];
  for (const item of transactions) {
    const moment = events.find((event) => String(event.id || event.firestoreId) === String(item.eventId || ''));
    const activity = moment?.activities?.find((entry) => String(entry.id) === String(item.activityId)
      || (entry.mergedActivityIds || []).some((id) => String(id) === String(item.activityId)));
    const amount = Number(item.amount);
    rows.push([
      item.transactionKind === 'income' ? 'Income' : 'Expense',
      item.date || '', activityTime(item), item.name || item.title || '',
      item.transactionKind === 'income' ? item.type || '' : item.category || '',
      Number.isFinite(amount) ? amount : '',
      item.paymentMethod || '', moment?.name || item.eventTitle || '',
      activity?.title || item.activityTitle || '',
      plainRichText(item.notes || item.description || ''),
    ]);
  }
  return '\uFEFF' + rows.map((row, index) => row.map((value, column) =>
    cell(value, index > 0 && column === 5)).join(',')).join('\r\n') + '\r\n';
};
