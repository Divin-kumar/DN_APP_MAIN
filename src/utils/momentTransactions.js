import { mergeFinancialExpenses, mergeFinancialRecords } from './financialRecords.js';
import { sortTransactions, toTransactions } from './transactionFilters.js';
import { momentRecordId } from './scopedRecordActions.js';
import { recordId } from './recordIdentity.js';
import { activityOwnsLinkedId } from './activityEntries.js';

// Stores already select typed documents before unified legacy documents. Merge
// the complete ledgers BEFORE filtering a Moment, then add nested-only expenses
// last. Filtering first would resurrect a lower-precedence duplicate elsewhere.
export const projectMomentTransactions = (moments, incomes, expenses, eventId) => {
  const nested = moments.flatMap((moment) => (moment.activities || []).flatMap((activity) => (activity.expenses || [])
    .map((expense) => ({ ...expense, eventId: expense.eventId || momentRecordId(moment), activityId: expense.activityId || activity.id }))));
  const transactions = toTransactions(mergeFinancialRecords(incomes, 'income'), mergeFinancialExpenses([...expenses, ...nested]));
  const moment = moments.find((item) => momentRecordId(item) === recordId(eventId));
  return sortTransactions(transactions.filter((item) => recordId(item.eventId) === recordId(eventId)).map((item) => ({ ...item,
    eventTitle: moment?.name || '', activityTitle: moment?.activities?.find((activity) => activityOwnsLinkedId(activity, item.activityId))?.title || '',
  })), 'date-desc');
};
