import { test, expect } from '@playwright/test';
import { accountScope, fixtureMoments, seedGuest } from './fixtures.js';

const storageKey = (scope, list) => `dn_list_state_${encodeURIComponent(scope)}_${encodeURIComponent(list)}`;
const group = (children = []) => ({ id: 'root', kind: 'group', join: 'AND', children });
const rule = (field, operator, value) => ({ id: 'preliminary-rule', kind: 'rule', field, operator, value });
const conditionState = (condition, migrationVersion = 0) => ({ group: group([condition]), migrationVersion,
  saved: [{ id: 'existing-preset', label: 'Existing preset', group: group([condition]), favorite: true }], recent: [], history: [] });

async function openFilters(page) {
  const trigger = page.getByRole('button', { name: /^Filters(?: and sort)?(?:,|$)/ });
  await expect(trigger).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Advanced filters/i })).toHaveCount(0);
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  await expect(page.locator('.dn-conditions')).toHaveCount(1);
  return trigger;
}

async function selectOption(page, control, label) {
  await page.getByRole('combobox', { name: control, exact: true }).last().click();
  const search = page.locator('.dropdown-menu-portal input[type="search"]');
  if (await search.count()) await search.fill(label);
  await page.getByRole('option', { name: label, exact: true }).click();
}

async function addTextCondition(page, field, value) {
  await page.getByRole('button', { name: 'Add filter', exact: true }).first().click();
  await selectOption(page, 'Filter by', field);
  await page.getByRole('textbox', { name: `Value for ${field}`, exact: true }).fill(value);
  await expect(page.getByRole('button', { name: new RegExp(`Remove filter ${field} Contains ${value}`) })).toBeVisible();
}

test('all five lists migrate legacy choices once and keep the active conditions without preset or group controls', async ({ page }) => {
  test.setTimeout(60_000);
  const cases = [
    { route: '/events', legacy: 'moments', value: { category: 'Vacation' }, conditions: 'conditions:moments',
      preliminary: rule('name', 'contains', 'Weekend'), active: 3, rows: '.event-story-main', total: 2 },
    { route: '/activities', legacy: 'activities', value: { filter: 'completed', momentId: 'moment-one', momentType: 'Vacation', parentScope: 'active' },
      conditions: 'conditions:activities', preliminary: rule('activity.title', 'contains', 'Choose'), active: 5,
      rows: '.event-activity-card', total: 4 },
    { route: '/events/moment-one/activities', legacy: 'activities:moment-one', value: { filter: 'completed' },
      conditions: 'conditions:moment-activities:moment-one', preliminary: rule('title', 'contains', 'Choose'), active: 2,
      rows: '.event-activity-card', total: 3 },
    { route: '/financials', legacy: 'transactions', value: { type: 'expense', month: '2026-10' },
      conditions: 'conditions:transactions', preliminary: rule('name', 'contains', 'Room'), active: 3,
      rows: '.dn-transactions-results .dn-transaction-card', total: 4 },
    { route: '/events/moment-one/transactions', legacy: 'moment-transactions:[null,"moment-one",""]',
      value: { type: 'expense', activityId: 'shared', month: '2026-10' },
      conditions: 'conditions:moment-transactions:moment-one:all', preliminary: rule('name', 'contains', 'Room'), active: 4,
      rows: '.dn-transactions-results .dn-transaction-card', total: 3 },
  ];
  await seedGuest(page);
  await page.addInitScript((entries) => {
    if (localStorage.getItem('dn_e2e_migration_seeded')) return;
    for (const [key, value] of entries) localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem('dn_e2e_migration_seeded', 'true');
  }, cases.flatMap((item) => [
    [storageKey('guest', item.legacy), item.value],
    [storageKey('guest', item.conditions), conditionState(item.preliminary)],
  ]));

  for (const item of cases) {
    await test.step(item.route, async () => {
      await page.goto(item.route);
      const trigger = await openFilters(page);
      await expect(trigger).toHaveAttribute('aria-label', new RegExp(`${item.active} active$`));
      await expect(page.locator('.dn-condition-chip')).toHaveCount(item.active);
      await expect(page.locator(item.rows)).toHaveCount(1);
      await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).migrationVersion,
        storageKey('guest', item.conditions))).toBe(1);
      const migrated = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey('guest', item.conditions));
      const findRules = (node) => node.kind === 'rule' ? [node] : node.children.flatMap(findRules);
      expect(findRules(migrated.group)).toContainEqual(item.preliminary);
      await expect(page.getByRole('button', { name: /Save filter|Add filter group/ })).toHaveCount(0);
      await expect(page.getByRole('tab', { name: /Saved|Recent|Favorites/ })).toHaveCount(0);

      await page.getByRole('button', { name: 'Clear all', exact: true }).click();
      await expect(page.locator('.dn-condition-chip')).toHaveCount(0);
      await expect(page.locator(item.rows)).toHaveCount(item.total);
      await page.reload();
      await expect(page.locator('.dn-condition-chip')).toHaveCount(0);
      await expect(page.locator(item.rows)).toHaveCount(item.total);
      const cleared = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey('guest', item.conditions));
      expect(cleared.migrationVersion).toBe(1);
      expect(cleared.group.children).toEqual([]);
    });
  }
});

test('the last active Guest and synthetic Account filters persist separately when switching back and forth', async ({ page }) => {
  const moments = fixtureMoments();
  await seedGuest(page, { moments });
  await page.goto('/events');
  await openFilters(page);
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await addTextCondition(page, 'Moment name', 'Weekend');

  await accountScope(page, 'filter-isolation-owner', moments);
  await openFilters(page);
  await expect(page.getByRole('button', { name: /Remove filter Moment name Contains Weekend/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await addTextCondition(page, 'Moment name', 'separate');
  await expect(page.getByRole('button', { name: /Remove filter Moment name Contains separate/ })).toBeVisible();
  await expect(page.locator('.event-story-main')).toHaveCount(1);
  await expect(page.locator('.event-story-main')).toContainText('A separate Moment');

  await page.evaluate(async (moments) => {
    const app = (await import('/src/store/useAppStore.js')).default;
    const events = (await import('/src/store/useEventStore.js')).default;
    events.setState({ events: moments, loadedFor: 'guest:anonymous', activeLoadKey: 'guest:anonymous', loadedSample: null,
      activeSample: null, loading: false, error: null, scopeRevision: events.getState().scopeRevision + 1 });
    app.setState({ user: null, isGuest: true, authReady: true });
  }, moments);
  await openFilters(page);
  await expect(page.getByRole('button', { name: /Remove filter Moment name Contains Weekend/ })).toBeVisible();
  await expect(page.locator('.event-story-main')).toHaveCount(1);
  await expect(page.locator('.event-story-main')).toContainText('Weekend in Ooty');
  const saved = await page.evaluate((keys) => {
    const values = (node) => node.kind === 'rule' ? [node.value] : node.children.flatMap(values);
    return keys.map((key) => values(JSON.parse(localStorage.getItem(key)).group));
  },
    [storageKey('guest', 'conditions:moments'), storageKey('account:filter-isolation-owner', 'conditions:moments')]);
  expect(saved).toEqual([['Weekend'], ['separate']]);
  expect(await page.evaluate(() => window.__dnAccountWrites)).toEqual([]);
  await page.reload();
  await expect(page.locator('.event-story-main')).toHaveCount(1);
  await expect(page.locator('.event-story-main')).toContainText('Weekend in Ooty');
});

test('Finance totals follow only date conditions and retain full totals when an OR branch permits every date', async ({ page }) => {
  await seedGuest(page, { moments: [], incomes: [
    { id: 'oct-income', name: 'October income', amount: 1000, date: '2026-10-01', type: 'Other' },
    { id: 'sep-income', name: 'September income', amount: 500, date: '2026-09-01', type: 'Other' },
  ], expenses: [
    { id: 'oct-expense', name: 'October expense', amount: 230, date: '2026-10-20', category: 'Other' },
    { id: 'sep-expense', name: 'September expense', amount: 70, date: '2026-09-20', category: 'Other' },
  ] });
  await page.goto('/financials');
  await openFilters(page);
  await page.getByRole('button', { name: 'Add filter', exact: true }).click();
  await selectOption(page, 'Filter by', 'Date');
  await selectOption(page, 'Comparison', 'Custom range');
  await page.getByLabel('From Date', { exact: true }).fill('2026-10-01');
  await page.getByLabel('To Date', { exact: true }).fill('2026-10-31');
  await expect(page.locator('.dn-condition-chip')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add filter', exact: true }).click();
  await selectOption(page, 'Filter by', 'Type');
  await selectOption(page, 'Comparison', 'Is');
  await selectOption(page, 'Value for Type', 'Expense');
  await expect(page.locator('.dn-transactions-results .dn-transaction-card')).toHaveCount(1);
  await expect(page.locator('.dn-transaction-copy strong')).toHaveText('October expense');
  await expect(page.locator('.dn-finance-metric-income strong')).toHaveText('₹1,000');
  await expect(page.locator('.dn-finance-metric-expense strong')).toHaveText('₹230');
  await expect(page.locator('.dn-finance-metric-balance strong')).toHaveText('₹770');

  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    state.group.join = 'OR';
    localStorage.setItem(key, JSON.stringify(state));
  }, storageKey('guest', 'conditions:transactions'));
  await page.reload();
  await openFilters(page);
  await expect(page.getByRole('combobox', { name: 'Match filters', exact: true })).toHaveCount(0);
  await expect(page.locator('.dn-transactions-results .dn-transaction-card')).toHaveCount(3);
  await expect(page.locator('.dn-transaction-copy strong').filter({ hasText: 'September income' })).toHaveCount(0);
  await expect(page.locator('.dn-finance-metric-income strong')).toHaveText('₹1,500');
  await expect(page.locator('.dn-finance-metric-expense strong')).toHaveText('₹300');
  await expect(page.locator('.dn-finance-metric-balance strong')).toHaveText('₹1,200');
});

test('Archive and Restore from a filtered Moment list preserve the original cancelled status', async ({ page }) => {
  const moments = [{ id: 'cancelled-moment', name: 'Cancelled plan', type: 'Personal', date: '2026-10-26',
    status: 'cancelled', archived: false, activities: [], memories: [], attachments: [] },
  { id: 'other-moment', name: 'Other plan', type: 'Personal', date: '2026-10-27', activities: [] }];
  await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.goto('/events');
  await openFilters(page);
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await addTextCondition(page, 'Moment name', 'Cancelled');
  await expect(page.locator('.event-story-main')).toHaveCount(1);
  const card = page.getByRole('group', { name: /^Cancelled plan\. Swipe either direction for actions\.$/ });
  const storedMoment = () => page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')).find((item) => item.id === 'cancelled-moment'));
  for (const [action, archived, label] of [['Archive', true, 'Archived'], ['Restore', false, 'Cancelled']]) {
    await card.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: action, exact: true }).click();
    await expect(card.locator('.event-story-status')).toHaveText(label);
    const stored = await storedMoment();
    expect(stored.status).toBe('cancelled');
    expect(stored.archived).toBe(archived);
    expect(stored.id).toBe('cancelled-moment');
    await expect(page.locator('.event-story-main')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Remove filter Moment name Contains Cancelled/ })).toBeVisible();
  }
});
