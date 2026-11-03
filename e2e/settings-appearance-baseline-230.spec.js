import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Read-only screenshot evidence after the dedicated Appearance and Settings restructure.
// Routes and actions are synthetic Guest only; no writes to personal records.
for (const { width, height, theme } of [
  { width: 320, height: 740, theme: 'dark' },
  { width: 390, height: 844, theme: 'light' },
  { width: 1280, height: 900, theme: 'light' },
]) {
  test('Settings baseline, editing contexts and adjacent surfaces ' + width + ' ' + theme,
    async ({ page }, testInfo) => {
      test.setTimeout(120000);
      const errors = await seedGuest(page, { theme });
      await page.setViewportSize({ width, height });
      const shots = async (name) => {
        await page.waitForTimeout(260);
        await testInfo.attach(name+'-'+width+'-'+theme,{
          body:await page.screenshot({animations:'disabled',fullPage:false}),contentType:'image/png',
        });
      };
      await page.goto('/settings');
      await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
      await shots('01-settings-hub');
      await page.getByRole('link',{name:'Open Appearance & preferences'}).click();
      await expect(page).toHaveURL(/\/settings\/appearance$/);
      await expect(page.getByRole('group',{name:'Color theme'})).toBeVisible();
      await shots('02-appearance-dedicated');
      await page.getByRole('link',{name:'Back to Settings'}).click();
      await expect(page).toHaveURL(/\/settings$/);
      await shots('03-settings-destinations');
      await expect(page.getByText('Coming later. No alerts or reminders are currently sent by DN.')).toBeVisible();
      await shots('04-notifications-placeholder');
      await page.goto('/settings/list-defaults');
      await shots('05-list-defaults');
      await page.goto('/settings/code-lists');
      await shots('06-code-lists');
      await page.goto('/events/moment-one/pdf');
      await expect(page.locator('.dn-pdf-studio-page')).toBeVisible();
      await shots('07-pdf-studio');
      await page.goto('/activities');
      await shots('08-activities');
      await page.goto('/financials/transactions');
      await shots('09-financials');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width+1);
      expect(errors).toEqual([]);
    });
}