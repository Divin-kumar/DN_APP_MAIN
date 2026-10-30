import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest, swipe, openUniversalTransaction, activityDetailAction } from './fixtures.js';

test('Account loading never flashes not-found or a previous scope Activity; both IDs remain authoritative', async ({ page }) => {
  await seedGuest(page); await page.goto('/events/moment-one/activities/shared');
  await expect(page.locator('h1')).toHaveText('Book a lakeside stay');
  await page.evaluate(async () => {
    const app = (await import('/src/store/useAppStore.js')).default;
    const events = (await import('/src/store/useEventStore.js')).default;
    const incomes = (await import('/src/store/useIncomeStore.js')).default;
    const expenses = (await import('/src/store/useExpenseStore.js')).default;
    // Synthetic Account reads stop at the store edge; this is not Firebase proof.
    events.setState({ loadEvents: async () => [], activeLoadKey: 'user:synthetic-account', loadedFor: null, loading: true,
      scopeRevision: events.getState().scopeRevision + 1 });
    incomes.setState({ loadIncomes: async () => [], activeLoadKey: 'user:synthetic-account', loadedFor: null, loading: true });
    expenses.setState({ loadExpenses: async () => [], activeLoadKey: 'user:synthetic-account', loadedFor: null, loading: true });
    app.setState({ user: { uid: 'synthetic-account' }, isGuest: false, authReady: true });
  });
  await expect(page.getByText('Book a lakeside stay', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Activity not found' })).toHaveCount(0);
  await expect(page.locator('.activity-detail-skeleton')).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(async () => {
    const events = (await import('/src/store/useEventStore.js')).default;
    events.setState({ events: [{ id: 'different-parent', name: 'Other parent', activities: [{ id: 'shared', title: 'Must never open this child' }] }],
      activeLoadKey: 'user:synthetic-account', loadedFor: 'user:synthetic-account', loading: false });
  });
  await expect(page.getByRole('heading', { name: 'Activity not found' })).toBeVisible();
  await expect(page.getByText('Must never open this child')).toHaveCount(0);
});

test('Moment Transactions waits for scoped finance, keeps the shell on error and retries without leaking old totals', async ({ page }) => {
  await seedGuest(page); await page.goto('/events/moment-one/transactions');
  await expect(page.getByRole('group', { name: 'Totals for this Moment' })).toContainText('₹1,000');
  await page.evaluate(async () => {
    const income = (await import('/src/store/useIncomeStore.js')).default;
    income.setState({ incomes: [{ id: 'stale', amount: 99999, eventId: 'moment-one' }], loadedFor: null, error: 'Unable to load incomes.', loading: false,
      loadIncomes: async () => { if (window.__dnAllowRetry) income.setState({ incomes: [], loadedFor: 'guest:anonymous', activeLoadKey: 'guest:anonymous', error: null, loading: false }); } });
  });
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
  await expect(page.locator('.event-workspace-nav [aria-current="page"]')).toHaveText('Transactions');
  await expect(page.getByRole('alert')).toContainText('Transactions couldn’t be loaded.');
  await expect(page.getByText('No transactions have been recorded for this Moment.')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Totals for this Moment' })).toHaveCount(0);
  await page.evaluate(() => { window.__dnAllowRetry = true; });
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Totals for this Moment' })).toContainText('₹0');
  await expect(page.getByRole('group', { name: 'Totals for this Moment' })).not.toContainText('99,999');
});

test('Sample Activity changes stay in the isolated fixture and clearing Sample returns to real Guest records', async ({ page }) => {
  const moments = fixtureMoments();
  await seedGuest(page);
  await page.addInitScript(({ moments }) => {
    if (!localStorage.getItem('dn_e2e_sample_seeded')) {
      moments[0].activities[0].title = 'Isolated Sample Activity';
      localStorage.setItem('dn_dev_fixture_scenario', 'new');
      localStorage.setItem('dn_dev_fixture_data', JSON.stringify({ scenario: 'new', events: moments, incomes: [], expenses: [], activities: [], memories: [], attachments: [] }));
      localStorage.setItem('dn_e2e_sample_seeded', 'true');
    }
  }, { moments });
  await page.goto('/events/moment-one/activities/shared');
  await expect(page.locator('h1')).toHaveText('Isolated Sample Activity');
  const guest = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await activityDetailAction(page, 'Close');
  await expect(page.locator('.activity-status-pill')).toHaveText('Completed');
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(guest);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_dev_fixture_data')).events[0].activities[0].completed)).toBe(true);
  await page.evaluate(async () => {
    const sample = await import('/src/dev/sampleData.js'); sample.clearActiveSampleScenario();
    const event = (await import('/src/store/useEventStore.js')).default;
    const income = (await import('/src/store/useIncomeStore.js')).default;
    const expense = (await import('/src/store/useExpenseStore.js')).default;
    await Promise.all([event.getState().loadEvents(null, true), income.getState().loadIncomes(null, true), expense.getState().loadExpenses(null, true)]);
  });
  await expect(page.locator('h1')).toHaveText('Book a lakeside stay');
  await expect(page.locator('.activity-status-pill')).toHaveText('In progress');
});

test('archived parents remain readable, cancelled restore stays explicit and invalid dates remain undecided', async ({ page }) => {
  const moments = fixtureMoments(); moments[0].archived = true; moments[0].activities[0].date = 'invalid';
  await seedGuest(page, { moments }); await page.goto('/events/moment-one/activities/shared');
  await expect(page.getByText('Archived Moment', { exact: true })).toBeVisible();
  await expect(page.locator('.activity-detail-due')).toContainText('Date to be decided');
  await page.getByRole('button', { name: 'Activity options', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Close', exact: true })).toBeDisabled();
  await page.goto('/events/moment-one/activities/cancelled');
  await expect(page.locator('.activity-status-pill')).toHaveText('Cancelled');
  await page.getByRole('button', { name: 'Activity options', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Restore', exact: true })).toBeEnabled();
  await expect(page.locator('.activity-detail-due')).toContainText('Date to be decided');
});

test('Universal + transaction presets both IDs and retains route/draft through failure, cancellation and retry', async ({ page }) => {
  await seedGuest(page); await page.goto('/events/moment-one/activities/shared');
  await openUniversalTransaction(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('combobox', { name: 'Linked Activity', exact: true })).toContainText('Book a lakeside stay');
  await dialog.getByRole('spinbutton').fill('30');
  await dialog.getByRole('textbox', { name: 'Title *', exact: true }).fill('Tea stop');
  await dialog.getByRole('radio', { name: 'Cash' }).check();
  await page.evaluate(async () => {
    const store = (await import('/src/store/useExpenseStore.js')).default;
    const original = store.getState().addExpense;
    store.setState({ addExpense: async () => { throw new Error('Synthetic finance failure'); } });
    window.__dnRestoreExpense = () => store.setState({ addExpense: original });
  });
  await dialog.getByRole('button', { name: 'Add Transaction', exact: true }).click();
  await expect(dialog.getByRole('alert').first()).toContainText('Synthetic finance failure');
  await expect(dialog.getByRole('textbox', { name: 'Title *', exact: true })).toHaveValue('Tea stop');
  await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
  await page.evaluate(() => window.__dnRestoreExpense());
  await dialog.getByRole('button', { name: 'Add Transaction', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('list', { name: 'Linked transactions' })).toContainText('Tea stop');
  await openUniversalTransaction(page);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
});

test('a missing Sample fixture fails closed and cannot write to the real Guest ledgers', async ({ page }) => {
  await seedGuest(page); await page.goto('/activities');
  const outcome = await page.evaluate(async () => {
    const keys = ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'];
    const before = keys.map((key) => localStorage.getItem(key));
    localStorage.setItem('dn_dev_fixture_scenario', 'new');
    localStorage.removeItem('dn_dev_fixture_data');
    const event = (await import('/src/store/useEventStore.js')).default;
    const income = (await import('/src/store/useIncomeStore.js')).default;
    const expense = (await import('/src/store/useExpenseStore.js')).default;
    const attempts = await Promise.allSettled([
      event.getState().updateEventItem(null, true, { id: 'moment-one', name: 'Must not persist', activities: [] }),
      income.getState().addIncome(null, true, { id: 'forbidden-income', amount: 1 }),
      expense.getState().addExpense(null, true, { id: 'forbidden-expense', amount: 1 }),
    ]);
    return { before, after: keys.map((key) => localStorage.getItem(key)),
      states: attempts.map((item) => item.status), errors: attempts.map((item) => item.reason?.message) };
  });
  expect(outcome.states).toEqual(['rejected', 'rejected', 'rejected']);
  expect(outcome.errors.every((message) => message.includes('Sample data is unavailable'))).toBe(true);
  expect(outcome.after).toEqual(outcome.before);
  await page.goto('/events/moment-one/activities/shared');
  await expect(page.getByRole('heading', { name: 'Activity couldn’t be loaded' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Activity not found' })).toHaveCount(0);
});

test('pending popup completion ignores duplicates and a failed save leaves the Activity available for retry', async ({ page }) => {
  await seedGuest(page); await page.goto('/activities');
  const card = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  await expect(card).toBeVisible();
  await page.evaluate(async () => {
    const store = (await import('/src/store/useEventStore.js')).default;
    const original = store.getState().updateEventItem;
    window.__dnCompletionCalls = 0;
    store.setState({ updateEventItem: () => {
      window.__dnCompletionCalls += 1;
      return new Promise((resolve, reject) => { window.__dnFailCompletion = () => reject(new Error('Synthetic completion failure. Please retry.')); });
    } });
    window.__dnRestoreCompletion = () => store.setState({ updateEventItem: original });
  });
  await swipe(page, card);
  const menu = page.getByRole('menu', { name: /Actions for Book a lakeside stay/ });
  await menu.getByRole('menuitem', { name: 'Complete', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saving…' })).toBeAttached();
  await swipe(page, card);
  await expect(menu).toHaveCount(0);
  expect(await page.evaluate(() => window.__dnCompletionCalls)).toBe(1);
  await page.evaluate(() => window.__dnFailCompletion());
  await expect(page.getByRole('status').filter({ hasText: 'Saving…' })).toHaveCount(0);
  await expect(page.getByRole('alert').filter({ hasText: 'Synthetic completion failure' })).toBeVisible();
  await expect(card.locator('.event-activity-status')).toHaveText('In progress');
  await page.evaluate(() => window.__dnRestoreCompletion());
  // Retest the failed operation using the keyboard menu entry. Initial swipe
  // already exercised the pointer path and verified duplicate suppression.
  await card.focus();
  await page.keyboard.press('ArrowRight');
  await expect(menu).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Complete', exact: true }).click();
  await expect(card.locator('.event-activity-status')).toHaveText('Completed');
  await expect(page).toHaveURL(/\/activities$/);
});

test('legacy completed status exposes Reopen consistently in the list and detail without rewriting on open', async ({ page }) => {
  const moments = fixtureMoments();
  moments[0].activities[0].completed = false;
  moments[0].activities[0].status = 'completed';
  await seedGuest(page, { moments }); await page.goto('/activities');
  const card = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  await expect(card.locator('.event-activity-status')).toHaveText('Completed');
  await expect(card.getByRole('button', { name: 'Activity options' })).toHaveCount(0);
  await card.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.activity-status-pill')).toHaveText('Completed');
  await page.getByRole('button', { name: 'Activity options' }).click();
  await expect(page.getByRole('menuitem', { name: 'Reopen', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Reopen', exact: true }).click();
  await expect(page.locator('.activity-status-pill')).toHaveText('In progress');
  await page.getByRole('link', { name: 'Back to Activities' }).click();
  await expect(card.locator('.event-activity-status')).toHaveText('In progress');
});

test('unreadable Guest Moments show a retry instead of a false not-found state and preserve source bytes', async ({ page }) => {
  await seedGuest(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('dn_corrupt_seeded')) {
      localStorage.setItem('dn_guest_eventGroups', '{broken');
      localStorage.setItem('dn_corrupt_seeded', 'true');
    }
  });
  await page.goto('/events/moment-one/activities/shared');
  await expect(page.getByRole('heading', { name: 'Activity couldn’t be loaded' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Activity not found' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe('{broken');
  await page.evaluate((moments) => localStorage.setItem('dn_guest_eventGroups', JSON.stringify(moments)), fixtureMoments());
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Book a lakeside stay');
});

test('unreadable Guest income shows a focused finance retry while keeping the Moment workspace', async ({ page }) => {
  await seedGuest(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem('dn_corrupt_seeded')) {
      localStorage.setItem('dn_guest_incomes', '{broken');
      localStorage.setItem('dn_corrupt_seeded', 'true');
    }
  });
  await page.goto('/events/moment-one/transactions');
  await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Transactions couldn’t be loaded.');
  await expect(page.getByRole('group', { name: 'Totals for this Moment' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_incomes'))).toBe('{broken');
  await page.evaluate(() => localStorage.setItem('dn_guest_incomes', '[]'));
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Totals for this Moment' })).toContainText('₹120');
  await expect(page.locator('.event-workspace-nav [aria-current="page"]')).toHaveText('Transactions');
});
