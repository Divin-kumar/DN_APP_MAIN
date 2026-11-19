import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

test.use({ timezoneId: 'Asia/Kolkata' });

const moments = [
  { id: 'recent', name: 'A family day', type: 'Personal', date: '2026-10-26', activities: [
    { id: 'today', title: 'Today’s task', date: '2026-10-26', expenses: [{ id: 'expense', amount: 999, date: '2026-10-26' }] },
    { id: 'done', title: 'Already complete', date: '2026-10-26', status: 'completed' },
    { id: 'overdue', title: 'Earlier task', date: '2026-10-24' },
    { id: 'undated', title: 'No date yet', date: '' },
    { id: 'cancelled', title: 'Cancelled task', date: '2026-10-26', cancelled: true },
  ] },
  { id: 'week', name: 'Earlier this week', type: 'Personal', date: '2026-10-20', activities: [
    { id: 'future', title: 'Tomorrow’s task', date: '2026-10-27' },
  ] },
  { id: 'archived', name: 'Archived day', type: 'Personal', date: '2026-10-26', archived: true,
    activities: [{ id: 'hidden', title: 'Archived task', date: '2026-10-26' }] },
];

for (const width of [320, 390, 768, 1440]) {
  test(`Dashboard keeps only its greeting and compact section headers at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date('2026-10-26T09:30:00+05:30') });
    const errors = await seedGuest(page, { moments,
      incomes: [{ id: 'income', name: 'Monthly fund', amount: 1000, date: '2026-10-01', type: 'Other' }],
      expenses: [{ id: 'expense', name: 'Shared master wins', amount: 450, date: '2026-10-26', category: 'Other' },
        { id: 'previous', name: 'Prior month', amount: 100, date: '2026-09-26', category: 'Other' }] });
    await page.goto('/dashboard');
    const greeting = page.locator('.dashboard-greeting[aria-label="Dashboard greeting"]');
    await expect(greeting.getByRole('heading', { name: 'Good morning, Guest' })).toBeVisible();
    await expect(greeting.locator('time')).toHaveText('Monday, 26 October 2026');
    await expect(greeting.locator('.dashboard-greeting-emoji')).toHaveText('☀️');
    await expect(greeting.locator('.dashboard-greeting-copy')).toHaveCount(0);
    await expect(page.locator('.dashboard-summary-metric, .dashboard-summary-footer, .dashboard-summary-status')).toHaveCount(0);
    await expect(greeting).not.toContainText(/Spent|Balance|Pending|Past 7 days|Preparing|completed/);
    // Approved compact greeting should reveal Moment content sooner.
    expect((await greeting.boundingBox()).height).toBeGreaterThanOrEqual(76);
    expect((await greeting.boundingBox()).height).toBeLessThan(150);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const [section, dates] of [['Moments', 'Moment dates'], ['Activities', 'Activity dates']]) {
      const panel = page.getByRole('region', { name: section, exact: true });
      const header = panel.locator('header').first();
      const title = await header.locator('span').first().boundingBox();
      const controls = [header.getByRole('group', { name: dates, exact: true }),
        header.getByRole('button', { name: `Hide ${section} on dashboard`, exact: true })];
      const upcoming = controls[0].getByRole('button', { name: 'Upcoming', exact: true });
      expect((await upcoming.boundingBox()).height).toBeGreaterThanOrEqual(43.9);
      expect(await upcoming.evaluate(el => parseFloat(getComputedStyle(el, '::before').height))).toBeLessThanOrEqual(30);
      for (const control of controls) {
        const bounds = await control.boundingBox();
        // Browser font/layout rasterization varies by a fraction of a CSS pixel.
        // 320px CI measured 4.137px; preserve alignment to within 5px.
        expect(Math.abs(bounds.y + bounds.height / 2 - title.y - title.height / 2)).toBeLessThanOrEqual(5);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      }
      expect((await header.boundingBox()).height).toBeLessThanOrEqual(52);
      await header.getByRole('group', { name: dates, exact: true }).getByRole('button', { name: 'On This Day', exact: true }).click();
      await expect(header.getByRole('button', { name: 'On This Day', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await header.getByRole('button', { name: 'Upcoming', exact: true }).click();
    }
    await expect(page.getByRole('button', { name: 'Open Today’s task', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Archived task', exact: true })).toHaveCount(0);
    if (width === 1440) {
      const taskPanel = await page.getByRole('region', { name: 'Independent Tasks', exact: true }).boundingBox();
      const momentPanel = await page.getByRole('region', { name: 'Moments', exact: true }).boundingBox();
      const activityPanel = await page.getByRole('region', { name: 'Activities', exact: true }).boundingBox();
      expect(Math.abs(momentPanel.y - activityPanel.y)).toBeLessThan(2);
      expect(Math.abs(taskPanel.y - momentPanel.y)).toBeLessThan(2);
      expect(Math.abs(taskPanel.width - momentPanel.width)).toBeLessThan(1);
      expect(Math.abs(activityPanel.width - momentPanel.width)).toBeLessThan(1);
    }
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual(moments);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `.verification/lightweight-dashboard-final-${width}.png` });
  });
}

test('Dashboard uses the available desktop pane and keeps date controls inside each card', async ({ page }) => {
  await seedGuest(page, { theme: 'light' });
  await page.goto('/dashboard');
  const overview = page.locator('.dashboard-overview');
  const cards = overview.locator('.dashboard-upcoming-card');
  await expect(cards).toHaveCount(3);
  for (const width of [1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const positions = await cards.evaluateAll((panels) => panels.map((panel) => {
      const box = panel.getBoundingClientRect();
      const heading = panel.querySelector('.dashboard-section-heading').getBoundingClientRect();
      const actions = panel.querySelector('.dashboard-section-actions').lastElementChild.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, controlsFit: actions.right <= heading.right + 1 };
    }));
    const [tasks, momentPanel, activities] = positions;
    expect(positions.every(({ controlsFit }) => controlsFit)).toBe(true);
    expect(tasks.x).toBeLessThan(320);
    expect(momentPanel.y).toBeCloseTo(activities.y, 0);
    if (width === 1024) {
      expect(tasks.y).toBeLessThan(momentPanel.y);
      expect(tasks.width).toBeGreaterThan(momentPanel.width * 2);
    } else {
      expect(tasks.y).toBeCloseTo(momentPanel.y, 0);
      expect(tasks.width).toBeCloseTo(momentPanel.width, 0);
    }
    if (width === 1920) expect((await overview.boundingBox()).width).toBeGreaterThan(1400);
  }
});

for (const [width, visibleRows] of [[320, 3], [1440, 5]]) {
  test(`Dashboard activity previews keep the time visible and scroll after ${visibleRows} rows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 640 : 900 });
    await page.clock.install({ time: new Date('2026-10-26T09:30:00+05:30') });
    await seedGuest(page, {
      moments: [{
        id: 'timing-moment', name: 'A long Moment name that competes for space', date: '2026-10-26',
        activities: Array.from({ length: 7 }, (_, index) => ({
          id: `timed-${index}`, title: `Activity ${index + 1}`, date: '2026-10-26', time: '09:30',
        })),
      }],
    });
    await page.goto('/dashboard');
    const preview = page.getByRole('region', { name: 'Activities in the next 30 days' });
    const rows = preview.locator('.dashboard-activity-card');
    await expect(rows).toHaveCount(7);
    const timing = rows.first().locator('.dashboard-upcoming-timing');
    await expect(timing).toHaveText('Today · 09:30');
    expect(await timing.evaluate((node) => node.getBoundingClientRect().right
      <= node.parentElement.getBoundingClientRect().right)).toBe(true);
    const previewBox = await preview.boundingBox();
    const visible = await rows.nth(visibleRows - 1).boundingBox();
    const next = await rows.nth(visibleRows).boundingBox();
    expect(visible.y + visible.height).toBeLessThanOrEqual(previewBox.y + previewBox.height + 1);
    expect(next.y).toBeGreaterThanOrEqual(previewBox.y + previewBox.height - 1);
    const last = rows.last().getByRole('button', { name: 'Open Activity 7' });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();
    if (width === 320) {
      const menu = rows.last().getByRole('button', { name: 'Activity options' });
      await page.locator('.dn-content').evaluate((pane) => { pane.scrollTop = pane.scrollHeight; });
      const create = await page.getByRole('button', { name: 'Open quick create menu' }).boundingBox();
      const menuBox = await menu.boundingBox();
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(create.y);
      await menu.click();
      await expect(page.getByRole('menu', { name: 'Actions for Activity 7' })).toBeVisible();
    }
  });
}

test('an unreadable expense ledger does not affect the simple Dashboard greeting and Finance still offers recovery', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-26T09:30:00+05:30') });
  await seedGuest(page, { moments, incomes: [], expenses: [] });
  await page.addInitScript(() => {
    if (localStorage.getItem('dn_corrupt_expense_seeded')) return;
    localStorage.setItem('dn_guest_expenses', '{corrupt');
    localStorage.setItem('dn_corrupt_expense_seeded', 'true');
  });
  await page.goto('/dashboard');
  const greeting = page.locator('.dashboard-greeting[aria-label="Dashboard greeting"]');
  await expect(greeting.getByRole('heading', { name: 'Good morning, Guest' })).toBeVisible();
  await expect(greeting.getByRole('alert')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_expenses'))).toBe('{corrupt');
  await page.goto('/financials');
  await expect(page.getByRole('alert')).toContainText('Unable to load all transactions.');
  await page.evaluate(() => localStorage.setItem('dn_guest_expenses', JSON.stringify([
    { id: 'restored', name: 'Recovered expense', amount: 37, date: '2026-10-26', category: 'Other' },
  ])));
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  // The existing nested-only expense remains part of the ledger after recovery.
  await expect(page.locator('.dn-finance-metric-expense strong')).toHaveText('₹1,036');
});

test('Dashboard welcome refreshes its greeting and emoji when local time changes without reloading', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.clock.install({ time: new Date('2026-10-26T11:59:00+05:30') });
  const errors = await seedGuest(page);
  await page.goto('/dashboard');
  const greeting = page.locator('.dashboard-greeting[aria-label="Dashboard greeting"]');
  const emoji = greeting.locator('.dashboard-greeting-emoji');
  await expect(greeting.getByRole('heading', { name: 'Good morning, Guest' })).toBeVisible();
  await expect(emoji).toHaveText('☀️');
  await expect(greeting.locator('time')).toBeVisible();

  for (const [clockTime, heading, symbol] of [
    ['2026-10-26T12:00:00+05:30', 'Good afternoon, Guest', '🌤️'],
    ['2026-10-26T18:00:00+05:30', 'Good evening, Guest', '🌙'],
    ['2026-10-27T00:00:00+05:30', 'Good morning, Guest', '☀️'],
  ]) {
    await page.clock.setFixedTime(new Date(clockTime));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(greeting.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(emoji).toHaveText(symbol);
  }
  await expect(greeting.locator('time')).toHaveText('Tuesday, 27 October 2026');
  await expect(greeting.locator('.dashboard-greeting-copy')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
