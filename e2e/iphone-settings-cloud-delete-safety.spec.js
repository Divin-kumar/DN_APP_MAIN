import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// CHG-230: cloud deletion must not be offered to a Guest/demo session.
// These are safe UI checks only; they NEVER invoke a real Firebase deletion.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`Data & Backup clearly separates local and cloud scope at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      await page.goto('/settings/data-backup'); // Read only after the app origin loads.
      const before = await page.evaluate(() => [
        localStorage.getItem('dn_guest_eventGroups'),
        localStorage.getItem('dn_guest_incomes'),
        localStorage.getItem('dn_guest_expenses'),
      ]);
      const controls = page.locator('.dn-data-backup');
      await expect(controls).toBeVisible();
      await expect(controls.getByRole('button', { name: 'Export backup' })).toBeVisible();
      await expect(controls.getByText('Restore backup')).toBeVisible();
      await expect(controls.getByRole('button', { name: 'Clear local' })).toBeVisible();
      await expect(controls.getByRole('button', { name: 'Delete online' })).toHaveCount(0);
      await expect(controls.getByText('To clear Firebase records, sign in')).toBeVisible();

      const geometry = await controls.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          width:rect.width, left:rect.left, right:rect.right,
          page:document.documentElement.scrollWidth,
          viewport:document.documentElement.clientWidth,
          touchTargets:[...element.querySelectorAll('button,.dn-backup-file-picker')].map(button => button.getBoundingClientRect().height),
        };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(-1);
      expect(geometry.right).toBeLessThanOrEqual(width + 1);
      expect(geometry.page).toBeLessThanOrEqual(geometry.viewport + 1);
      expect(geometry.touchTargets.every(size => size >= 44)).toBe(true);

      await controls.getByRole('button', { name: 'Clear local' }).click();
      const dialog = page.getByRole('dialog', { name: 'Clear local DN data?' });
      await expect(dialog).toContainText('account data are retained');
      await dialog.getByRole('button', { name: 'Keep my data' }).click();
      await expect(dialog).toHaveCount(0);
      expect(await page.evaluate(() => [
        localStorage.getItem('dn_guest_eventGroups'),
        localStorage.getItem('dn_guest_incomes'),
        localStorage.getItem('dn_guest_expenses'),
      ])).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}
