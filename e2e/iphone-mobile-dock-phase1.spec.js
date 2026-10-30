import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic mobile Chromium checks are not a substitute for installed iOS PWA
// or VoiceOver, but they protect responsive geometry and non-destructive actions.
for (const [width, height, theme] of [[320, 640, 'dark'], [390, 844, 'dark'], [430, 932, 'light']]) {
  test('DN 2.1 mobile dock is legible, reachable and safe at ' + width + 'px ' + theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/dashboard');

    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    const tabs = nav.locator('.mobile-tab');
    await expect(nav).toBeVisible();
    await expect(tabs).toHaveCount(3);

    for (const name of ['Home', 'Activities', 'Moments']) {
      const link = nav.getByRole('link', { name, exact: true });
      const metrics = await link.evaluate((node) => ({
        width: node.getBoundingClientRect().width,
        height: node.getBoundingClientRect().height,
        fontSize: Number.parseFloat(getComputedStyle(node).fontSize),
        iconWidth: node.querySelector('svg')?.getBoundingClientRect().width,
      }));
      expect(metrics.width, name + ' touch width').toBeGreaterThanOrEqual(44);
      expect(metrics.height, name + ' touch height').toBeGreaterThanOrEqual(44);
      expect(metrics.fontSize, name + ' label size').toBeGreaterThanOrEqual(11);
      expect(metrics.iconWidth, name + ' icon width').toBeGreaterThanOrEqual(19);
    }

    const create = nav.getByRole('button', { name: 'Open quick create menu', exact: true });
    const createBox = await create.boundingBox();
    expect(createBox.width).toBeGreaterThanOrEqual(44);
    expect(createBox.height).toBeGreaterThanOrEqual(44);

    const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    await nav.getByRole('link', { name: 'Moments', exact: true }).click();
    await expect(nav.getByRole('link', { name: 'Moments', exact: true })).toHaveAttribute('aria-current', 'page');
    await nav.getByRole('link', { name: 'Activities', exact: true }).click();
    await expect(nav.getByRole('link', { name: 'Activities', exact: true })).toHaveAttribute('aria-current', 'page');
    await create.click();
    await expect(nav.getByRole('button', { name: 'Life moment', exact: true })).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Transaction', exact: true })).toBeVisible();
    await expect(create).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(nav.getByRole('button', { name: 'Life moment', exact: true })).toHaveCount(0);
    await expect(create).toHaveAttribute('aria-expanded', 'false');

    const geometry = await page.evaluate(() => {
      const dock = document.querySelector('.mobile-tabbar');
      const content = document.querySelector('.dn-content');
      return {
        width: document.documentElement.scrollWidth,
        dockHeight: dock.getBoundingClientRect().height,
        dockBottom: Number.parseFloat(getComputedStyle(dock).bottom),
        contentPadding: Number.parseFloat(getComputedStyle(content).paddingBottom),
      };
    });
    expect(geometry.width).toBeLessThanOrEqual(width + 1);
    expect(geometry.contentPadding).toBeGreaterThanOrEqual(geometry.dockBottom + geometry.dockHeight - 7);
    const after = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    expect(after).toEqual(before);
    expect(errors).toEqual([]);
  });
}
