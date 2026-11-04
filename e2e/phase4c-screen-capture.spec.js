import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Automated viewport/screenshot evidence, not a manual audit or native Safari.
const screens = [
  ['01-dashboard', '/dashboard', 'Dashboard'],
  ['02-moments', '/events', 'Moments'],
  ['03-activities', '/activities', 'Activities'],
  ['04-activity-detail', '/events/moment-one/activities/shared', 'Book a lakeside stay'],
  ['05-story', '/events/moment-one/story', null],
  ['06-pdf-studio', '/events/moment-one/pdf', null],
  ['07-settings', '/settings', 'Settings'],
  ['08-data-backup', '/settings/data-backup', 'Data & Backup'],
  ['09-code-lists', '/settings/code-lists', null],
  ['10-about', '/settings/about', null],
];
const readyContent = (page, name) => {
  switch (name) {
    case '01-dashboard': return page.locator('.dashboard-greeting');
    case '02-moments': return page.locator('.dn-v2-moment-card').first();
    case '03-activities': return page.locator('.dn-v2-activity-card').first();
    case '04-activity-detail': return page.locator('.dn-content-row').first();
    case '05-story': return page.locator('[data-story-layout]').first();
    case '06-pdf-studio': return page.locator('.dn-pdf-preview-page img');
    case '07-settings': return page.locator('.settings-hub-card').first();
    case '08-data-backup': return page.getByRole('button', { name: 'Export backup' });
    case '09-code-lists': return page.getByText('Moment Types', { exact: true }).first();
    case '10-about': return page.getByText('Version Information', { exact: true }).first();
    default: throw new Error('Missing content-readiness marker: ' + name);
  }
};
for (const [width, height, theme] of [[390, 844, 'dark'], [320, 740, 'light']]) {
  test(`capture 4C UI surfaces and check overflow at ${width}px ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/dashboard');
    const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    for (const [name, route, heading] of screens) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      if (heading) await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
      const loaded = readyContent(page, name);
      await expect(loaded).toBeVisible({ timeout: 30000 });
      await expect(page.locator('.loading-skeleton')).toHaveCount(0);
      // Content-ready is not the same as visually ready. CSS route and card
      // fades can compound, producing a nearly blank screenshot.
      await expect.poll(() => loaded.evaluate((node) => {
        let opacity = 1;
        for (let current = node; current; current = current.parentElement) {
          const value = Number(getComputedStyle(current).opacity);
          if (Number.isFinite(value)) opacity *= value;
        }
        return opacity;
      }), { timeout: 5000, message: name + ': content should be visually settled' })
        .toBeGreaterThanOrEqual(.985);
      const dimensions = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(dimensions.doc, `${route} width overflow`).toBeLessThanOrEqual(dimensions.viewport + 1);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${theme}-${width}.png`),
        fullPage: false, animations: 'disabled' });
    }
    // Settings accordion, PDF controls and an accessible dialog are also
    // captured, without calling destructive controls or mutating records.
    await page.goto('/settings');
    await page.getByRole('link', { name: /Open Appearance & preferences/ }).click();
    await page.screenshot({ path: testInfo.outputPath(`11-preferences-${theme}-${width}.png`),
      fullPage: false, animations: 'disabled' });
    await page.goto('/events/moment-one/pdf');
    await expect(page.locator('.dn-pdf-preview-page img')).toBeVisible({ timeout: 30000 });
    await page.locator('.dn-pdf-studio-controls').scrollIntoViewIfNeeded();
    // The pinned Moment tabs must be opaque while PDF controls scroll behind:
    // translucent rails made underlying form labels visibly bleed through.
    const pinnedNav = page.locator('.event-workspace-nav');
    await expect(pinnedNav).toBeVisible();
    const { navAlpha, background } = await pinnedNav.evaluate((node) => {
      const background = getComputedStyle(node).backgroundColor;
      // Chromium may return legacy rgb(), CSS Color 4 color() or other
      // valid computed colors. Sample their actual alpha, not their syntax.
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = 'rgba(0, 0, 0, 0)';
      context.fillStyle = background;
      context.fillRect(0, 0, 1, 1);
      return { navAlpha: context.getImageData(0, 0, 1, 1).data[3] / 255, background };
    });
    expect(navAlpha, `Pinned ${theme} tabs must fully mask scrolled controls (computed: ${background})`).toBe(1);
    await page.screenshot({ path: testInfo.outputPath(`12-pdf-customization-${theme}-${width}.png`),
      fullPage: false, animations: 'disabled' });
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
    expect(errors).toEqual([]);
  });
}
