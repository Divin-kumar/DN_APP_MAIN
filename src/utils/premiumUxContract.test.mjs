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
  assert.match(read('../components/financials/TransactionHistory.jsx'), /All income and expenses/);
});

test('finance density has one-row totals and a single compact transaction heading', () => {
  const page = read('../pages/Financials.jsx');
  const history = read('../components/financials/TransactionHistory.jsx');
  const css = read('../design-system.css');
  assert.match(page, /aria-label=\{`Financial totals for/);
  assert.doesNotMatch(page, /className="dn-finance-summary-period"/);
  assert.match(history, /className="dn-transactions-heading-copy"/);
  assert.match(history, /<p title="All income and expenses in one place">All income and expenses<\/p>/);
  assert.match(history, /<span>Add Transaction<\/span>/);
  assert.match(css, /\.dn-finance-summary-grid \{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\) !important/);
  assert.match(css, /\.dn-transactions-page \.transactions-heading \{[\s\S]*?grid-template-columns:minmax\(0,1fr\) auto/);
  assert.match(css, /\.dn-transactions-page \.dn-transactions-heading-copy p \{[\s\S]*?white-space:nowrap/);
});
test('Moment hero places compact Memory and Greeting beside the left type label', () => {
  const hero = read('../features/events/components/EventWorkspaceShell.jsx');
  const css = read('../design-system.css');
  const topStart = hero.indexOf('<div className="event-moment-topline">');
  const topEnd = hero.indexOf('<div className="event-moment-content">', topStart);
  const topline = hero.slice(topStart, topEnd);
  assert.match(topline, /event-moment-kicker/);
  assert.match(topline, /event-moment-memory-action/);
  assert.match(topline, /event-moment-copy-action/);
  assert.doesNotMatch(hero.slice(topEnd, hero.indexOf('<h1>', topEnd)), /event-moment-kicker/);
  assert.match(css, /\.dn-moment-hero-swipe \.event-moment-topline \{[\s\S]*?justify-content:space-between !important/);
  assert.match(css, /\.dn-moment-hero-swipe \.event-moment-top-actions \.event-moment-memory-action,[\s\S]*?min-height:44px !important/);
});

test('compact transaction panel padding applies to the panel element itself', () => {
  const css = read('../design-system.css');
  assert.match(css, /\.transactions-panel\.dn-transactions-page \{ padding:12px !important/);
  assert.doesNotMatch(css, /\.dn-transactions-page \.transactions-panel \{ padding:12px !important/);
});

test('mobile editors avoid Safari focus zoom across forms without inflating other controls', () => {
  const css = read('../design-system.css');
  const marker = css.lastIndexOf('iOS Safari form-focus zoom prevention');
  assert.ok(marker > 0);
  const rule = css.slice(marker);
  assert.match(rule, /@media screen and \(max-width: 1024px\)/);
  assert.match(rule, /html\[data-theme\] input:not\(\[type="checkbox"\]\)/);
  for (const excluded of ['radio','range','file','color','hidden','button','submit','reset']) {
    assert.ok(rule.includes(`:not([type="${excluded}"])`), `Expected ${excluded} to be excluded`);
  }
  assert.match(rule, /html\[data-theme\] textarea/);
  assert.match(rule, /html\[data-theme\] select/);
  assert.match(rule, /html\[data-theme\] \[contenteditable="true"\]/);
  assert.match(rule, /font-size: 16px !important/);
  assert.equal(rule.indexOf('font-size: 16px !important'), rule.lastIndexOf('font-size: 16px !important'));
  assert.ok(css.indexOf('v2.15.4: iPhone Safari Greeting Template', marker) > marker,
    'The general mobile editor floor must precede targeted field overrides');
  const financeForm = read('../components/financials/TransactionForm.jsx');
  assert.match(financeForm, /<input type="text"/);
  assert.match(financeForm, /<input type="number"/);
  assert.match(financeForm, /<textarea/);
  const picker = read('../components/common/DropdownSelect.jsx');
  assert.match(picker, /<input ref=\{searchRef\} type="search"/);
});
test('viewport permits pinch zoom and never disables user scaling to hide focus zoom', () => {
  const html = read('../../index.html');
  assert.match(html, /name="viewport"/);
  assert.match(html, /width=device-width, initial-scale=1/);
  assert.doesNotMatch(html, /maximum-scale|user-scalable|minimum-scale/i);
});

test('Moment type Greeting Template keeps a 16px editor font on mobile despite older high-specificity rule', () => {
  const source = read('../pages/CodeLists.jsx');
  const css = read('../design-system.css');
  const original = css.indexOf('html[data-theme] .moment-type-form input:not([type="checkbox"]):not([type="radio"])');
  const patch = css.lastIndexOf('v2.15.4: iPhone Safari Greeting Template anti-zoom specificity repair');
  assert.ok(original >= 0 && patch > original, 'The stronger mobile override must follow the 14px Moment field rule');
  assert.match(source, /className="moment-type-form"/);
  assert.match(source, /<span>Greeting Template<\/span>\s*<textarea/);
  const override = css.slice(patch);
  assert.match(override, /@media screen and \(max-width: 1024px\)/);
  assert.match(override, /html\[data-theme\] \.moment-type-form input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\)/);
  assert.match(override, /html\[data-theme\] \.moment-type-form select/);
  assert.match(override, /html\[data-theme\] \.moment-type-form textarea/);
  assert.match(override, /html\[data-theme\] \.settings-greeting-editor-grid textarea/);
  assert.match(override, /font-size: 16px !important/);
  assert.ok(css.indexOf('v2.15.5 completion', patch) > patch,
    'The targeted Moment overrides must precede the remaining compact search-field overrides');
});
test('the final iPhone anti-zoom correction does not restrict viewport magnification', () => {
  const html = read('../../index.html');
  assert.match(html, /width=device-width, initial-scale=1/);
  assert.doesNotMatch(html, /maximum-scale|user-scalable|minimum-scale/i);
  const css = read('../design-system.css');
  assert.match(css, /--font-body: 14px/);
  // Buttons, labels and previews still use the compact typography token.
  assert.doesNotMatch(css.slice(css.lastIndexOf('v2.15.4: iPhone Safari Greeting Template')), /\bbutton\b|\.settings-preview-box/);
});

test('compact search and editor fields cannot reintroduce sub-16px mobile zoom', () => {
  const css = read('../design-system.css');
  const guard = css.lastIndexOf('v2.15.5 completion');
  const base = css.indexOf('iOS Safari form-focus zoom prevention');
  const moment = css.lastIndexOf('v2.15.4: iPhone Safari Greeting Template');
  assert.ok(guard > moment && moment > base);
  const cssGuard = css.slice(guard);
  for (const selector of [
    '.event-search input',
    '.activity-search-field input',
    '.insights-tools input',
    '.code-list-add-row input',
    '.settings-tag-input-row input',
    '.activity-event-search input',
  ]) {
    assert.ok(cssGuard.includes('html[data-theme] ' + selector), selector + ' should have a mobile font floor');
  }
  assert.match(cssGuard, /@media screen and \(max-width: 1024px\)/);
  assert.match(cssGuard, /font-size: 16px !important/);
  assert.doesNotMatch(cssGuard, /maximum-scale|user-scalable|\bbutton\b/);
});
