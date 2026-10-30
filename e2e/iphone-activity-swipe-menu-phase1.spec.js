import { test, expect } from '@playwright/test';
import { seedGuest, swipe } from './fixtures.js';

// Synthetic Chromium drag QA is not native installed-iPhone gesture evidence.

async function swipeRight(page, row) {
  await row.scrollIntoViewIfNeeded();
  const box = await row.boundingBox();
  const x = box.x + 32, y = box.y + 24;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 125, y, { steps: 8 }); await page.mouse.up();
}
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) for (const theme of ['dark', 'light']) {
  test('Activities explicit swipe popup ' + width + 'px ' + theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/activities');
    const row = page.getByRole('group', { name: 'Open Book a lakeside stay', exact: true });
    const stored = () => page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    const original = await stored();

    await swipe(page, row, { distance: 140 });
    const menu = page.getByRole('menu', { name: /Actions for Book a lakeside stay/ });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveText(['Edit', 'Complete', 'Cancel', 'Delete']);
    expect(await stored()).toEqual(original);
    const popup = await menu.boundingBox();
    expect(popup.x).toBeGreaterThanOrEqual(0);
    expect(popup.x + popup.width).toBeLessThanOrEqual(width + 1);
    const dock = await page.locator('.mobile-tabbar').boundingBox();
    expect(popup.y + popup.height).toBeLessThanOrEqual(dock.y - 7);

    await menu.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Delete activity?' });
    await expect(confirmation).toBeVisible();
    expect(await stored()).toEqual(original);
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await stored()).toEqual(original);

    await swipeRight(page, row);
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit activity' });
    await expect(editor.getByRole('textbox', { name: 'Activity title' })).toHaveValue('Book a lakeside stay');
    await expect(editor.getByRole('textbox', { name: 'Activity title' })).not.toBeFocused();
    await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await stored()).toEqual(original);

    await swipe(page, row, { distance: 140 });
    await menu.getByRole('menuitem', { name: 'Cancel', exact: true }).click();
    // Existing saved Status != Cancelled filter intentionally hides the row.
    await expect(row).toHaveCount(0);
    const cancelledRecord = JSON.parse((await stored())[0])[0].activities[0];
    expect(cancelledRecord.status).toBe('cancelled');
    await page.goto('/events/moment-one/activities/shared');
    await expect(page.locator('.activity-status-pill')).toHaveText('Cancelled');
    await page.getByRole('button', { name: 'Activity options', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Restore', exact: true }).click();
    await expect(page.locator('.activity-status-pill')).toHaveText('In progress');
    await page.goto('/activities');
    await expect(row.locator('.event-activity-status')).toHaveText('In progress');

    const after = await stored();
    expect(after.slice(1)).toEqual(original.slice(1));
    const beforeMoments = JSON.parse(original[0]), afterMoments = JSON.parse(after[0]);
    // Existing owner-Moment saves fill absent legacy defaults, but must retain sibling records' business meaning.
    const business = (a) => ({
      id: a.id, title: a.title, date: a.date, priority: a.priority,
      completed: Boolean(a.completed), cancelled: Boolean(a.cancelled), expenses: a.expenses || [],
    });
    expect(afterMoments[0].activities.slice(1).map(business))
      .toEqual(beforeMoments[0].activities.slice(1).map(business));
    expect(afterMoments.slice(1)).toEqual(beforeMoments.slice(1));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('Home Activity left swipe opens status choice without completing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page);
  await page.goto('/dashboard');
  const row = page.getByRole('button', { name: 'Open Book a lakeside stay', exact: true });
  const original = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
  await swipe(page, row, { distance: 150 });
  const menu = page.getByRole('menu', { name: /Actions for Book a lakeside stay/ });
  await expect(menu.getByRole('menuitem', { name: 'Complete', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(original);
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await row.click();
  await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
  expect(errors).toEqual([]);
});
