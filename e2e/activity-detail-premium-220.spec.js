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
    { id: 'different-day', description: 'A continuation written on the next day with a recorded time.', date: '2026-11-04', time: '08:15' },
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
    if (width < 768) {
      const dateTime = await detail.locator('.dn-content-row').filter({ hasText: 'A continuation written on the next day' }).evaluate((row) => {
        const date = row.querySelector('.dn-content-row-date').getBoundingClientRect();
        const time = row.querySelector('.dn-content-row-time').getBoundingClientRect();
        return { delta: Math.abs(date.y + date.height / 2 - (time.y + time.height / 2)),
          timeRight: time.right, viewport: document.documentElement.clientWidth };
      });
      expect(dateTime.delta).toBeLessThanOrEqual(3);
      expect(dateTime.timeRight).toBeLessThanOrEqual(dateTime.viewport);
    }
    await expect(detail.getByRole('heading', { name: 'Entries', exact: true })).toBeVisible();
    await expect(detail.getByRole('heading', { name: 'Attachments', exact: true })).toBeVisible();
    const attachments = await detail.evaluate((root) => {
      const title = root.querySelector('.activity-attachments .activity-section-heading h2').getBoundingClientRect();
      const add = root.querySelector('.activity-attachment-hint').getBoundingClientRect();
      return { titleCenter: title.y + title.height / 2, addCenter: add.y + add.height / 2,
        addWidth: add.width, addRight: add.right, viewport: document.documentElement.clientWidth };
    });
    expect(Math.abs(attachments.titleCenter - attachments.addCenter)).toBeLessThan(27);
    expect(attachments.addWidth).toBeGreaterThanOrEqual(44);
    await expect(detail.getByText('Add using +', { exact: true })).toBeVisible();
    expect(attachments.addRight).toBeLessThanOrEqual(attachments.viewport + 1);
    if (width < 768) {
      const originalRow = await detail.locator('.dn-content-row.is-untimed').first().evaluate((row) => {
        const body = row.querySelector('.dn-content-row-body').getBoundingClientRect();
        const edit = row.querySelector('.dn-content-row-actions').getBoundingClientRect();
        return { delta: Math.abs(body.y - edit.y), overlap: body.right > edit.left };
      });
      expect(originalRow.delta).toBeLessThan(12);
      expect(originalRow.overlap).toBe(false);
    }

    const target = detail.locator('.dn-content-row').filter({ hasText: 'Saved afternoon details' });
    const controls = target.locator('.dn-content-row-actions').getByRole('button');
    await expect(controls).toHaveCount(2);
    // Fractional route translation can briefly round a 44px DOMRect below 44px.
    // Keep the exact minimum and measure again once the controls settle.
    await expect(async () => {
      const sizes = await controls.evaluateAll((buttons) => buttons.map((button) => {
        const { width, height } = button.getBoundingClientRect();
        return { width, height };
      }));
      expect(sizes).toHaveLength(2);
      for (const { width: controlWidth, height: controlHeight } of sizes) {
        expect(controlWidth).toBeGreaterThanOrEqual(44);
        expect(controlHeight).toBeGreaterThanOrEqual(44);
      }
    }).toPass({ timeout: 5000 });

    const geometry = await target.evaluate((row) => {
      const body = row.querySelector('.dn-content-row-body').getBoundingClientRect();
      const meta = row.querySelector('.dn-content-row-meta').getBoundingClientRect();
      const outer = row.getBoundingClientRect();
      return { docWidth: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth,
        bodyLeft: body.left, bodyTop: body.top, bodyRight: body.right, metaTop: meta.top,
        metaRight: meta.right, rowRight: outer.right };
    });
    expect(geometry.docWidth).toBeLessThanOrEqual(geometry.viewport + 1);
    if (width < 768) {
      expect(geometry.bodyTop).toBeGreaterThan(geometry.metaTop);
      expect(geometry.rowRight - geometry.bodyRight).toBeLessThan(2);
    } else {
      expect(geometry.bodyLeft).toBeGreaterThan(geometry.metaRight);
    }

    const original = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
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
