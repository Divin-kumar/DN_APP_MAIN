import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest, openUniversalTransaction } from './fixtures.js';

const savedRecords = (page) => page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].map((key) => localStorage.getItem(key)));
const noOverflow = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

test('encoded Moment and Activity IDs retain their exact identity through Story links and refresh', async ({ page }) => {
  const momentId = 'family/trip #1';
  const activityId = 'book\\stay?step=1';
  const moments = [{ id:momentId, name:'Encoded identity review', type:'Vacation', date:'2026-10-28',
    activities:[{ id:activityId, eventId:momentId, title:'Keep the exact booking', date:'2026-10-27' }],
    memories:[], attachments:[] }];
  const errors = await seedGuest(page, { moments, incomes:[], expenses:[] });
  const base = `/events/${encodeURIComponent(momentId)}`;
  const detail = `${base}/activities/${encodeURIComponent(activityId)}`;
  await page.goto(`${base}/story`);
  const before = await savedRecords(page);
  await page.locator('.dn-v2-story').getByRole('link', { name:'Keep the exact booking', exact:true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(detail);
  await expect(page.locator('.activity-detail-content h1')).toHaveText('Keep the exact booking');
  expect(new URL(page.url()).pathname).toBe(detail);
  await page.reload();
  await expect(page.locator('.activity-detail-content h1')).toHaveText('Keep the exact booking');
  await page.goto(`${base}/gallery`);
  await expect(page.locator('.event-workspace-nav [aria-current="page"]')).toHaveText('Gallery');
  expect(await savedRecords(page)).toEqual(before);
  expect(errors).toEqual([]);
});

for (const [width, theme] of [[320, 'light'], [390, 'dark'], [768, 'light'], [1280, 'dark']]) {
  test(`canonical workspace and legacy links preserve records at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height:900 });
    const errors = await seedGuest(page, { theme });
    await page.goto('/events');
    const before = await savedRecords(page);
    for (const [suffix, label] of [['story', 'Story'], ['overview', 'Story'], ['timeline', 'Story'], ['memories', 'Story'],
      ['activities', 'Activities'], ['transactions', 'Transactions'], ['gallery', 'Gallery'], ['attachments', 'Gallery'], ['pdf', 'PDF Studio']]) {
      await page.goto(`/events/moment-one/${suffix}`);
      const nav = page.locator('.event-workspace-nav');
      await expect(nav.locator('[aria-current="page"]')).toContainText(label);
      await expect(nav.locator('a')).toHaveCount(5);
      await expect(nav.getByRole('link', { name:/Overview|Memories|Summary|Attachments/ })).toHaveCount(0);
      if (label === 'PDF Studio') {
        const studio = page.getByRole('region', { name:'PDF Studio', exact:true });
        await expect(studio.getByRole('img', { name:'Rendered PDF page 1' })).toBeVisible();
        await expect(studio.getByRole('button', { name:'Download customized PDF' })).toBeEnabled();
        const preview = await studio.locator('.dn-pdf-preview-page').boundingBox();
        expect(preview.width).toBeGreaterThanOrEqual(190);
      }
      await noOverflow(page);
    }
    expect(await savedRecords(page)).toEqual(before);
    expect(errors).toEqual([]);
  });
}

test('Notifications is Coming Soon and saving appearance retains all existing notification preferences', async ({ page }) => {
  const errors = await seedGuest(page);
  const notifications = { eventReminders:false, monthlySummary:true, budgetAlerts:false, reminderTime:'9.30 PM', futureOption:{ retained:true } };
  await page.goto('/settings');
  await page.evaluate(async (notifications) => (await import('/src/store/useAppStore.js')).default.getState().setPreferences({ notifications }), notifications);
  const before = await savedRecords(page);
  await page.getByRole('button', { name:/^Notifications/ }).click();
  const notificationSection = page.locator('.settings-section').filter({ has:page.getByRole('button', { name:/^Notifications/ }) });
  await expect(notificationSection).toContainText('Coming Soon');
  await expect(notificationSection.locator('input,select,[aria-pressed]')).toHaveCount(0);
  await expect(notificationSection.getByRole('button', { name:/Save/ })).toHaveCount(0);
  await page.getByRole('button', { name:/^Appearance & preferences/ }).click();
  await page.getByRole('button', { name:'Save preferences', exact:true }).click();
  await page.reload();
  expect(await page.evaluate(async () => (await import('/src/store/useAppStore.js')).default.getState().preferences.notifications)).toEqual(notifications);
  await page.goto('/settings/code-lists');
  await expect(page.getByText('Saved presets for the future Notifications feature.')).toBeVisible();
  expect(await savedRecords(page)).toEqual(before);
  expect(errors).toEqual([]);
});

test.describe('local calendar defaults', () => {
  test.use({ timezoneId:'Asia/Kolkata' });
  test('new Moment, Activity and Transaction use today after local midnight; saved dates stay unchanged', async ({ page }) => {
    await page.clock.install({ time:new Date('2026-10-28T19:00:00Z') });
    const moments = fixtureMoments();
    const errors = await seedGuest(page, { moments });
    await page.goto('/events?create=event');
    const eventDialog = page.getByRole('dialog');
    await expect(eventDialog.locator('input[name="date"]')).toHaveValue('2026-10-29');
    await eventDialog.getByRole('textbox', { name:'Moment name', exact:true }).fill('Local day review');
    await eventDialog.getByRole('button', { name:'Save Event', exact:true }).click();
    await expect(eventDialog).toHaveCount(0);
    await page.goto('/events/moment-one/activities?create=activity');
    const activityDialog = page.getByRole('dialog');
    await expect(activityDialog.locator('input[type="date"]')).toHaveValue('2026-10-29');
    await activityDialog.getByPlaceholder('Entry title', { exact:true }).fill('After midnight task');
    await activityDialog.getByRole('button', { name:'Add entry', exact:true }).click();
    await expect(activityDialog).toHaveCount(0);
    await page.goto('/financials/transactions');
    await openUniversalTransaction(page);
    const transaction = page.getByRole('dialog');
    await expect(transaction.locator('input[name="date"]')).toHaveValue('2026-10-29');
    await transaction.getByRole('textbox', { name:'Title *', exact:true }).fill('Unlinked local day expense');
    await transaction.getByRole('spinbutton').fill('25');
    await transaction.getByRole('radio', { name:'Cash', exact:true }).check();
    await transaction.getByRole('button', { name:'Add Transaction', exact:true }).click();
    await expect(transaction).toHaveCount(0);
    await page.reload();
    const records = (await savedRecords(page)).map(JSON.parse);
    expect(records[0].find((item) => item.name === 'Local day review').date).toBe('2026-10-29');
    const original = records[0].find((item) => item.id === 'moment-one');
    expect(original.date).toBe(moments[0].date);
    expect(original.activities.find((item) => item.title === 'After midnight task').date).toBe('2026-10-29');
    const expense = records[2].find((item) => item.name === 'Unlinked local day expense');
    expect(expense.date).toBe('2026-10-29'); expect(expense.eventId || '').toBe(''); expect(expense.activityId || '').toBe('');
    expect(errors).toEqual([]);
  });

  test('birthday header uses today’s occurrence and the correct turning age without rewriting the birthday', async ({ page }) => {
    await page.clock.install({ time:new Date('2026-10-28T07:00:00Z') });
    const moments = [{ id:'birthday', name:'Birthday review', type:'Birthday', date:'2000-10-28', recurrence:'yearly', activities:[] }];
    await seedGuest(page, { moments });
    await page.goto('/events');
    const before = await savedRecords(page);
    await page.goto('/events/birthday/story');
    await expect(page.locator('.event-moment-turning')).toHaveText('· Turning 26');
    await expect(page.locator('.event-moment-countdown')).toHaveText('· Today is the day');
    expect(await savedRecords(page)).toEqual(before);
  });
});
