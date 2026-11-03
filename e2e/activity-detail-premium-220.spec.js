import { test, expect } from '@playwright/test';
import { addOriginal, fixtureMoments, seedGuest } from './fixtures.js';

// DN 2.2 Phase 4A: presentation-only synthetic Guest checks.
// Not a substitute for native iPhone Safari or account/backup acceptance.
const prepared = () => {
  const moments = fixtureMoments();
  const activity = moments[0].activities[0];
  activity.date = '2026-11-03';
  activity.description = 'Original morning writing is intentionally untimed and should use the full reading width.';
  activity.entries = [
    { id: 'same-time', description: 'Saved afternoon details with enough writing to test readability on small screens.', date: '2026-11-03', time: '13:20' },
    { id: 'different-day', description: 'A continuation written on the next day, without any invented timestamp.', date: '2026-11-04', time: '' },
  ];
  return moments;
};

for (const [width, height, theme] of [[320, 640, 'light'], [390, 844, 'dark'], [1024, 768, 'light']]) {
  test(`Activity Detail keeps a linear, readable 2.2 layout at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { moments: prepared(), theme, incomes: [], expenses: [] });
    await page.goto('/events/moment-one/activities/shared');
    const detail = page.locator('.activity-detail-page');
    await expect(detail.locator('h1')).toHaveText('Book a lakeside stay');
    await expect(detail.locator('.dn-content-row')).toHaveCount(3);
    await expect(detail.locator('.dn-content-row')).not.toContainText(['Time not recorded']);
    await expect(detail.locator('.dn-content-row.is-untimed').first()).toContainText('Original morning writing');
    await expect(detail.locator('.dn-content-row').filter({ hasText: 'A continuation written on the next day' })).toContainText('4 Nov 2026');
    await expect(detail.getByRole('heading', { name: 'Entries', exact: true })).toBeVisible();
    await expect(detail.getByRole('heading', { name: 'Attachments', exact: true })).toBeVisible();

    const geometry = await detail.evaluate((root) => {
      const row = [...root.querySelectorAll('.dn-content-row')].find((node) => node.textContent.includes('Saved afternoon details'));
      const body = row.querySelector('.dn-content-row-body').getBoundingClientRect();
      const meta = row.querySelector('.dn-content-row-meta').getBoundingClientRect();
      const outer = row.getBoundingClientRect();
      const controls = [...row.querySelectorAll('.dn-content-row-actions button')].map((node) => node.getBoundingClientRect());
      return { docWidth: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth,
        bodyLeft: body.left, bodyTop: body.top, bodyRight: body.right, metaTop: meta.top,
        metaRight: meta.right, rowRight: outer.right, controlSizes: controls.map(({ width, height }) => [width, height]) };
    });
    expect(geometry.docWidth).toBeLessThanOrEqual(geometry.viewport + 1);
    expect(geometry.controlSizes.length).toBe(2);
    expect(geometry.controlSizes.every(([w, h]) => w >= 44 && h >= 44)).toBe(true);
    if (width < 768) {
      expect(geometry.bodyTop).toBeGreaterThan(geometry.metaTop);
      expect(geometry.rowRight - geometry.bodyRight).toBeLessThan(2);
    } else {
      expect(geometry.bodyLeft).toBeGreaterThan(geometry.metaRight);
    }

    const original = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    const target = detail.locator('.dn-content-row').filter({ hasText: 'Saved afternoon details' });
    await target.getByRole('button', { name: 'Edit entry', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Edit entry' });
    await expect(editor.getByRole('textbox', { name: 'Entry content' })).toBeVisible();
    await editor.getByRole('button', { name: 'Cancel' }).click();
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(original);
    expect(errors).toEqual([]);
  });
}

test('real original photo keeps cover controls and compact iPhone first fold', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, { moments: prepared(), theme: 'dark', incomes: [], expenses: [] });
  await addOriginal(page);
  await page.goto('/events/moment-one/activities/shared');
  const cover = page.locator('.activity-cover.has-photo');
  await expect(cover.locator('img')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reposition cover photo' })).toBeVisible();
  const rect = await cover.boundingBox();
  expect(rect.height).toBeGreaterThanOrEqual(180);
  expect(rect.height).toBeLessThanOrEqual(291);
  await page.getByRole('button', { name: 'Reposition cover photo' }).click();
  await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('navigation', { name: 'Parent Moment' })).toBeVisible();
  expect(errors).toEqual([]);
});
