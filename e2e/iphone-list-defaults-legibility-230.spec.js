import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Simulated mobile/coarse-pointer Chromium, not native iPhone Safari or VoiceOver.
test.use({ hasTouch: true, isMobile: true });
for (const [width, height, theme] of [
  [320, 640, 'dark'], [390, 844, 'light'],
  [430, 932, 'dark'], [844, 390, 'light'],
]) {
  test(`List Defaults keeps its instructions readable at ${width}x${height} ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/settings/list-defaults');
    const section = page.locator('.dn-list-defaults-page #list-order');
    await expect(section.getByRole('heading', { name: 'List sorting and filters' })).toBeVisible();
    const before = await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'),
      localStorage.getItem('dn_guest_incomes'),
      localStorage.getItem('dn_guest_expenses'),
    ]);
    // All three SortChips groups and their chosen fields stay untouched.
    const groups = section.locator('.dn-defaults-sort-card');
    await expect(groups).toHaveCount(3);
    const typography = await section.evaluate((root) => {
      const font = (sel) => [...root.querySelectorAll(sel)].map((node) =>
        parseFloat(getComputedStyle(node).fontSize));
      return {
        intro: font('.dn-defaults-intro p'),
        saved: font('.dn-defaults-intro .dn-defaults-saved'),
        sortLabels: font('.dn-defaults-sort-label strong'),
        sortHints: font('.dn-defaults-sort-label small'),
        filterIntro: font('.dn-list-filter-intro .code-list-description'),
        filterHints: font('.dn-list-filter-switches button small'),
        backgrounds: [...root.querySelectorAll('.dn-defaults-sort-card')].map((node) => ({
          radius: getComputedStyle(node).borderTopLeftRadius,
          left: getComputedStyle(node).borderLeftWidth,
          top: getComputedStyle(node).borderTopWidth,
          height: node.getBoundingClientRect().height,
        })),
      };
    });
    for (const key of ['intro', 'filterIntro']) {
      expect(typography[key].length).toBeGreaterThan(0);
      expect(typography[key].every((size) => size >= 13), key).toBe(true);
    }
    for (const key of ['saved', 'sortHints', 'filterHints']) {
      expect(typography[key].length).toBeGreaterThan(0);
      expect(typography[key].every((size) => size >= 12), key).toBe(true);
    }
    expect(typography.sortLabels.every((size) => size >= 14)).toBe(true);
    expect(typography.backgrounds.every(({ radius, left, top }) =>
      radius === '0px' && left === '0px' && top === '0px')).toBe(true);

    await section.getByRole('button', { name: 'Activities filters' }).tap();
    const editor = section.locator('.dn-code-list-filter-editor');
    await expect(editor).toBeVisible();
    const foot = await editor.locator('.dn-defaults-filter-footer p').evaluate((node) =>
      parseFloat(getComputedStyle(node).fontSize));
    const hint = await editor.locator('.dn-defaults-filter-heading small').evaluate((node) =>
      parseFloat(getComputedStyle(node).fontSize));
    expect(foot).toBeGreaterThanOrEqual(12);
    expect(hint).toBeGreaterThanOrEqual(12);
    await testInfo.attach(`list-defaults-${width}-${theme}`, {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width + 1);
    await section.getByRole('button', { name: 'Activities filters' }).tap();
    expect(await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'),
      localStorage.getItem('dn_guest_incomes'),
      localStorage.getItem('dn_guest_expenses'),
    ])).toEqual(before);
    expect(errors).toEqual([]);
  });
}
