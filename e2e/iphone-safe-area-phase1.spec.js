import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Chromium cannot reproduce an installed iPhone's Home Indicator. The overridable
// token exercises the same CSS math without pretending to test real iOS hardware.
const devices = [[320, 640, 'dark'], [390, 844, 'dark'], [430, 932, 'light']];
for (const [width, height, theme] of devices) {
  test('mobile dock and scrolling reserve a simulated iPhone safe area at ' + width + 'x' + height + ' ' + theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/settings/about');
    await expect(page.getByRole('heading', { name: 'About DN' })).toBeVisible();
    const before = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    const geometry = () => page.evaluate(() => {
      const dock = document.querySelector('.mobile-tabbar');
      const content = document.querySelector('.dn-content');
      if (!dock || !content) return null;
      const dockStyle = getComputedStyle(dock);
      return {
        dockDisplay: dockStyle.display,
        dockBottom: Number.parseFloat(dockStyle.bottom),
        dockHeight: dock.getBoundingClientRect().height,
        contentBottomPadding: Number.parseFloat(getComputedStyle(content).paddingBottom),
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    const normal = await geometry();
    expect(normal?.dockDisplay).not.toBe('none');
    expect(normal.dockBottom).toBeGreaterThanOrEqual(16.5);
    expect(normal.documentWidth).toBeLessThanOrEqual(width + 1);

    // Simulate a larger Home Indicator inset without changing viewport metadata
    // or requiring an inaccessible physical iOS keyboard in CI.
    await page.addStyleTag({ content: 'html[data-theme] { --dn-safe-area-bottom: 34px !important; }' });
    const inset = await geometry();
    expect(inset.dockBottom).toBeGreaterThanOrEqual(33.5);
    expect(inset.contentBottomPadding).toBeGreaterThanOrEqual(110.5);
    expect(inset.contentBottomPadding - inset.dockBottom - inset.dockHeight).toBeGreaterThanOrEqual(-7);
    expect(inset.documentWidth).toBeLessThanOrEqual(width + 1);
    const after = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    expect(after).toEqual(before);
    expect(errors).toEqual([]);
  });
}
