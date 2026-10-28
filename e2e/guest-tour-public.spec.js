import { test, expect } from '@playwright/test';

test('new Guest automatically sees isolated DN demo with Journal, Diary, Tasks and finance methods', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue as Guest' }).click();
  await page.goto('/events');
  const banner = page.getByRole('region', { name: 'Explore DN sample data' });
  await expect(banner).toBeVisible();
  await expect(page.getByText('Explore DN · Our little getaway')).toBeVisible();
  await expect(page.getByText('Explore DN · This month in words')).toBeVisible();
  await expect(page.getByText('Explore DN · Home project')).toBeVisible();
  const sample = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_dev_fixture_data')));
  expect(sample.scenario).toBe('tour');
  expect(sample.events).toHaveLength(3);
  expect(sample.incomes.map(x => x.paymentMethod)).toEqual(['Online','Cash']);
  expect(sample.expenses.map(x => x.paymentMethod)).toContain('Cash');
  const guestRecords = await page.evaluate(() => ({
    moments: localStorage.getItem('dn_guest_eventGroups'),
    incomes: localStorage.getItem('dn_guest_incomes'),
    expenses: localStorage.getItem('dn_guest_expenses'),
  }));
  expect([guestRecords.moments, guestRecords.incomes, guestRecords.expenses].every(x => x === null || x === '[]')).toBe(true);
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('dn_dev_fixture_data')).imagesReady), { timeout: 20000 }).toBe(true);
  await page.goto('/settings');
  const panel = page.getByRole('region', { name: 'Explore DN guest demo' });
  await expect(panel).toContainText('demo');
  await panel.getByRole('button', { name: 'Use my Guest data' }).click();
  await page.goto('/events');
  await expect(page.getByRole('region', { name: 'Explore DN sample data' })).toHaveCount(0);
  const actual = await page.evaluate(() => ({
    scenario: localStorage.getItem('dn_dev_fixture_scenario'),
    guest: localStorage.getItem('dn_guest_eventGroups'),
  }));
  expect(actual.scenario).toBeNull();
  expect(actual.guest === null || actual.guest === '[]').toBe(true);
  await page.goto('/settings');
  const panelAgain = page.getByRole('region', { name: 'Explore DN guest demo' });
  await panelAgain.getByRole('button', { name: 'Explore demo' }).click();
  await expect(panelAgain.getByRole('button', { name: 'Refresh demo' })).toBeVisible();
  await expect(page.getByText('This month in words')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('existing saved Guest records never trigger automatic demo activation', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dn_guest_eventGroups', JSON.stringify([{
      id: 'personal-guest', name: 'My private moment', date: '2026-10-28', type: 'Personal',
      activities: [], attachments: [], memories: [],
    }]));
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue as Guest' }).click();
  await page.goto('/events');
  await expect(page.getByText('My private moment')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('dn_dev_fixture_scenario'))).toBeNull();
  await expect(page.getByRole('region', { name: 'Explore DN sample data' })).toHaveCount(0);
});
