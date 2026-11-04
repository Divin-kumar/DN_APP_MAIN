import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

const waitForReadablePage = async (page, selector) => {
  await expect.poll(() => page.locator(selector).first().evaluate((element) => {
    let opacity = 1;
    for (let node = element; node && node instanceof Element; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity || 1);
    }
    return opacity;
  })).toBeGreaterThan(0.985);
};

// Focused regression for visual issues seen in the 68 synthetic audit screenshots.
// Verify navigation, 44px targets, visible options, and unchanged Guest records.
for (const [width, height, theme] of [
  [320, 740, 'dark'], [390, 844, 'light'], [390, 844, 'dark'],
]) {
  test('Code Lists sections are discoverable and keyboard/scroll reachable at ' + width + 'px ' + theme, async ({ page }, testInfo) => {
    const errors = await seedGuest(page, { theme });
    await page.setViewportSize({ width, height });
    await page.goto('/settings/code-lists');
    const source = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    const nav = page.getByRole('navigation', { name: 'Code List sections' });
    const rail = nav.locator('.dn-code-list-index-scroll');
    await expect(rail.locator('a')).toHaveCount(6);
    await expect(nav.getByRole('button')).toHaveCount(0);
    await waitForReadablePage(page, '.dn-premium-code-lists');
    await testInfo.attach('CodeListsNav-' + width + '-' + theme,
      { body: await page.screenshot(), contentType: 'image/png' });
    const before = await rail.evaluate((node) => node.scrollLeft);
    await rail.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => rail.evaluate((node) => node.scrollLeft)).toBeGreaterThan(before + 10);
    await expect(nav.getByRole('button')).toHaveCount(0);
    await nav.getByRole('link', { name: 'Payment Methods' }).click();
    await expect(page).toHaveURL(/#code-list-paymentMethods$/);
    await expect(page.locator('#code-list-paymentMethods')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await waitForReadablePage(page, '.dn-premium-code-lists');
    await testInfo.attach('CodeListsDestination-' + width + '-' + theme,
      { body: await page.screenshot(), contentType: 'image/png' });
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(source);
    expect(errors).toEqual([]);
  });

  test('Settings default SortChips display every choice without clipping at ' + width + 'px ' + theme, async ({ page }, testInfo) => {
    const errors = await seedGuest(page, { theme });
    await page.setViewportSize({ width, height });
    await page.goto('/settings/list-defaults');
    const cards = page.locator('.dn-list-defaults-page .dn-defaults-sort-card');
    await expect(cards).toHaveCount(4);
    const geometry = await cards.evaluateAll((nodes) => nodes.map((card) => {
      const rail = card.querySelector('.dn-refine-sort-chips');
      const container = card.getBoundingClientRect();
      const buttons = [...rail.querySelectorAll('button')].map((button) => {
        const rect = button.getBoundingClientRect();
        return { left: rect.left, right: rect.right, height: rect.height, text: button.textContent.trim() };
      });
      return { container:{ left:container.left,right:container.right }, buttons, count:buttons.length };
    }));
    expect(geometry.every((item) => item.count >= 3)).toBe(true);
    for (const group of geometry) {
      for (const button of group.buttons) {
        expect(button.left).toBeGreaterThanOrEqual(group.container.left - 1);
        expect(button.right).toBeLessThanOrEqual(group.container.right + 1);
        expect(Math.round(button.height)).toBeGreaterThanOrEqual(44);
      }
    }
    await expect(cards.first().getByRole('button', { name: 'Sort by Name' })).toBeVisible();
    await waitForReadablePage(page, '.dn-list-defaults-page');
    await testInfo.attach('ListDefaults-' + width + '-' + theme,
      { body: await page.screenshot(), contentType: 'image/png' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });

  test('Data and Backup sections are visible without horizontal scrolling at ' + width + 'px ' + theme, async ({ page }, testInfo) => {
    const errors = await seedGuest(page, { theme });
    await page.setViewportSize({ width, height });
    await page.goto('/settings/data-backup');
    const nav = page.getByRole('navigation', { name: 'Data and Backup sections' });
    const links = nav.locator('a');
    await expect(links).toHaveCount(3);
    const metrics = await links.evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { text: node.textContent.trim(), left:rect.left, right:rect.right, height:rect.height };
    }));
    expect(metrics.map((x) => x.text)).toEqual(['Backup', 'Manage data', 'Data guide']);
    expect(metrics.every((x) => x.left >= -1 && x.right <= width + 1)).toBe(true);
    expect(metrics.every((x) => Math.round(x.height) >= 44)).toBe(true);
    await waitForReadablePage(page, '.dn-data-page');
    await testInfo.attach('Backup-' + width + '-' + theme,
      { body: await page.screenshot(), contentType: 'image/png' });
    await links.last().click();
    await expect(page).toHaveURL(/#data-guide$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });
}
