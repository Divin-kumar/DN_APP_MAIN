import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic touch Chromium only. Keep all records and default preferences intact.
test.use({ isMobile: true, hasTouch: true });
for (const [width, height, theme] of [
  [320, 740, 'dark'], [390, 844, 'light'], [430, 932, 'dark'],
]) {
  test(`Settings, Tasks and PDF use consistent lightweight iPhone controls ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(100000);
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    const size = async (locator) => locator.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));

    await page.goto('/settings');
    await expect(page.getByRole('link', { name: 'Open Appearance & preferences' })).toBeVisible();
    expect(await size(page.locator('.dn-settings-redesign .settings-navigation-hub .settings-hub-copy small').first()))
      .toBeGreaterThanOrEqual(12);
    await page.getByRole('link', { name: 'Open Appearance & preferences' }).tap();
    await expect(page).toHaveURL(/\/settings\/appearance$/);
    expect(await size(page.locator('.dn-appearance-more > a small').first())).toBeGreaterThanOrEqual(12);
    await expect(page.getByRole('region', { name: 'Story and PDF appearance' })).toBeVisible();

    await page.goto('/tasks');
    expect(await size(page.locator('.dn-task-metrics span').first())).toBeGreaterThanOrEqual(12);
    expect(await page.locator('.dn-task-discovery-summary').evaluate((el) =>
      getComputedStyle(el).display)).toBe('grid');
    const before = await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'), localStorage.getItem('dn_guest_expenses'),
      localStorage.getItem('dn_guest_incomes'), localStorage.getItem('dn_guest_tasks'),
    ]);

    await page.goto('/events/moment-one/pdf');
    const studio = page.locator('.dn-pdf-studio-page');
    await expect(studio.getByRole('button', { name: 'Download customized PDF' }))
      .toBeEnabled({ timeout: 30000 });
    const panel = await studio.locator('.dn-pdf-studio-controls').evaluate((el) => ({
      border: getComputedStyle(el).borderTopWidth,
      background: getComputedStyle(el).backgroundColor,
    }));
    expect(panel.border).toBe('0px');
    expect(panel.background).toBe('rgba(0, 0, 0, 0)');
    const style = studio.getByRole('button', { name: 'PDF design Minimal' });
    await style.tap();
    await expect(style).toHaveAttribute('aria-pressed', 'true');
    const styleFrame = await style.evaluate((el) => ({
      top: getComputedStyle(el).borderTopWidth,
      bottom: getComputedStyle(el).borderBottomWidth,
      height: el.getBoundingClientRect().height,
    }));
    expect(styleFrame.top).toBe('0px');
    expect(styleFrame.bottom).toBe('2px');
    expect(styleFrame.height).toBeGreaterThanOrEqual(44);
    expect(await size(studio.locator('.dn-pdf-style-default small'))).toBeGreaterThanOrEqual(12);
    const toggle = studio.locator('.dn-pdf-searchable-option .dn-pdf-studio-toggle');
    expect(await toggle.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('0px');
    await expect(studio.getByText('Changes pending')).toBeVisible();
    await studio.getByRole('button', { name: 'Update preview' }).tap();
    await expect(studio.getByRole('button', { name: 'Download customized PDF' }))
      .toBeEnabled({ timeout: 30000 });
    await testInfo.attach(`dn-230-settings-tasks-pdf-${width}-${theme}`, {
      body: await page.screenshot({ animations: 'disabled', fullPage: false }),
      contentType: 'image/png',
    });
    expect(await page.evaluate(() => [
      localStorage.getItem('dn_guest_eventGroups'), localStorage.getItem('dn_guest_expenses'),
      localStorage.getItem('dn_guest_incomes'), localStorage.getItem('dn_guest_tasks'),
    ])).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width + 1);
    expect(errors).toEqual([]);
  });
}
