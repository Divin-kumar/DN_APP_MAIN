import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Evidence-only source state, before the Appearance and Settings restructure.
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
      await page.getByRole('button',{name:/Appearance & preferences/}).click();
      await expect(page.getByText('Default dashboard view',{exact:true})).toBeVisible();
      await shots('02-appearance-expanded');
      await page.getByRole('button',{name:/Profile/}).click();
      await shots('03-profile-expanded');
      await page.getByRole('button',{name:/Notifications/}).click();
      await shots('04-notifications-expanded');
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