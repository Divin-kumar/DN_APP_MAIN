import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest } from './fixtures.js';

// Type and status share the compact heading while the whole card stays tappable.
test.use({ hasTouch: true, isMobile: true });
for (const [width, height, theme] of [
  [320, 740, 'light'], [390, 844, 'dark'], [430, 932, 'light'],
]) {
  test(`Moment cards keep a compact heading and readable titles ${width}px ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const moments = fixtureMoments();
    moments[0].name = 'A very important family journey with many milestones and keepsakes';
    const errors = await seedGuest(page, { moments, theme });
    await page.goto('/events');
    const card = page.locator('.life-journey-items .dn-v2-moment-card').first();
    await expect(card).toBeVisible();
    await expect(card.locator('.event-story-details')).toContainText('1 reflection');
    await expect(card.locator('.event-story-details')).not.toContainText('1 reflections');
    const measure = await card.evaluate((node) => {
      const rect = (selector) => node.querySelector(selector).getBoundingClientRect();
      const button = node.querySelector('.dn-v2-moment-open');
      const heading = rect('.dn-v2-moment-heading');
      const type = rect('.event-story-meta');
      const status = rect('.event-story-status');
      const name = rect('.dn-v2-moment-copy > strong');
      const noMenu = !node.querySelector('.dn-record-menu-trigger');
      const cover = rect('.dn-v2-moment-cover');
      const copy = rect('.dn-v2-moment-copy');
      return {
        paddingRight: getComputedStyle(button).paddingRight,
        headingHeight: heading.height, headingRight: heading.right,
        titleGap: name.top - heading.bottom,
        typeRight: type.right, statusLeft: status.left, statusRight: status.right,
        titleWidth: name.width, titleHeight: name.height,
        titleLineHeight: parseFloat(getComputedStyle(node.querySelector('.dn-v2-moment-copy > strong')).lineHeight),
        titleWhiteSpace: getComputedStyle(node.querySelector('.dn-v2-moment-copy > strong')).whiteSpace,
        noMenu,
        coverRight: cover.right, copyLeft: copy.left, copyRight: copy.right,
        cardRight: node.getBoundingClientRect().right,
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    expect(measure.paddingRight).toBe('0px');
    expect(measure.headingHeight).toBeLessThan(28);
    expect(measure.titleGap).toBeLessThan(9);
    expect(measure.statusLeft).toBeGreaterThan(measure.typeRight);
    expect(Math.abs(measure.statusRight - measure.headingRight)).toBeLessThanOrEqual(1);
    expect(measure.noMenu).toBe(true);
    expect(measure.titleWidth).toBeGreaterThan(140);
    expect(measure.titleWhiteSpace).toBe('normal');
    expect(measure.titleHeight).toBeGreaterThan(measure.titleLineHeight * 1.6);

    expect(measure.copyLeft).toBeGreaterThanOrEqual(measure.coverRight - 1);
    expect(measure.copyRight).toBeLessThanOrEqual(measure.cardRight + 1);
    expect(measure.pageWidth).toBeLessThanOrEqual(width + 1);
    const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    await testInfo.attach(`moment-title-recovery-${width}-${theme}`, {
      body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png',
    });
    await card.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('menu', { name: /Actions for/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: /Actions for/ })).toHaveCount(0);
    await card.locator('.dn-v2-moment-open').tap();
    await expect(page).toHaveURL(/\/events\/moment-one\/story$/);
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
    expect(errors).toEqual([]);
  });
}
