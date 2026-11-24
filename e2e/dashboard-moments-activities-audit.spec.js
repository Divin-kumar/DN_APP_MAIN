import { expect, test } from '@playwright/test';
import { fixtureMoments, seedGuest } from './fixtures.js';

// A controlled pending write makes the repeat-submit window deterministic.
// Restore the original writer to exercise real Guest persistence on retry.
async function holdWrite(page, method) {
  await page.evaluate(async (method) => {
    const store = (await import('/src/store/useEventStore.js')).default;
    const original = store.getState()[method];
    window.auditWrites = 0;
    store.setState({ [method]: () => {
      window.auditWrites++;
      return new Promise((_, reject) => { window.failAuditWrite = () => {
        store.setState({ [method]: original });
        reject(new Error('Synthetic offline write'));
      }; });
    } });
  }, method);
}

for (const entry of ['Moments drawer', 'Dashboard quick create']) {
  test(entry + ' locks repeated Moment saves and retains the draft for retry', async ({ page }) => {
    const errors = await seedGuest(page);
    if (entry === 'Moments drawer') await page.goto('/events?create=event');
    else {
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /^Open quick create menu/ }).click();
      await page.getByRole('button', { name: 'Life moment', exact: true }).click();
    }
    const dialog = page.getByRole('dialog');
    const name = dialog.getByRole('textbox', { name: 'Moment name' });
    await name.fill('Guest retry fixture');
    await holdWrite(page, 'addEvent');
    await dialog.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => window.auditWrites)).toBe(1);
    await page.evaluate(() => window.failAuditWrite());
    await expect(dialog.getByRole('alert')).toContainText('Try saving again');
    await expect(name).toHaveValue('Guest retry fixture');
    await dialog.getByRole('button', { name: /^Save moment$/i }).click();
    await expect(dialog).toHaveCount(0);
    const count = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups')).filter(m => m.name === 'Guest retry fixture').length);
    expect(count).toBe(1);
    expect(errors).toEqual([]);
  });
}

test('the Activity chooser lists each Moment once and handles a legacy missing date', async ({ page }) => {
  const moments = fixtureMoments();
  await seedGuest(page, { moments });
  await page.goto('/events?create=activity');
  const picker = page.getByRole('dialog', { name: 'Choose a life moment' });
  await expect(picker.locator('.activity-event-option-main').first()).toBeVisible();
  // Guest imports normalize missing dates. Older account records can still
  // reach the list without a usable recorded or creation date.
  await page.evaluate(async () => {
    const store = (await import('/src/store/useEventStore.js')).default;
    store.setState({ events: store.getState().events.map(moment => moment.id === 'moment-two'
      ? { ...moment, date: null, createdAt: null, startDate: null } : moment) });
  });
  await picker.getByRole('button', { name: /^Favorite Weekend/ }).click();
  const option = picker.locator('.activity-event-option-main').filter({ hasText: 'Weekend in Ooty' });
  await expect(option).toHaveCount(1);
  await expect(picker.locator('.activity-event-option-main').filter({ hasText: 'A separate Moment' })).toContainText('Date to be decided');
  await picker.getByRole('textbox', { name: 'Search moments for activity' }).fill('Ooty');
  await expect(option).toHaveCount(1);
  await option.click();
  const dialog = page.getByRole('dialog', { name: 'Add an activity' });
  await dialog.getByRole('textbox', { name: 'Activity title' }).fill('Single submission');
  await holdWrite(page, 'updateEventItem');
  await dialog.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.auditWrites)).toBe(1);
  await page.evaluate(() => window.failAuditWrite());
  await expect(dialog.getByRole('alert')).toContainText('Try saving again');
  await dialog.getByRole('button', { name: 'Save activity' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0].activities.filter(a => a.title === 'Single submission').length)).toBe(1);
});

test('Moment deletion keeps one pending request and can retry in the same confirmation', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.goto('/events');
  const card = page.locator('.dn-v2-moment-card').first();
  await card.getByRole('button', { name: /^Open / }).focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete Moment?' });
  await holdWrite(page, 'deleteEventItem');
  await dialog.getByRole('button', { name: 'Delete Moment' }).click();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(await page.evaluate(() => window.auditWrites)).toBe(1);
  await page.evaluate(() => window.failAuditWrite());
  await expect(dialog.getByRole('alert')).toContainText('Try again');
  await dialog.getByRole('button', { name: 'Delete Moment' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.dn-v2-moment-card')).toHaveCount(1);
  await expect(page.locator('.dn-list-controls-context')).toBeFocused();
  expect(errors).toEqual([]);
});

test('failed and pending list loads withhold counts until retry returns real records', async ({ page }) => {
  await seedGuest(page);
  for (const [route, selector, label] of [['events', '.dn-v2-moment-card', 'Moments'], ['activities', '.dn-v2-activity-card', 'Activities']]) {
    await page.goto('/' + route);
    await expect(page.locator(selector).first()).toBeVisible();
    await page.evaluate(async () => {
      const store = (await import('/src/store/useEventStore.js')).default;
      store.setState({ loadedFor: null, loading: true, error: null });
    });
    await expect(page.locator('.dn-list-controls-context')).toHaveCount(0);
    await expect(page.locator('.dn-discovery-empty')).toHaveCount(0);
    await page.evaluate(async () => (await import('/src/store/useEventStore.js')).default.setState({ loading: false, error: 'Unable to load events.' }));
    const error = page.getByRole('alert').filter({ hasText: label + ' couldn’t be loaded' });
    await expect(error).toHaveCount(1);
    await expect(page.getByText('Unable to load events.', { exact: true })).toHaveCount(0);
    await expect(page.locator('.dn-list-controls-context')).toHaveCount(0);
    await error.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator(selector).first()).toBeVisible();
    await expect(page.locator('.dn-list-controls-context')).toBeVisible();
  }
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Show Tasks on dashboard' }).click();
  const panel = page.getByRole('region', { name: 'Independent Tasks' });
  await page.evaluate(async () => (await import('/src/store/useTaskStore.js')).default.setState({ error: 'Synthetic read failure' }));
  await expect(panel.getByRole('alert')).toContainText('Tasks couldn’t be loaded');
  await panel.getByRole('button', { name: 'Try again' }).click();
  await expect(panel.getByRole('link', { name: 'Browse Tasks' })).toBeVisible();
});

test('tablet Activity titles fit beside the sidebar and keyboard actions return to the invoking control', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await seedGuest(page, { theme: 'light' });
  await page.goto('/activities');
  const grid = page.locator('.event-activity-list');
  await expect.poll(() => grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(1);
  const open = page.getByRole('button', { name: 'Open Book a lakeside stay', exact: true });
  const title = open.locator('strong');
  expect(await title.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await open.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(open).toBeFocused();
  await page.keyboard.press('Tab');
  const actions = page.getByRole('button', { name: 'Actions for Book a lakeside stay' });
  await expect(actions).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(actions).toBeFocused();
  await page.setViewportSize({ width: 1366, height: 900 });
  await expect.poll(() => grid.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
  await open.click();
  await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
});

test('keyboard focus returns to the Activities count after the last matching record is removed', async ({ page }) => {
  await seedGuest(page);
  await page.goto('/activities');
  await page.getByRole('searchbox').fill('lakeside');
  const open = page.getByRole('button', { name: 'Open Book a lakeside stay', exact: true });
  await open.focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete activity?' });
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.locator('.dn-discovery-empty')).toBeVisible();
  await expect(page.locator('.dn-list-controls-context')).toBeFocused();
});
