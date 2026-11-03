import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Source-controlled, synthetic Guest visual acceptance. Attaches screenshots
// for review; it never signs in, touches personal records or publishes Hosting.
const sampleTasks = [
  { id: 'visual-task-a', title: 'Pack travel documents', notes: 'Keep the originals',
    status: 'in-progress', priority: 'high', momentId: '', activityId: '',
    dueDate: '2026-11-08', dueTime: '10:30' },
  { id: 'visual-task-b', title: 'Review the photo album', notes: '',
    status: 'completed', priority: 'low', momentId: '', activityId: '',
    dueDate: '', dueTime: '' },
];
const assertNoPageOverflow = async (page) => {
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
};

for (const width of [320, 390, 1280]) {
  for (const theme of ['light', 'dark']) {
    test(`DN 2.3 Task and Dashboard visual review ${width}px ${theme}`, async ({ page }, testInfo) => {
      const errors = await seedGuest(page);
      await page.setViewportSize({ width, height: width < 700 ? 780 : 900 });
      await page.goto('/tasks');
      await page.evaluate((items) => localStorage.setItem('dn_guest_tasks', JSON.stringify(items)), sampleTasks);
      await page.reload();
      await page.evaluate((nextTheme) => { document.documentElement.dataset.theme = nextTheme; }, theme);
      await expect(page.locator('.dn-task-row')).toHaveCount(2);
      await expect(page.locator('.dn-task-group')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'New Task', exact: true })).toHaveCount(0);
      await assertNoPageOverflow(page);
      await testInfo.attach(`Tasks-${width}-${theme}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

      await page.getByRole('button', { name: 'Refine', exact: true }).click();
      const refine = page.getByRole('dialog', { name: 'Refine Tasks' });
      await expect(refine).toBeVisible();
      await expect(refine.getByText('Group by')).toHaveCount(0);
      await expect(refine.locator('.dn-refine-sheet-intro')).toBeVisible();
      await assertNoPageOverflow(page);
      await testInfo.attach(`Task-refine-${width}-${theme}`, { body: await page.screenshot(), contentType: 'image/png' });
      await refine.getByRole('button', { name: 'Cancel', exact: true }).click();

      await page.goto('/dashboard');
      await expect(page.locator('.dashboard-overview.dashboard-compact > section').first()).toBeVisible();
      const order = await page.locator('.dashboard-overview.dashboard-compact > section').evaluateAll((items) =>
        items.map((item) => item.getAttribute('aria-label')));
      expect(order).toEqual(['Independent Tasks', 'Moments', 'Activities']);
      await assertNoPageOverflow(page);
      await testInfo.attach(`Dashboard-${width}-${theme}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
      expect(errors).toEqual([]);
    });
  }
}

for (const route of ['/events', '/activities', '/financials/transactions']) {
  test(`shared Refine at ${route} retains draft/Apply and shares Task presentation`, async ({ page }) => {
    const errors = await seedGuest(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    const trigger = page.getByRole('button', { name: /^Filters and sort/ });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.locator('.dn-refine-sheet-intro')).toBeVisible();
    await expect(sheet.locator('.dn-refine-sort-chips')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Show results' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
    await assertNoPageOverflow(page);
    expect(errors).toEqual([]);
  });
}
