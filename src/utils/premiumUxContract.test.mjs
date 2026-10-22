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
  assert.match(component, /<SwipeActionCard/);
  assert.match(component, /label: 'Edit'/);
  assert.match(component, /onDelete=\{\(\) => onDelete\(transaction\)\}/);
  assert.match(read('../components/common/SwipeActionCard.jsx'), /onKeyDown=\{handleCardKey\}/);
  assert.doesNotMatch(component, /Ellipsis|dn-transaction-overflow/);
});
test('Moments, Activities, Transactions, Code Lists use one compact portaled popup', () => {
  for (const path of [
    '../pages/Events.jsx',
    '../features/events/components/EventWorkspaceShell.jsx',
    '../components/financials/TransactionHistory.jsx',
    '../components/events/ActivityList.jsx',
    '../pages/CodeLists.jsx',
  ]) {
    const src = read(path);
    assert.match(src, /<SwipeActionCard/);
    assert.doesNotMatch(src, /EventActionMenu/);
  }
  const surface = read('../components/common/SwipeActionCard.jsx');
  assert.match(surface, /createPortal\(/);
  assert.match(surface, /className="dn-swipe-popup"/);
  assert.match(surface, /role="menu"/);
  assert.match(surface, /aria-label=\{\`Actions for/);
  assert.match(surface, /onTouchStartCapture=/);
  assert.match(surface, /onTouchEndCapture=/);
  assert.match(surface, /onPointerDownCapture=/);
  assert.match(surface, /onPointerUpCapture=/);
  assert.match(surface, /onClickCapture=/);
  assert.match(surface, /\!resolveSwipeGesture\(start, \{ x, y \}\)\.action/);
  assert.match(surface, /\.\.\.\(onDelete \? \[\{ label: 'Delete'/);
  assert.doesNotMatch(surface, /dn-swipe-tray-(other|delete)|animate=\{/);
});
test('Flat Moment list removes timeline rail and dots, Grid selector remains', () => {
  assert.match(read('../pages/Events.jsx'), /life-journey-cards/);
  assert.match(read('../design-system.css'), /border-left:0 !important/);
  assert.match(read('../design-system.css'), /event-story-card::before \{ display:none !important/);
});
test('Finance card delegates Edit and Delete through the same surface', () => {
  const card = read('../components/financials/TransactionHistory.jsx');
  assert.match(card, /otherActions=\{\[\{ label: 'Edit'/);
  assert.match(card, /onDelete=\{\(\) => onDelete\(transaction\)\}/);
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
  assert.match(card, /onDelete=\{\(\) => onDelete\(transaction\)\}/);
});
test('moment-only expenses can be deleted without requiring an expired activity mirror', () => {
  const manager = read('../hooks/useTransactionManager.js');
  assert.match(manager, /if \(original\.activityId\) requireLinkedActivity/);
  assert.match(manager, /await updateMirrors\(original, null\)/);
  assert.match(manager, /await deleteExpenseItem\(uid, isGuest, id\)/);
});

test('gesture completion is shared across Moment and Transaction button targets', () => {
  const surface = read('../components/common/SwipeActionCard.jsx');
  assert.match(surface, /resolveSwipeGesture\(start/);
  assert.match(surface, /onTouchEndCapture=/);
  assert.match(surface, /onClickCapture=/);
});
test('Finance totals stay in one row and Code Lists keep the label in place', () => {
  const css = read('../design-system.css');
  assert.match(css, /\.dn-finance-summary-grid \{ grid-template-columns:repeat\(3,minmax\(0,1fr\)\) !important/);
  assert.match(css, /\.code-list-item \.code-list-row,[\s\S]*?transform:none !important/);
});

test('nested Activity and Moment buttons do not open swipe trays', () => {
  const surface = read('../components/common/SwipeActionCard.jsx');
  assert.match(surface, /event\.target\.closest\('button, a, input, select, textarea'\)/);
  assert.match(surface, /!event\.target\.closest\('\.code-list-row'\)/);
  assert.match(read('../components/events/ActivityList.jsx'), /className="event-activity-expense-toggle"/);
});

test('either direction reveals same menu and Delete remains a separate click', () => {
  const swipe = read('../components/common/SwipeActionCard.jsx');
  assert.match(swipe, /if \(!resolveSwipeGesture\(start, \{ x, y \}\)\.action\) return/);
  assert.match(swipe, /showMenu\(isTouch\)/);
  assert.match(swipe, /onClick=\{\(\) => perform\(onClick\)\}/);
  assert.match(swipe, /aria-label=\{\`Actions for/);
  assert.match(read('../pages/CodeLists.jsx'), /Tap or swipe either direction for actions/);
  assert.match(read('../components/financials/TransactionHistory.jsx'), /Swipe either direction on a transaction/);
});
