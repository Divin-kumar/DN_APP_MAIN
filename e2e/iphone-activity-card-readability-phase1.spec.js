import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest, swipe } from './fixtures.js';

// Browser geometry checks do not establish native installed-iPhone behavior.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) for (const theme of ['dark', 'light']) {
  test('full-width Activity titles and readable status at ' + width + 'px ' + theme, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const moments = fixtureMoments();
    const title = 'Book a lakeside weekend with family and thoughtful plans '.repeat(2).trim();
    moments[0].activities[0].title = title;
    moments[0].name = 'Weekend in Ooty with everyone and a longer Moment name to keep recognizable';
    const errors = await seedGuest(page, { moments, theme });
    await page.goto('/activities');
    const card = page.getByRole('group', { name: 'Open ' + title, exact: true });
    await expect(card).toBeVisible();
    await expect(card.locator('.event-activity-status')).toHaveText('In progress');
    await expect(card.locator('.event-activity-moment-name')).toContainText('Weekend in Ooty');
    await expect(card.locator('.event-activity-context > span:last-child')).toContainText(/Due|Past due/);
    await expect(card.locator('.event-activity-priority, .event-activity-context a')).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Activity options' })).toHaveCount(0);
    const metrics = await card.evaluate((node) => {
      const title = node.querySelector('.event-activity-title-row > strong');
      const status = node.querySelector('.event-activity-status');
      const copy = node.querySelector('.event-activity-copy');
      const moment = node.querySelector('.event-activity-moment-name');
      const due = node.querySelector('.event-activity-context > span:last-child');
      return {
        titleSize: parseFloat(getComputedStyle(title).fontSize),
        titleWidth: title.getBoundingClientRect().width,
        textWidth: copy.getBoundingClientRect().width,
        titleBottom: title.getBoundingClientRect().bottom,
        statusTop: status.getBoundingClientRect().top,
        statusSize: parseFloat(getComputedStyle(status).fontSize),
        momentSize: parseFloat(getComputedStyle(moment).fontSize),
        dueSize: parseFloat(getComputedStyle(due).fontSize),
        titleWrap: getComputedStyle(title).whiteSpace,
        clamp: getComputedStyle(title).webkitLineClamp,
        momentWrap: getComputedStyle(moment).whiteSpace,
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    expect(metrics.titleSize).toBeGreaterThanOrEqual(15);
    expect(metrics.titleWidth).toBeGreaterThanOrEqual(metrics.textWidth * .9);
    expect(metrics.titleWrap).toBe('normal');
    expect(metrics.clamp).toBe('3');
    expect(metrics.statusTop).toBeGreaterThanOrEqual(metrics.titleBottom - 1);
    expect(metrics.statusSize).toBeGreaterThanOrEqual(11);
    expect(metrics.momentSize).toBeGreaterThanOrEqual(12);
    expect(metrics.dueSize).toBeGreaterThanOrEqual(11);
    expect(metrics.momentWrap).toBe('normal');
    expect(metrics.pageWidth).toBeLessThanOrEqual(width + 1);

    const source = () => page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses']
      .map((key) => localStorage.getItem(key)));
    const before = await source();
    await card.click();
    await expect(page).toHaveURL(/\/events\/moment-one\/activities\/shared$/);
    await page.goto('/events/moment-one/activities');
    const momentCard = page.getByRole('group', { name: 'Open ' + title, exact: true });
    await expect(momentCard).toBeVisible();
    await expect(momentCard.locator('.event-activity-title-row > strong')).toHaveCSS('font-size', '14px');
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: 'Open ' + title, exact: true })).toBeVisible();
    await page.goto('/activities');
    const again = page.getByRole('group', { name: 'Open ' + title, exact: true });
    await swipe(page, again, { distance: 140 });
    const menu = page.getByRole('menu', { name: /Actions for Book a lakeside weekend/ });
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    expect(await source()).toEqual(before);
    expect(errors).toEqual([]);
  });
}
