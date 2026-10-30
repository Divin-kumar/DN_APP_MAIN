import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest } from './fixtures.js';

test('compact Activities list shows status but no priority, menu or Moment hyperlink', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/activities');
  const card = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  await expect(card).toBeVisible();
  await expect(card.locator('.event-activity-status')).toHaveText('In progress');
  await expect(card.locator('.event-activity-priority')).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Activity options' })).toHaveCount(0);
  await expect(card.locator('.event-activity-context a')).toHaveCount(0);
  const momentName = card.locator('.event-activity-moment-name');
  await expect(momentName).toContainText('Weekend in Ooty');
  await expect(momentName).toBeVisible();
  expect((await momentName.boundingBox()).height).toBeGreaterThan(10);
  expect(await momentName.evaluate((node) => getComputedStyle(node).pointerEvents)).not.toBe('none');
  await expect(page).toHaveURL(/\/activities$/);
  await expect(page.locator('.event-activity-status').first()).toHaveCSS('font-size', '11px');
  await expect(card.locator('.event-activity-title-row > strong')).toHaveCSS('white-space', 'normal');
  await card.click();
  await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
  await expect(page.getByRole('link', { name: 'Back to Activities' })).toHaveAttribute('href', '/activities');
  await page.getByRole('link', { name: 'Back to Activities' }).click();
  await expect(page).toHaveURL(/\/activities$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('Moment-opening detail pages retain that Moment only, in its own filtered list order', async ({ page }) => {
  const moments = fixtureMoments();
  // Parent one: deliberately distinguish this Moment's three children from another Moment's same-ID child.
  const errors = await seedGuest(page, { moments });
  await page.goto('/events/moment-one/activities');
  const momentCard = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
  await expect(momentCard).toBeVisible();
  await momentCard.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('link', { name: 'Back to Moment activities' })).toHaveAttribute('href', '/events/moment-one/activities');
  await expect(page.getByLabel('Activity parent')).toContainText('Vacation / Weekend in Ooty');
  const paging = page.getByRole('navigation', { name: 'Activity navigation' });
  await expect(paging).toBeVisible();
  for (let index = 0; index < 2; index += 1) {
    const next = paging.getByRole('button', { name: 'Next activity' });
    if (await next.isEnabled()) {
      await next.click();
      await expect(page.getByLabel('Activity parent')).toContainText('Vacation / Weekend in Ooty');
      await expect(page.getByRole('link', { name: 'Back to Moment activities' })).toHaveAttribute('href', '/events/moment-one/activities');
    }
  }
  await page.getByRole('link', { name: 'Back to Moment activities' }).click();
  await expect(page).toHaveURL(/\/events\/moment-one\/activities$/);
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 320, height: 700 }, { width: 1440, height: 900 }]) {
  test(`empty cover uses 20% viewport height and header metadata stays ordered at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = await seedGuest(page);
    await page.goto('/events/moment-one/activities/shared');
    const cover = page.locator('.activity-cover.is-fallback');
    await expect(cover).toBeVisible();
    const box = await cover.boundingBox();
    expect(Math.abs(box.height - Math.min(viewport.height * .2, 220))).toBeLessThanOrEqual(2);
    const heading = page.locator('.activity-detail-heading');
    await expect(heading.locator('.activity-parent-context')).toContainText('Moment Type / Moment:');
    await expect(heading.locator('h1')).toHaveText('Book a lakeside stay');
    const metadata = page.locator('.activity-detail-metadata');
    await expect(metadata.locator('.activity-status-pill')).toHaveText('In progress');
    await expect(metadata.locator('.activity-detail-priority')).toContainText('high');
    await expect(metadata.getByRole('button', { name: 'Activity options' })).toHaveCount(1);
    const fields = await Promise.all(['.activity-status-pill', '.activity-detail-priority', '.dn-record-menu-trigger']
      .map((selector) => metadata.locator(selector).first().boundingBox()));
    expect(fields[0].x).toBeLessThan(fields[1].x);
    expect(fields[1].x).toBeLessThan(fields[2].x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('Code Lists owns sorting and live filter preferences without a duplicate Settings shortcut', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.goto('/settings');
  await expect(page.getByRole('link', { name: 'Open List sorting preferences' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Open Code Lists page' }).click();
  await expect(page).toHaveURL(/\/settings\/code-lists$/);
  const section = page.getByRole('region', { name: 'List sorting and filters preferences' });
  await expect(section).toBeVisible();
  const sorter = section.getByRole('combobox', { name: 'Sort Activities in settings field' });
  await sorter.click();
  await page.getByRole('option', { name: 'Title', exact: true }).click();

  const originalRecords = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await section.getByRole('button', { name: /Activities filters/ }).click();
  const editor = section.getByRole('region', { name: 'activities filters' });
  await expect(editor).toBeVisible();
  await editor.getByRole('button', { name: 'Add filter' }).click();
  await editor.getByRole('combobox', { name: 'Filter by' }).last().click();
  await page.getByRole('option', { name: 'Status', exact: true }).click();
  await editor.getByRole('combobox', { name: 'Value for Status' }).last().click();
  await page.getByRole('option', { name: 'Completed', exact: true }).click();

  await page.goto('/activities');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await expect(page.getByRole('combobox', { name: 'Sort activities field' })).toContainText('Title');
  await expect(page.getByRole('group', { name: 'Open Choose the train', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true })).toHaveCount(0);

  await page.goto('/settings/code-lists');
  const preferences = page.getByRole('region', { name: 'List sorting and filters preferences' });
  await expect(preferences.getByRole('combobox', { name: 'Sort Activities in settings field' })).toContainText('Title');
  await preferences.getByRole('button', { name: /Activities filters/ }).click();
  const reopened = preferences.getByRole('region', { name: 'activities filters' });
  await expect(reopened.locator('.dn-condition-chip').filter({ hasText: 'Completed' })).toBeVisible();
  await reopened.getByRole('button', { name: 'Clear all' }).click();

  await preferences.getByRole('button', { name: /Moments filters/ }).click();
  await expect(preferences.getByRole('region', { name: 'moments filters' })).toBeVisible();
  await preferences.getByRole('button', { name: /Transactions filters/ }).click();
  await expect(preferences.getByRole('region', { name: 'transactions filters' })).toBeVisible();

  await page.goto('/activities');
  await expect(page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(originalRecords);
  expect(errors).toEqual([]);
});
