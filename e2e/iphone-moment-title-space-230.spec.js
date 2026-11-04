import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest } from './fixtures.js';

// A screenshot-led correction: the card action menu needs only the top-right
// corner, not a permanent 49px empty strip beside every line of text.
test.use({ hasTouch: true, isMobile: true });
for (const [width, height, theme] of [
  [320, 740, 'light'], [390, 844, 'dark'], [430, 932, 'light'],
]) {
  test(`Moment cards recover title width and retain menu safety ${width}px ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const moments = fixtureMoments();
    moments[0].name = 'A very important family journey with many milestones and keepsakes';
    const errors = await seedGuest(page, { moments, theme });
    await page.goto('/events');
    const card = page.locator('.life-journey-items .dn-v2-moment-card').first();
    await expect(card).toBeVisible();
    const measure = await card.evaluate((node) => {
      const rect = (selector) => node.querySelector(selector).getBoundingClientRect();
      const button = node.querySelector('.dn-v2-moment-open');
      const heading = node.querySelector('.dn-v2-moment-heading');
      const name = rect('.dn-v2-moment-copy > strong');
      const menu = rect('.dn-record-menu-trigger');
      const cover = rect('.dn-v2-moment-cover');
      const copy = rect('.dn-v2-moment-copy');
      return {
        paddingRight: getComputedStyle(button).paddingRight,
        headingHeight: heading.getBoundingClientRect().height,
        titleWidth: name.width,
        titleTop: name.top, menuBottom: menu.bottom,
        menuWidth: menu.width, menuHeight: menu.height,
        coverRight: cover.right, copyLeft: copy.left, copyRight: copy.right,
        cardRight: node.getBoundingClientRect().right,
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    expect(measure.paddingRight).toBe('0px');
    expect(measure.headingHeight).toBeGreaterThanOrEqual(43.9);
    expect(measure.titleTop).toBeGreaterThanOrEqual(measure.menuBottom - 2);
    expect(measure.titleWidth).toBeGreaterThan(140);
    expect(measure.menuWidth).toBeGreaterThanOrEqual(43.9);
    expect(measure.menuHeight).toBeGreaterThanOrEqual(43.9);
    expect(measure.copyLeft).toBeGreaterThanOrEqual(measure.coverRight - 1);
    expect(measure.copyRight).toBeLessThanOrEqual(measure.cardRight + 1);
    expect(measure.pageWidth).toBeLessThanOrEqual(width + 1);
    const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    await testInfo.attach(`moment-title-recovery-${width}-${theme}`, {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });
    await card.locator('.dn-record-menu-trigger').tap();
    await expect(page.getByRole('menu', { name: /Actions for/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: /Actions for/ })).toHaveCount(0);
    await card.locator('.dn-v2-moment-open').tap();
    await expect(page).toHaveURL(/\/events\/moment-one\/story$/);
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
    expect(errors).toEqual([]);
  });
}
