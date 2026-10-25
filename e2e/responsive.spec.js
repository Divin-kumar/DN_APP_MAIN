import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest } from './fixtures.js';

async function expectTextContrast(locator) {
  const results = await locator.evaluateAll((nodes) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const rgba = (value) => {
      context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].map((number, index) => index === 3 ? number / 255 : number);
    };
    const luminance = (rgb) => rgb.slice(0, 3).map((value) => {
      const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    return nodes.map((node) => {
      let background = [255, 255, 255];
      const ancestors = []; for (let item = node; item; item = item.parentElement) ancestors.push(item);
      for (const item of ancestors.reverse()) {
        const color = rgba(getComputedStyle(item).backgroundColor);
        background = color.slice(0, 3).map((value, index) => value * color[3] + background[index] * (1 - color[3]));
      }
      const color = rgba(getComputedStyle(node).color);
      const foreground = color.slice(0, 3).map((value, index) => value * color[3] + background[index] * (1 - color[3]));
      const levels = [luminance(foreground), luminance(background)].sort((first, second) => second - first);
      return { text: node.getAttribute('aria-label') || node.textContent.slice(0, 60), ratio: (levels[0] + .05) / (levels[1] + .05) };
    });
  });
  for (const result of results) expect(result.ratio, `Text contrast for ${result.text}`).toBeGreaterThanOrEqual(4.5);
}

const sizes = [[320, 640], [360, 740], [390, 844], [390, 896], [844, 390], [768, 1024], [1024, 768], [1280, 480], [1440, 900], [1920, 1080]];
for (const theme of ['light', 'dark']) for (const [width, height] of sizes) {
  test(`${theme} ${width}x${height}: long Activity, five workspace tabs and transactions stay reachable`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const moments = fixtureMoments();
    moments[0].name = 'A long parent Moment name with family plans, stories and practical arrangements '.repeat(3);
    moments[0].activities[0].title = 'A long Activity title to keep every detail readable on the narrowest phone '.repeat(3);
    moments[0].activities[0].description = '### A readable story\n\nA paragraph with enough detail to test wrapping and reading.\n\n'.repeat(30);
    const errors = await seedGuest(page, { moments, theme });
    await page.goto('/events/moment-one/activities/shared');
    await expect(page.locator('h1')).toHaveText(moments[0].activities[0].title);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.getByRole('link', { name: 'Back to Moment activities', exact: true })).toBeVisible();
    await expectTextContrast(page.locator('.activity-cover-back, .activity-parent-context a, .activity-status-pill'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const frame = await page.locator('.activity-cover').boundingBox();
    if (width < 768) expect(Math.abs(frame.height - height * .4)).toBeLessThan(2);
    else expect(frame.width).toBeGreaterThan(frame.height);
    if (height < 500) expect(frame.height).toBeLessThanOrEqual(height * .45);
    await page.locator('.activity-detail-footer').scrollIntoViewIfNeeded();
    const end = await page.locator('.activity-detail-footer').boundingBox();
    if (width < 768) {
      const dock = await page.locator('.mobile-tabbar').boundingBox();
      expect(end.bottom ?? end.y + end.height).toBeLessThanOrEqual(dock.y + 1);
    }
    await page.goto('/events/moment-one/attachments');
    const tabs = page.locator('.event-workspace-nav a');
    await expect(tabs).toHaveCount(5);
    expect(new Set(await tabs.evaluateAll((links) => links.map((node) => Math.round(node.getBoundingClientRect().top)))).size).toBe(1);
    const active = await page.locator('.event-workspace-nav [aria-current="page"]').boundingBox();
    const rail = await page.locator('.event-workspace-nav').boundingBox();
    expect(active.x).toBeGreaterThanOrEqual(rail.x - 1); expect(active.x + active.width).toBeLessThanOrEqual(rail.x + rail.width + 1);
    await page.goto('/events/moment-one/transactions');
    await expect(page.getByRole('heading', { name: 'Transactions', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expectTextContrast(page.locator('.moment-finance-summary dt, .moment-finance-summary dd, .moment-transactions .dn-transaction-value'));
    await page.goto('/activities');
    const card = page.getByRole('group', { name: `Open ${moments[0].activities[0].title}`, exact: true });
    await expect(card).toBeVisible();
    const title = await card.locator('.event-activity-title-row > strong').boundingBox();
    const menu = await card.getByRole('button', { name: 'Activity options', exact: true }).boundingBox();
    expect(title.x + title.width).toBeLessThanOrEqual(menu.x + 1);
    expect(Math.round(menu.width * 100) / 100).toBeGreaterThanOrEqual(44); expect(Math.round(menu.height * 100) / 100).toBeGreaterThanOrEqual(44);
    await expectTextContrast(page.locator('.event-activity-title-row > strong, .event-activity-status, .event-activity-priority, .event-activity-context a'));
    expect(errors).toEqual([]);
    await page.screenshot({ path: `.verification/activity-card-${theme}-${width}x${height}.png` });
  });
}

test('200% CSS zoom with reduced motion retains reachable actions, menus and final content', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedGuest(page); await page.goto('/events/moment-one/activities/shared');
  await expect(page.locator('h1')).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await page.getByRole('button', { name: 'Activity options', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Delete', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.locator('.activity-detail-footer').scrollIntoViewIfNeeded();
  await expect(page.locator('.activity-detail-footer')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('.dn-route-transition').evaluate((node) => getComputedStyle(node).transform)).toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/);
});
