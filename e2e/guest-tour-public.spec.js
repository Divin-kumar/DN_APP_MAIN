import { test, expect } from '@playwright/test';

test('new Guest automatically sees isolated DN demo with Journal, Diary, Tasks and finance methods', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue as Guest' }).click();
  await expect(page.locator('.dashboard-greeting')).toContainText('Viewing sample data');
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('dn_dev_fixture_data')).imagesReady), { timeout: 20000 }).toBe(true);
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
  expect(sample.expensePlans.map(({ name }) => name)).toEqual(['Home internet', 'Electricity bill', 'Mobile plan']);
  const guestRecords = await page.evaluate(() => ({
    moments: localStorage.getItem('dn_guest_eventGroups'),
    incomes: localStorage.getItem('dn_guest_incomes'),
    expenses: localStorage.getItem('dn_guest_expenses'),
  }));
  expect([guestRecords.moments, guestRecords.incomes, guestRecords.expenses].every(x => x === null || x === '[]')).toBe(true);
  await expect(page.getByText('Explore DN · Our little getaway')).toBeVisible();
  await expect(page.getByText('Explore DN · This month in words')).toBeVisible();
  await page.getByRole('button', { name: 'Open Explore DN · Our little getaway', exact: true }).click();
  const introduction = page.getByRole('region', { name: 'Moment introduction' });
  await expect(introduction).toContainText('We took the road into the hills before sunrise');
  await expect(introduction).not.toContainText('Update preview');
  await page.goto('/financials/transactions');
  await page.getByRole('button', { name: /Upcoming expenses/ }).click();
  const plans = page.getByRole('dialog', { name: 'Upcoming expenses' });
  await expect(plans.getByRole('region', { name: 'Overdue' })).toContainText('Electricity bill');
  await expect(plans.getByRole('region', { name: 'Later' })).toContainText('Mobile plan');
  await plans.getByRole('region', { name: 'Due today' }).getByRole('button', { name: 'Record payment for Home internet' }).click();
  const payment = page.getByRole('dialog', { name: 'Record payment', exact: true });
  await expect(payment.getByLabel('Amount paid *', { exact: true })).toHaveValue('799');
  await payment.getByRole('button', { name: 'Save payment' }).click();
  await plans.getByRole('button', { name: 'View payment' }).click();
  const receipt = page.getByRole('dialog', { name: 'Payment details' });
  await expect(receipt).toContainText('₹799');
  await receipt.getByRole('button', { name: 'Back to upcoming expenses' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_expenses') || '[]'))).toEqual([]);
  await plans.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto('/settings');
  const panel = page.getByRole('region', { name: 'Explore DN guest demo' });
  await expect(panel).toContainText('demo');
  await panel.getByRole('link', { name: 'Demo guide' }).click();
  const guide = page.getByRole('region', { name: 'Application Guide' });
  await expect(page).toHaveURL(/\/settings\/about#application-guide$/);
  await expect(guide).toBeFocused();
  await expect(guide.getByRole('heading', { name: 'Application Guide' })).toBeInViewport();
  await guide.getByText('Navigate & create', { exact: true }).click();
  await expect(guide.getByText(/Double-tap it to go Back/)).toBeVisible();
  await guide.getByText('PDF Studio', { exact: true }).click();
  await expect(guide.getByText(/update the PDF directly from Preview/)).toBeVisible();

  await page.goBack();
  await panel.getByRole('button', { name: 'Use my Guest data' }).click();
  await page.goto('/dashboard');
  await expect(page.locator('.dashboard-greeting')).toContainText('Your day');
  await expect(page.getByText('Viewing sample data', { exact: true })).toHaveCount(0);
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


test('Guest demo can restore a valid personal backup without manual exit, with accessible restore file picker', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue as Guest' }).click();
  await page.goto('/settings');
  await expect(page.getByRole('region', { name: 'Explore DN guest demo' })).toBeVisible();
  await page.goto('/settings#backup');
  await expect(page).toHaveURL(/\/settings\/data-backup$/);
  const picker = page.getByLabel('Choose a DN backup JSON file');
  await expect(picker).toBeAttached();
  const backup = await page.evaluate(async () => {
    const { createBackupDocument } = await import('/src/services/backupService.js');
    const { DEFAULT_CODE_LISTS } = await import('/src/utils/codeLists.js');
    return createBackupDocument({
      moments: [{ id: 'personal-restored', name: 'My restored Journey', type: 'Vacation',
        date: '2026-10-21', activities: [], attachments: [], memories: [] }],
      codeLists: DEFAULT_CODE_LISTS,
      settings: { restoreCodeLists: false },
    });
  });
  await picker.setInputFiles({ name: 'valid-dn-backup.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf8') });
  const dialog = page.getByRole('dialog', { name: 'Review backup restore' });
  await expect(dialog).toContainText('leave the demo and merge this backup');
  expect(await page.evaluate(() => localStorage.getItem('dn_dev_fixture_scenario'))).toBe('tour');
  await dialog.getByRole('button', { name: 'Confirm restore' }).click();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('dn_dev_fixture_scenario'))).toBeNull();
  await page.goto('/events');
  await expect(page.getByText('My restored Journey')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Explore DN sample data' })).toHaveCount(0);
  const stored = await page.evaluate(() => ({
    guest: JSON.parse(localStorage.getItem('dn_guest_eventGroups') || '[]'),
    declined: localStorage.getItem('dn_guest_tour_declined'),
  }));
  expect(stored.guest).toHaveLength(1);
  expect(stored.guest[0].id).toBe('personal-restored');
  expect(stored.declined).toBe('true');
  expect(errors).toEqual([]);
});

test('Guest switch uses a compact touch-safe control at narrow mobile widths', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Continue as Guest' }).click();
  await expect(page.locator('.dashboard-greeting')).toContainText('Viewing sample data');
  await page.goto('/settings');
  const button = page.getByRole('button', { name: 'Use my Guest data' });
  await expect(button).toBeVisible();
  const shape = await button.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    borderRadius: getComputedStyle(element).borderRadius,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  expect(shape.height).toBeGreaterThanOrEqual(40);
  expect(shape.borderRadius).toBe('999px');
  expect(shape.overflow).toBe(false);
});
