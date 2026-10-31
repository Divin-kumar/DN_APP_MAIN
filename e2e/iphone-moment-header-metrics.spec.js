import { test, expect } from '@playwright/test';
import { calendarDate, fixtureMoments, seedGuest } from './fixtures.js';

// CHG-228: the existing three Moment figures now have a predictable visual
// hierarchy across iPhone widths; the underlying values/storage are unchanged.
test.describe('Moment hero premium three-metric strip', () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
    for (const theme of ['light', 'dark']) {
      test(`keeps Steps, Reflections and full INR total usable at ${width}px (${theme})`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        const moments = fixtureMoments();
        moments[0].name = 'A long family journey through important milestones and memories';
        const amount = 123456789;
        const errors = await seedGuest(page, { moments, theme,
          expenses: [{ id: 'large-expense', name: 'Family celebration venue', amount,
            eventId: 'moment-one', date: calendarDate(-1), category: 'Other' }],
        });
        await page.goto('/events/moment-one/story');

        const hero = page.locator('.dn-moment-hero-swipe .event-moment-hero');
        const strip = hero.locator('.event-moment-stat-line');
        const metrics = strip.locator(':scope > .dn-moment-metric');
        await expect(metrics).toHaveCount(3);
        await expect(metrics.locator('small')).toHaveText(['Steps', 'Reflections', 'Spent']);
        await expect(metrics.nth(0).locator('strong')).toHaveText('3');
        await expect(metrics.nth(1).locator('strong')).toHaveText('1');
        const expectedMoney = new Intl.NumberFormat('en-IN', {
          style: 'currency', currency: 'INR', maximumFractionDigits: 0,
        }).format(amount);
        await expect(metrics.nth(2).locator('strong')).toHaveText(expectedMoney);

        const geometry = await hero.evaluate((root) => {
          const stripElement = root.querySelector('.event-moment-stat-line');
          const children = [...stripElement.querySelectorAll(':scope > .dn-moment-metric')];
          const container = root.getBoundingClientRect();
          const stripBounds = stripElement.getBoundingClientRect();
          const boxes = children.map((element) => element.getBoundingClientRect());
          return {
            layout: getComputedStyle(stripElement).display,
            contentColumns: getComputedStyle(stripElement).gridTemplateColumns,
            left: stripBounds.left, right: stripBounds.right,
            top: boxes.map((box) => box.top),
            boundaries: boxes.map((box) => ({ left: box.left, right: box.right })),
            heroLeft: container.left, heroRight: container.right,
            docWidth: document.documentElement.scrollWidth,
            viewportWidth: document.documentElement.clientWidth,
          };
        });
        expect(geometry.layout).toBe('grid');
        expect(geometry.contentColumns.split(' ').length).toBe(3);
        expect(geometry.docWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
        expect(geometry.left).toBeGreaterThanOrEqual(geometry.heroLeft - 1);
        expect(geometry.right).toBeLessThanOrEqual(geometry.heroRight + 1);
        expect(Math.max(...geometry.top) - Math.min(...geometry.top)).toBeLessThan(2);
        for (let index = 0; index < 2; index += 1) {
          expect(geometry.boundaries[index].right).toBeLessThanOrEqual(geometry.boundaries[index + 1].left + 1);
        }
        const back = hero.getByRole('link', { name: 'All moments' });
        const greeting = hero.getByRole('button', { name: 'Preview and edit greeting card' });
        for (const target of [back, greeting]) {
          const box = await target.boundingBox();
          expect(box.width).toBeGreaterThanOrEqual(43);
          expect(box.height).toBeGreaterThanOrEqual(43);
        }

        const before = await page.evaluate(() => [
          localStorage.getItem('dn_guest_eventGroups'),
          localStorage.getItem('dn_guest_expenses'),
          localStorage.getItem('dn_guest_incomes'),
        ]);
        await page.locator('.dn-moment-nav a[href="/events/moment-one/activities"]').click();
        await expect(page.locator('.dn-moment-panel h2')).toHaveText('Plans for this moment');
        await expect(strip).toBeVisible();
        await expect(metrics.nth(2).locator('strong')).toHaveText(expectedMoney);
        expect(await page.evaluate(() => [
          localStorage.getItem('dn_guest_eventGroups'),
          localStorage.getItem('dn_guest_expenses'),
          localStorage.getItem('dn_guest_incomes'),
        ])).toEqual(before);
        expect(errors).toEqual([]);
      });
    }
  }
});
