import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest, swipe } from './fixtures.js';

// CHG-227: the modern popup-menu Moment card must never inherit the old
// horizontal slide-on-hover behavior. Pointer elevation is decorative only.
test.describe('premium Moment cards on fine-pointer screens', () => {
  for (const theme of ['light', 'dark']) {
    test(`hover keeps the full Moment card visible and its popup usable (${theme})`, async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      const errors = await seedGuest(page, { theme });
      await page.goto('/events');
      const card = page.locator('.life-journey-items .dn-v2-moment-card').first();
      await expect(card.locator('.dn-v2-moment-open')).toBeVisible();
      await card.hover();
      const layout = await card.evaluate((root) => {
        const open = root.querySelector('.dn-v2-moment-open');
        const outer = root.getBoundingClientRect();
        const inner = open.getBoundingClientRect();
        return { transform: getComputedStyle(open).transform,
          innerLeft: inner.left, outerLeft: outer.left, innerRight: inner.right,
          outerRight: outer.right, pageWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth };
      });
      expect(layout.transform).toBe('none');
      expect(layout.innerLeft).toBeGreaterThanOrEqual(layout.outerLeft - 1);
      expect(layout.innerRight).toBeLessThanOrEqual(layout.outerRight + 1);
      expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
      const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
      await card.locator('.dn-record-menu-trigger').click();
      await expect(page.getByRole('menu', { name: /Actions for/ })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu', { name: /Actions for/ })).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('premium Moment cards on touch iPhones', () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const [width, height, theme] of [[320, 640, 'light'], [390, 844, 'dark'], [430, 932, 'light']]) {
    test(`Moment touch menu does not leave a raised or shifted card at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const moments = fixtureMoments();
      moments[0].name = 'An important family celebration with photos, plans and treasured memories';
      const errors = await seedGuest(page, { theme, moments });
      await page.goto('/events');
      const card = page.locator('.life-journey-items .dn-v2-moment-card').first();
      await expect(card.locator('.dn-v2-moment-open')).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
      // The menu shares the swipe action handler, but must not adopt a
      // touch-sticky hover elevation from older card styles.
      await card.locator('.dn-record-menu-trigger').tap();
      await expect(page.getByRole('menu', { name: /Actions for/ })).toBeVisible();
      await page.locator('.life-timeline-heading h2').tap();
      await expect(page.getByRole('menu', { name: /Actions for/ })).toHaveCount(0);
      const state = await card.evaluate((root) => ({
        cardOffsetX: getComputedStyle(root).transform === 'none' ? 0
          : new DOMMatrixReadOnly(getComputedStyle(root).transform).m41,
        openTransform: getComputedStyle(root.querySelector('.dn-v2-moment-open')).transform,
        pageWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));
      expect(Math.abs(state.cardOffsetX)).toBeLessThan(0.5);
      expect(state.openTransform).toBe('none');
      expect(state.pageWidth).toBeLessThanOrEqual(state.viewportWidth + 1);
      // Both directions still summon the same lightweight popup.
      for (const distance of [-100, 100]) {
        await swipe(page, card, { distance });
        await expect(page.getByRole('menu', { name: /Actions for/ })).toBeVisible();
        await page.locator('.life-timeline-heading h2').tap();
        await expect(page.getByRole('menu', { name: /Actions for/ })).toHaveCount(0);
      }
      expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
      await card.locator('.dn-v2-moment-open').tap();
      await expect(page).toHaveURL(/\/events\/moment-one\/story$/);
      expect(errors).toEqual([]);
    });
  }
});
