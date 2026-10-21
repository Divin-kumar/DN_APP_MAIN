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
  assert.match(component, /resolveTransactionSwipe/);
  assert.match(component, /className="dn-transaction-edit"/);
  assert.match(component, /className="dn-transaction-delete"/);
  assert.match(component, /onKeyDown=\{/);
  assert.doesNotMatch(component, /Ellipsis|dn-transaction-overflow/);
});
test('Events keep their five-action overflow; other swipe lists retain Delete in left tray', () => {
  const actions = read('../components/events/EventActionMenu.jsx');
  for (const name of ['Edit','Duplicate','Share','Archive','Delete']) {
    assert.match(actions, new RegExp("label: .*" + name));
  }
  const activities = read('../components/events/ActivityList.jsx');
  assert.match(activities, /className="event-activity-actions event-activity-actions-other"/);
  assert.doesNotMatch(activities, /className="event-activity-actions event-activity-actions-delete"/);
  const lists = read('../pages/CodeLists.jsx');
  assert.match(lists, /className="code-list-actions code-list-actions-other"/);
  assert.doesNotMatch(lists, /className="code-list-actions code-list-actions-delete"/);
});
