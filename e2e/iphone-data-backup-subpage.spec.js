import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// CHG-231: Data & Backup is a real protected settings subpage, like About
// and Code Lists. All data operations remain under one shared controller.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test(`dedicated Data & Backup keeps every option and guidance readable at ${width}px ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = await seedGuest(page, { theme });
      const before = await page.evaluate(() => [
        localStorage.getItem('dn_guest_eventGroups'),
        localStorage.getItem('dn_guest_incomes'),
        localStorage.getItem('dn_guest_expenses'),
      ]);
      await page.goto('/settings');
      const home = page.locator('.dn-settings-home');
      await expect(home.locator('.settings-section')).toHaveCount(3);
      await expect(home.getByRole('button', { name: /Data & Backup/ })).toHaveCount(0);
      const link = home.getByRole('link', { name: 'Open Data & Backup page' });
      await expect(link).toHaveAttribute('href', '/settings/data-backup');
      await link.click();
      await expect(page).toHaveURL(new RegExp('/settings/data-backup$'));

      const subpage = page.locator('.dn-data-page');
      await expect(subpage.getByRole('heading', { name: 'Data & Backup' })).toBeVisible();
      await expect(subpage.getByText('Guest · this device')).toBeVisible();
      await expect(subpage.getByRole('button', { name: 'Export backup' })).toBeVisible();
      await expect(subpage.getByText('Restore backup', { exact: true })).toBeVisible();
      await expect(subpage.getByRole('button', { name: 'Clear local' })).toBeVisible();
      await expect(subpage.getByRole('button', { name: 'Delete online' })).toHaveCount(0);
      await expect(subpage.getByRole('region', { name: 'Backup and restore' })).toBeVisible();
      await expect(subpage.getByRole('region', { name: 'Clear DN data' })).toBeVisible();

      const nav = subpage.getByRole('navigation', { name: 'Data and Backup sections' });
      await expect(nav.getByRole('link', { name: 'Backup' })).toHaveAttribute('href', '#backup-actions');
      await expect(nav.getByRole('link', { name: 'Manage data' })).toHaveAttribute('href', '#data-management');
      await expect(nav.getByRole('link', { name: 'Data guide' })).toHaveAttribute('href', '#data-guide');
      const guide = subpage.getByRole('region', { name: 'How DN stores your data' });
      await expect(guide).toContainText('Firebase records');
      await expect(guide).toContainText('Original photos');
      await expect(guide).toContainText('Recovery copy');
      const checklist = guide.locator('.dn-data-recovery-guide');
      await checklist.locator('summary').click();
      await expect(checklist.locator('li')).toHaveCount(5);
      await expect(checklist).toContainText('Check the restore preview');

      const geometry = await subpage.evaluate((root) => {
        const bounds = root.getBoundingClientRect();
        const buttons = [...root.querySelectorAll('.dn-data-action-button,.dn-data-outlined-button,.settings-back-button')];
        return {
          pageWidth: document.documentElement.scrollWidth,
          viewportWidth: document.documentElement.clientWidth,
          bounds: { left: bounds.left, right: bounds.right },
          targets: buttons.map((button) => button.getBoundingClientRect().height),
        };
      });
      expect(geometry.bounds.left).toBeGreaterThanOrEqual(-1);
      expect(geometry.bounds.right).toBeLessThanOrEqual(width + 1);
      expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
      expect(geometry.targets.every((height) => height >= 43)).toBe(true);

      // The guide, navigation and confirmation UI must not modify guest data.
      await subpage.getByRole('button', { name: 'Clear local' }).click();
      const dialog = page.getByRole('dialog', { name: 'Clear local DN data?' });
      await dialog.getByRole('button', { name: 'Keep my data' }).click();
      await expect(dialog).toHaveCount(0);
      await subpage.getByRole('link', { name: 'Back to Settings' }).click();
      await expect(page).toHaveURL(new RegExp('/settings$'));
      await expect(page.locator('.settings-section')).toHaveCount(3);
      expect(await page.evaluate(() => [
        localStorage.getItem('dn_guest_eventGroups'),
        localStorage.getItem('dn_guest_incomes'),
        localStorage.getItem('dn_guest_expenses'),
      ])).toEqual(before);
      expect(errors).toEqual([]);
    });
  }
}

test('legacy Settings backup bookmark routes into the separate destination', async ({ page }) => {
  await seedGuest(page);
  await page.goto('/settings#backup');
  await expect(page).toHaveURL(new RegExp('/settings/data-backup$'));
  await expect(page.getByRole('heading', { name: 'Data & Backup' })).toBeVisible();
});
