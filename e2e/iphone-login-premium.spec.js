import { test, expect } from '@playwright/test';

// /login is outside the authenticated shell; test it without pre-seeding a session.
// Synthetic Chromium cannot verify a real Google popup or installed Safari behavior.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test('Premium login keeps both access paths visible at ' + width + 'px ' + theme, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript((selectedTheme) => {
        localStorage.removeItem('dn_guest_mode');
        localStorage.setItem('dn_preferences', JSON.stringify({ theme: selectedTheme }));
        localStorage.setItem('dn_theme_choice', selectedTheme);
      }, theme);
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: /Life happens/ })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Your space starts here.' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue as Guest' })).toBeVisible();
      await expect(page.locator('.dn-login-privacy')).toContainText('stay in this browser');

      const measurements = await page.evaluate(() => {
        const selectors = ['.dn-login-layout', '.dn-login-story', '.dn-login-card',
          '.dn-login-google', '.dn-login-guest'];
        return {
          theme: document.documentElement.dataset.theme,
          scrollWidth: document.documentElement.scrollWidth,
          elements: selectors.map((selector) => {
            const rect = document.querySelector(selector).getBoundingClientRect();
            return { selector, left: rect.left, right: rect.right, height: rect.height };
          }),
        };
      });
      expect(measurements.theme).toBe(theme);
      expect(measurements.scrollWidth).toBeLessThanOrEqual(width + 1);
      expect(measurements.elements.every((item) => item.left >= -1 && item.right <= width + 1)).toBe(true);
      expect(measurements.elements.filter((item) => item.selector.includes('google') || item.selector.includes('guest'))
        .every((item) => item.height >= 48)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

test('Guest entry preserves existing local guest records without a forced demo reset', async ({ page }) => {
  const records = [{ id: 'kept-moment', name: 'Saved locally', type: 'Personal', date: '2026-10-23', activities: [], memories: [], attachments: [] }];
  await page.addInitScript((moments) => {
    localStorage.removeItem('dn_guest_mode');
    localStorage.setItem('dn_guest_eventGroups', JSON.stringify(moments));
    localStorage.setItem('dn_guest_incomes', JSON.stringify([{ id: 'kept-income', amount: 18 }]));
    localStorage.setItem('dn_guest_expenses', JSON.stringify([{ id: 'kept-expense', amount: 5 }]));
    localStorage.setItem('dn_preferences', JSON.stringify({ theme: 'dark' }));
  }, records);
  await page.goto('/login');
  const savedBefore = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].map((key) => localStorage.getItem(key)));
  await page.getByRole('button', { name: 'Continue as Guest' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(await page.evaluate(() => localStorage.getItem('dn_guest_mode'))).toBe('true');
  expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses'].map((key) => localStorage.getItem(key)))).toEqual(savedBefore);
});
