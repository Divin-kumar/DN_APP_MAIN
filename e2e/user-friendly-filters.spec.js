import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest } from './fixtures.js';

const consumers = [
  { route: '/events', fields: ['Moment name', 'Moment type', 'Event date', 'Status', 'Visibility'], text: 'Moment name', date: 'Event date' },
  { route: '/activities', fields: ['Activity name', 'Date', 'Status', 'Priority', 'Moment', 'Moment type', 'Moment visibility'], text: 'Activity name', date: 'Date', linked: 'Moment' },
  { route: '/events/moment-one/activities', fields: ['Activity name', 'Date', 'Status', 'Priority'], text: 'Activity name', date: 'Date' },
  { route: '/financials', fields: ['Title', 'Type', 'Category', 'Amount', 'Date', 'Moment', 'Activity'], text: 'Title', date: 'Date', linked: 'Moment' },
  { route: '/events/moment-one/transactions', fields: ['Title', 'Type', 'Category', 'Amount', 'Date', 'Activity'], text: 'Title', date: 'Date', linked: 'Activity' },
];

async function select(page, name, label) {
  await page.getByRole('combobox', { name, exact: true }).last().click();
  const search = page.locator('.dropdown-menu-portal input[type="search"]');
  if (await search.count()) await search.fill(label);
  await page.getByRole('option', { name: label, exact: true }).click();
}

async function assertSingleRow(page, row) {
  await row.scrollIntoViewIfNeeded();
  const controls = [row.getByRole('combobox', { name: 'Filter by', exact: true }),
    row.getByRole('combobox', { name: 'Comparison', exact: true }), row.locator('.dn-condition-value-slot'),
    row.getByRole('button', { name: 'Remove filter', exact: true })];
  const bounds = await Promise.all(controls.map((control) => control.boundingBox()));
  const center = bounds[0].y + bounds[0].height / 2;
  for (const bound of bounds) {
    expect(bound.width).toBeGreaterThan(0);
    expect(Math.abs(bound.y + bound.height / 2 - center)).toBeLessThanOrEqual(2);
    expect(bound.x).toBeGreaterThanOrEqual(-1);
    expect(bound.x + bound.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  }
  expect((await row.boundingBox()).height).toBeLessThanOrEqual(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const width of [320, 390]) {
  test(`all five lists offer friendly filters and keep each mobile rule on one row at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 844 });
    const moments = fixtureMoments();
    moments[0].metadata = { rawTable: { privateInternalId: 'private-metadata-value' } };
    moments[0].activities[0].metadata = { rawTable: { privateInternalId: 'private-activity-value' } };
    const errors = await seedGuest(page, { moments });
    await page.goto('/events');
    const original = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].map((key) => localStorage.getItem(key)));

    for (const consumer of consumers) {
      await test.step(consumer.route, async () => {
        await page.goto(consumer.route);
        await page.getByRole('button', { name: /^Filters(?: and sort)?(?:,|$)/ }).click();
        const clear = page.getByRole('button', { name: 'Clear all', exact: true });
        if (await clear.count()) await clear.click();
        await page.getByRole('button', { name: 'Add filter', exact: true }).first().click();
        await page.getByRole('combobox', { name: 'Filter by', exact: true }).click();
        const labels = await page.getByRole('option').allTextContents();
        expect([...labels].sort()).toEqual([...consumer.fields].sort());
        expect(labels.join(' ')).not.toMatch(/metadata|internal|firestore|createdat|eventid|activityid|\[\]| · /i);
        await page.keyboard.press('Escape');

        await select(page, 'Filter by', consumer.text);
        await page.getByRole('textbox', { name: `Value for ${consumer.text}`, exact: true }).fill('plan');
        const row = page.locator('.dn-condition-rule').first();
        await assertSingleRow(page, row);

        if (consumer.linked) {
          await select(page, 'Filter by', consumer.linked);
          await page.getByRole('combobox', { name: `Value for ${consumer.linked}`, exact: true }).click();
          const values = await page.getByRole('option').allTextContents();
          expect(values.join(' ')).not.toMatch(/moment-one|moment-two|private-|rawTable/);
          const label = consumer.linked === 'Moment' ? moments[0].name : moments[0].activities[0].title;
          await page.getByRole('option', { name: label, exact: true }).click();
          await expect(page.getByRole('combobox', { name: `Value for ${consumer.linked}`, exact: true })).toContainText(label);
          await assertSingleRow(page, row);
          await expect(page.locator('.dn-condition-chip')).toContainText(label);
        }

        await select(page, 'Filter by', consumer.date);
        await select(page, 'Comparison', 'Custom range');
        await page.getByLabel(`From ${consumer.date}`, { exact: true }).fill('2026-10-01');
        await page.getByLabel(`To ${consumer.date}`, { exact: true }).fill('2026-10-31');
        await assertSingleRow(page, row);
        const from = await row.getByLabel(`From ${consumer.date}`, { exact: true }).boundingBox();
        const to = await row.getByLabel(`To ${consumer.date}`, { exact: true }).boundingBox();
        expect(Math.abs(from.y - to.y)).toBeLessThanOrEqual(1);
        expect(from.x + from.width).toBeLessThanOrEqual(to.x + 1);
      });
    }

    expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].map((key) => localStorage.getItem(key)))).toEqual(original);
    expect(errors).toEqual([]);
  });
}

test('friendly status and transaction type choices use readable labels while storing the existing values', async ({ page }) => {
  await seedGuest(page);
  await page.goto('/activities');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await page.getByRole('button', { name: 'Add filter', exact: true }).click();
  await select(page, 'Filter by', 'Status');
  await select(page, 'Value for Status', 'In progress');
  await expect(page.locator('.event-activity-card')).toHaveCount(2);
  await expect(page.locator('.dn-condition-chip')).toContainText('In progress');
  const storedStatus = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_list_state_guest_conditions%3Aactivities')).group.children[0].value);
  expect(storedStatus).toBe('in-progress');

  await page.goto('/financials');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('button', { name: 'Add filter', exact: true }).click();
  await select(page, 'Filter by', 'Type');
  await select(page, 'Value for Type', 'Expense');
  await expect(page.locator('.dn-transaction-copy strong', { hasText: 'Trip fund' })).toHaveCount(0);
  await expect(page.locator('.dn-condition-chip')).toContainText('Expense');
  const storedType = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_list_state_guest_conditions%3Atransactions')).group.children[0].value);
  expect(storedType).toBe('expense');
});
