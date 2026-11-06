import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Mobile/coarse-pointer Chromium emulates iPhone gestures, not native Safari.
test.use({ isMobile: true, hasTouch: true });
for (const [width, height, theme] of [[320, 640, 'dark'], [390, 844, 'light'], [430, 932, 'dark'], [844, 390, 'light']]) {
  test(`PDF Studio iPhone actions meet touch sizes at ${width}x${height} ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/events/moment-one/pdf');
    const studio = page.locator('.dn-pdf-studio-page');
    await expect(studio.getByRole('button', { name: 'Download customized PDF' }))
      .toBeEnabled({ timeout: 30000 });
    const before = await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'), localStorage.getItem('dn_guest_tasks'),
      localStorage.getItem('dn_guest_incomes'), localStorage.getItem('dn_guest_expenses'),
    ]);
    const controls = studio.locator('.dn-pdf-preview-tools');
    const buttons = controls.getByRole('button');
    await expect(buttons).toHaveCount(5);
    const rects = await buttons.evaluateAll((nodes) => nodes.map((node) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, height: r.height };
    }));
    for (const r of rects) {
      expect(r.width).toBeGreaterThanOrEqual(43.9);
      expect(r.height).toBeGreaterThanOrEqual(43.9);
      expect(r.left).toBeGreaterThanOrEqual(-1);
      expect(r.right).toBeLessThanOrEqual(width + 1);
    }
    await controls.getByRole('button', { name: 'Zoom in PDF preview' }).tap();
    await expect(controls.getByRole('button', { name: 'Reset PDF preview zoom' })).toHaveText('125%');
    await controls.getByRole('button', { name: 'Reset PDF preview zoom' }).tap();
    await expect(controls.getByRole('button', { name: 'Reset PDF preview zoom' })).toHaveText('100%');

    await controls.getByRole('button', { name: 'Open full-screen PDF preview' }).tap();
    const viewer = page.locator('dialog.dn-pdf-fullscreen-dialog');
    await expect(viewer).toBeVisible();
    const close = viewer.getByRole('button', { name: 'Close full-screen PDF preview' });
    const closeBox = await close.boundingBox();
    expect(closeBox.width).toBeGreaterThanOrEqual(43.9);
    expect(closeBox.height).toBeGreaterThanOrEqual(43.9);
    await close.tap();
    await expect(viewer).not.toBeVisible();

    await studio.getByRole('button', { name: 'PDF design Minimal' }).tap();
    const restore = studio.getByRole('button', { name: 'Use saved default' });
    await expect(restore).toBeVisible();
    const target = await restore.boundingBox();
    expect(target.height).toBeGreaterThanOrEqual(43.9);
    expect(target.x).toBeGreaterThanOrEqual(-1);
    expect(target.x + target.width).toBeLessThanOrEqual(width + 1);
    await testInfo.attach(`iPhone-PDF-${width}-${height}-${theme}`, {
      body: await page.screenshot(), contentType: 'image/png',
    });
    // A visible button can still sit underneath a sticky rail on tiny screens.
    // Verify the actual touch-center receives this button, not a nearby control.
    await restore.scrollIntoViewIfNeeded();
    const hittable = await restore.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      return y >= 0 && y <= window.innerHeight
        && node.contains(document.elementFromPoint(x, y));
    });
    expect(hittable).toBe(true);
    const savedStyle = (await studio.locator('.dn-pdf-style-default small').innerText())
      .replace(/^Saved default:\\s*/, '').trim();
    const pageThemeBeforeRestore = await studio.getByRole('button', { name: 'Light', exact: true })
      .getAttribute('aria-pressed');
    await restore.tap();
    await expect(restore).toHaveCount(0);
    await expect(studio.getByRole('button', { name: `PDF design ${savedStyle}` }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(await studio.getByRole('button', { name: 'Light', exact: true })
      .getAttribute('aria-pressed')).toBe(pageThemeBeforeRestore);
    expect(await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'), localStorage.getItem('dn_guest_tasks'),
      localStorage.getItem('dn_guest_incomes'), localStorage.getItem('dn_guest_expenses'),
    ])).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });
}
