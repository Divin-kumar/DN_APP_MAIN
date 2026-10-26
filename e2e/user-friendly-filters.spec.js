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
  expect((await page.locator('.dn-list-controls-panel').boundingBox()).height).toBeLessThanOrEqual(280);
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
        await page.getByRole('combobox', { name: 'Comparison', exact: true }).click();
        expect(await page.getByRole('option').allTextContents()).toEqual(['Contains', 'Is', 'Is not']);
        await page.getByRole('option', { name: 'Contains', exact: true }).click();
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
        await page.getByRole('combobox', { name: 'Comparison', exact: true }).click();
        expect(await page.getByRole('option').allTextContents()).toEqual(['On', 'Before', 'After', 'Custom range', 'Today', 'This week', 'This month']);
        await page.getByRole('option', { name: 'On', exact: true }).click();
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

const noTextFocus = async (page) => {
  expect(await page.evaluate(() => Boolean(document.activeElement?.matches('input, textarea, [contenteditable="true"]')))).toBe(false);
  expect(await page.evaluate(() => window.__dnTextFocusCount)).toBe(0);
};

for (const inputMode of ['mouse', 'touch']) {
  test.describe(`${inputMode} dropdown opening`, () => {
    test.use({ hasTouch: inputMode === 'touch' });
    test('filter controls on all five lists open without text focus; explicit search and keyboard choices remain available', async ({ page }) => {
      test.setTimeout(90_000);
      const press = (locator) => inputMode === 'touch' ? locator.tap() : locator.click();
      const moments = [...fixtureMoments(), ...Array.from({ length: 20 }, (_, index) => ({ id: `extra-${index}`, name: `Extra plan ${index}`,
        type: 'Personal', date: '2026-10-26', activities: [{ id: `extra-task-${index}`, title: `Extra task ${index}`, date: '2026-10-26' }] }))];
      const errors = await seedGuest(page, { moments });
      await page.addInitScript(() => {
        window.__dnTextFocusCount = 0;
        document.addEventListener('focusin', (event) => {
          if (event.target.matches('input, textarea, [contenteditable="true"]')) window.__dnTextFocusCount += 1;
        });
      });
      for (const consumer of consumers) {
        await test.step(consumer.route, async () => {
          await page.goto(consumer.route);
          await press(page.getByRole('button', { name: /^Filters(?: and sort)?(?:,|$)/ }));
          await noTextFocus(page);
          const clear = page.getByRole('button', { name: 'Clear all', exact: true });
          if (await clear.count()) await press(clear);
          await press(page.getByRole('button', { name: 'Add filter', exact: true }).first());
          const field = page.getByRole('combobox', { name: 'Filter by', exact: true });
          await press(field);
          await noTextFocus(page);
          await expect(page.getByRole('searchbox', { name: 'Search filters', exact: true })).toHaveCount(0);
          const choice = consumer.linked || (consumer.text === 'Title' ? 'Type' : 'Status');
          await press(page.getByRole('option', { name: choice, exact: true }));
          const comparison = page.getByRole('combobox', { name: 'Comparison', exact: true });
          await press(comparison);
          await noTextFocus(page);
          expect(await page.getByRole('option').allTextContents()).toEqual(['Is', 'Is not']);
          await press(page.getByRole('option', { name: 'Is', exact: true }));
          await press(page.getByRole('combobox', { name: `Value for ${choice}`, exact: true }));
          await noTextFocus(page);
          await expect(page.locator('.dn-list-controls-panel')).toBeVisible();
          await press(page.getByRole('option').first());
          const sort = page.locator('.dn-list-controls-sort-row').getByRole('combobox');
          await press(sort);
          await noTextFocus(page);
          await press(page.getByRole('option').first());
          await noTextFocus(page);
          await expect(page.getByRole('button', { name: /Save filter|Add filter group/ })).toHaveCount(0);
          await expect(page.getByRole('tab', { name: /Saved|Recent|Favorites/ })).toHaveCount(0);
        });
      }

      await page.goto('/activities');
      await press(page.getByRole('button', { name: /^Filters/ }));
      await press(page.getByRole('button', { name: 'Clear all', exact: true }));
      await press(page.getByRole('button', { name: 'Add filter', exact: true }));
      const field = page.getByRole('combobox', { name: 'Filter by', exact: true });
      await field.focus();
      await page.keyboard.type('Status'); await page.keyboard.press('Enter');
      await expect(field).toContainText('Status');
      await noTextFocus(page);
      await press(field); await press(page.getByRole('option', { name: 'Moment', exact: true }));
      const value = page.getByRole('combobox', { name: 'Value for Moment', exact: true });
      await press(value);
      const search = page.getByRole('searchbox', { name: 'Search options', exact: true });
      await expect(search).toBeVisible(); await expect(search).not.toBeFocused();
      await noTextFocus(page);
      await press(search); await expect(search).toBeFocused();
      await search.fill('Extra plan 17');
      await page.keyboard.press('Enter');
      await expect(value).toContainText('Extra plan 17');
      await expect(page.locator('.event-activity-card')).toHaveCount(1);
      await value.focus(); await page.keyboard.press('Space');
      await page.keyboard.type('Extra plan 18'); await page.keyboard.press('Backspace');
      await page.keyboard.type('8'); await page.keyboard.press('Enter');
      await expect(value).toContainText('Extra plan 18');
      await expect(value).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}

test('many phone filters stay inside a short scrollable panel with its final actions reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await seedGuest(page); await page.goto('/financials');
  await page.getByRole('button', { name: /^Filters/ }).click();
  const add = page.getByRole('button', { name: 'Add filter', exact: true });
  for (let index = 0; index < 12; index += 1) await add.click();
  const panel = page.locator('.dn-list-controls-panel');
  expect((await panel.boundingBox()).height).toBeLessThanOrEqual(640 * .42 + 1);
  await expect(page.locator('.dn-condition-rule')).toHaveCount(12);
  await page.locator('.dn-condition-rule').last().getByRole('button', { name: 'Remove filter', exact: true }).click();
  await expect(page.locator('.dn-condition-rule')).toHaveCount(11);
  await page.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(page.locator('.dn-condition-rule')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
