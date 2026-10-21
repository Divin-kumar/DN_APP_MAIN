// Guard the owner-approved Finance single-screen and swipe interaction contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Finance has one Transactions view and no redundant Overview tabs or cards', () => {
  const page = read('../pages/Financials.jsx');
  assert.match(page, /<TransactionHistory\s/);
  assert.doesNotMatch(page, /<NavLink|<Link|Overview|dn-financial-tabs|dn-overview-topline/);
  assert.match(page, /hasLoadError \? null : \(!ready \|\| loadingIncome \|\| loadingExpense\)/);
  assert.match(page, /<ConfirmDialog/);
});
test('Finance supports both legacy financials URL and Transactions deep links', () => {
  const app = read('../App.jsx');
  assert.match(app, /path="financials" element=\{loadScreen\(<Financials/);
  assert.match(app, /path="financials\/transactions" element=\{loadScreen\(<Financials/);
  assert.match(app, /path="financials\/income" element=\{<Navigate to="\/financials\/transactions"/);
  assert.match(app, /path="financials\/expenses" element=\{<Navigate to="\/financials\/transactions"/);
});
test('transaction cards reveal Edit and Delete with no overflow three-dot button', () => {
  const component = read('../components/financials/TransactionHistory.jsx');
  assert.match(component, /resolveDirectionalSwipe/);
  assert.match(component, /className="dn-transaction-edit"/);
  assert.match(component, /className="dn-transaction-delete"/);
  assert.match(component, /onKeyDown=\{/);
  assert.doesNotMatch(component, /Ellipsis|dn-transaction-overflow/);
});
test('Moment card and detail header remove three-dot menu', () => {
  const events = read('../pages/Events.jsx');
  const hero = read('../features/events/components/EventWorkspaceShell.jsx');
  assert.doesNotMatch(events, /EventActionMenu/);
  assert.doesNotMatch(hero, /EventActionMenu/);
  assert.match(events, /<SwipeActionCard/);
  assert.match(hero, /<SwipeActionCard as="section"/);
  assert.match(read('../components/events/ActivityList.jsx'), /event-activity-actions-delete/);
  assert.match(read('../pages/CodeLists.jsx'), /code-list-actions-delete/);
});
test('Flat Moment list removes timeline rail and dots, Grid selector remains', () => {
  assert.match(read('../pages/Events.jsx'), /life-journey-cards/);
  assert.match(read('../design-system.css'), /border-left:0 !important/);
  assert.match(read('../design-system.css'), /event-story-card::before \{ display:none !important/);
});
test('Finance separates left Edit and right Delete', () => {
  const c = read('../components/financials/TransactionHistory.jsx');
  assert.match(c, /dn-transaction-actions-other/);
  assert.match(c, /dn-transaction-actions-delete/);
  assert.match(c, /resolveDirectionalSwipe/);
});
test('Finance retains top income, expense and balance without restoring an Overview tab', () => {
  const page = read('../pages/Financials.jsx');
  assert.match(page, /summarizeTransactions\(/);
  assert.match(page, /filterTransactions\(allTransactions, \{ month: filters\.month \}\)/);
  for (const label of ['Income','Expense','Balance']) assert.match(page, new RegExp('> ' + label + '</span>'));
  assert.match(page, /className="dn-finance-summary-grid"/);
  assert.doesNotMatch(page, /<NavLink|dn-financial-tabs/);
});
test('Transaction form chooses a Moment before showing Moment-scoped activities', () => {
  const form = read('../components/financials/TransactionForm.jsx');
  assert.match(form, /aria-label="Linked Moment"/);
  assert.match(form, /getMomentActivities\(events, form\.eventId\)/);
  assert.match(form, /activityId: eventId === current\.eventId \? current\.activityId : ''/);
  assert.match(form, /disabled=\{busy \|\| !form\.eventId \|\| !selectedMomentExists\}/);
  assert.doesNotMatch(form, /events\.flatMap/);
});

test('linked Moment label displays even without an activity and swipe Delete remains explicit', () => {
  const card = read('../components/financials/TransactionHistory.jsx');
  assert.match(card, /transaction\.eventId \? <small>Moment: \{eventTitle\}<\/small>/);
  assert.match(card, /activityTitle \? <small>Activity: \{activityTitle\}<\/small>/);
  assert.match(card, /onDelete\(transaction\)/);
  assert.match(card, /className="dn-transaction-delete"/);
});
test('moment-only expenses can be deleted without requiring an expired activity mirror', () => {
  const manager = read('../hooks/useTransactionManager.js');
  assert.match(manager, /if \(original\.activityId\) requireLinkedActivity/);
  assert.match(manager, /await updateMirrors\(original, null\)/);
  assert.match(manager, /await deleteExpenseItem\(uid, isGuest, id\)/);
});
