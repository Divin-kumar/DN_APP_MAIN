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
    await expect(section.getByRole('heading', { name: 'List defaults' })).toBeVisible();
    const before = await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'),
      localStorage.getItem('dn_guest_incomes'),
      localStorage.getItem('dn_guest_expenses'),
    ]);
    // All three SortChips groups and their chosen fields stay untouched.
    const groups = section.locator('.dn-defaults-sort-card');
    await expect(groups).toHaveCount(3);
    // List Defaults has the same lightweight hierarchy as Settings home.
    const surface = await section.evaluate((root) => {
      const style = getComputedStyle(root);
      return { border: style.borderTopWidth, shadow: style.boxShadow,
        gap: Number.parseFloat(style.rowGap), padding: Number.parseFloat(style.paddingTop) };
    });
    expect(surface.border).toBe('0px');
    expect(surface.shadow).toBe('none');
    expect(surface.padding).toBe(0);
    expect(surface.gap).toBeLessThanOrEqual(12);
    const typography = await section.evaluate((root) => {
      const font = (sel) => [...root.querySelectorAll(sel)].map((node) =>
        parseFloat(getComputedStyle(node).fontSize));
      return {
        intro: font('.dn-defaults-intro p:not(.dn-defaults-sort-help)'),
        saved: font('.dn-defaults-intro .dn-defaults-saved'),
        sortLabels: font('.dn-defaults-sort-label strong'),
        sortHints: font('.dn-defaults-sort-label small'),

        filterHints: font('.dn-defaults-domain > .dn-list-filter-switch small'),
        backgrounds: [...root.querySelectorAll('.dn-defaults-sort-card')].map((node) => ({
          radius: getComputedStyle(node).borderTopLeftRadius,
          left: getComputedStyle(node).borderLeftWidth,
          top: getComputedStyle(node).borderTopWidth,
          height: node.getBoundingClientRect().height,
        })),
      };
    });
    for (const key of ['intro']) {
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

    await testInfo.attach(`list-defaults-overview-${width}-${theme}`, {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });
    await section.getByRole('button', { name: 'Activities filters' }).tap();
    const editor = section.locator('.dn-code-list-filter-editor');
    await expect(editor).toBeVisible();
    const activity = section.getByRole('region', { name: 'Activities defaults', exact: true });
    await expect(activity.locator('.dn-code-list-filter-editor')).toBeVisible();
    await expect(activity.getByRole('group', { name: 'Sort Activities in settings' })).toBeVisible();
    const reset = activity.getByRole('button', { name: 'Restore built-in defaults for Activities' });
    expect((await reset.boundingBox()).height).toBeGreaterThanOrEqual(44);
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

test('Per-list restore updates its summary and leaves other defaults and working choices intact', async ({ page }) => {
  const errors = await seedGuest(page);
  await page.goto('/activities');
  await page.getByRole('button', { name: /^Filters and sort/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Activity filters' });
  await sheet.getByRole('group', { name: 'Sort activities' }).getByRole('button', { name: 'Sort by Priority', exact: true }).click();
  await sheet.getByRole('button', { name: 'Show results' }).click();
  const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].map(key => localStorage.getItem(key)));
  await page.goto('/settings/list-defaults');
  const moments = page.getByRole('region', { name: 'Moments defaults', exact: true });
  const activity = page.getByRole('region', { name: 'Activities defaults', exact: true });
  await moments.getByRole('button', { name: 'Sort by Name', exact: true }).click();
  await activity.getByRole('button', { name: 'Sort by Title', exact: true }).click();
  await expect(activity.locator('.dn-defaults-sort-label small')).toHaveText('Title · Ascending');
  await activity.getByRole('button', { name: 'Activities filters', exact: true }).click();
  const editor = activity.getByRole('region', { name: 'activities filters', exact: true });
  await editor.getByRole('button', { name: 'Clear all', exact: true }).click();
  await expect(activity.getByRole('button', { name: 'Activities filters', exact: true })).toContainText('None');
  await page.reload();
  await expect(activity.getByRole('button', { name: 'Activities filters', exact: true })).toContainText('None');
  // Reset is discoverable without opening the filter editor.
  await activity.getByRole('button', { name: 'Restore built-in defaults for Activities' }).click();
  await expect(activity.getByRole('button', { name: 'Sort by Due date, ascending' })).toHaveAttribute('aria-pressed', 'true');
  await expect(activity.getByRole('button', { name: 'Activities filters', exact: true })).toContainText('2 saved');
  await expect(moments.getByRole('button', { name: 'Sort by Name, ascending' })).toHaveAttribute('aria-pressed', 'true');
  await activity.getByRole('button', { name: 'Activities filters', exact: true }).click();
  await expect(editor.locator('.dn-condition-rule')).toHaveCount(2);
  await page.goto('/activities');
  await page.getByRole('button', { name: /^Filters and sort/ }).click();
  await expect(sheet.getByRole('group', { name: 'Sort activities' }).getByRole('button', { name: 'Sort by Priority, ascending' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].map(key => localStorage.getItem(key)))).toEqual(before);
  expect(errors).toEqual([]);
});
