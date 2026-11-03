import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic Guest Chromium is not a substitute for physical iPhone Safari.
for (const [width, height] of [[320, 640], [390, 844], [430, 932]]) {
  for (const theme of ['light', 'dark']) {
    test('Settings destinations and dedicated Appearance are usable at '+width+'px '+theme,
      async ({ page }, testInfo) => {
        await page.setViewportSize({ width, height });
        const errors = await seedGuest(page, { theme });
        await page.goto('/settings');
        await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();
        const original = await page.evaluate(() => [
          'dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses','dn_guest_tasks',
        ].map((key) => localStorage.getItem(key)));
        const home = page.locator('.dn-settings-redesign');
        const nav = home.getByRole('navigation',{name:'Settings destinations'});
        const links = nav.locator('.settings-hub-card');
        await expect(links).toHaveCount(5);
        await expect(home.locator('.settings-accordion-toggle')).toHaveCount(0);
        const positions = await links.evaluateAll((items) => items.map((el) => {
          const rect=el.getBoundingClientRect();
          return {left:rect.left,right:rect.right,height:rect.height};
        }));
        expect(positions.every((item)=>item.height>=60 && item.left>=-1 && item.right<=width+1)).toBe(true);
        const demo = home.getByRole('region',{name:'Explore DN guest demo'});
        if(await demo.count()){
          const navRect = await nav.boundingBox(), demoRect = await demo.boundingBox();
          expect(navRect.y).toBeLessThan(demoRect.y);
        }
        await testInfo.attach('Settings-hub-'+width+'-'+theme,{
          body:await page.screenshot({animations:'disabled'}),contentType:'image/png',
        });

        await home.getByRole('link',{name:'Open Appearance & preferences'}).click();
        await expect(page).toHaveURL(/\/settings\/appearance$/);
        await expect(page.getByRole('heading',{name:'Appearance & preferences'})).toBeVisible();
        await expect(page.getByText('Default dashboard view')).toHaveCount(0);
        const themes=page.getByRole('group',{name:'Color theme'});
        await expect(themes.locator('button')).toHaveCount(2);
        await expect(themes.getByRole('button',{name:/Soft light/})).toBeVisible();
        await expect(themes.getByRole('button',{name:/Dark/})).toBeVisible();
        await expect(page.getByRole('region',{name:'Defaults for new records'})).toBeVisible();
        await expect(page.getByRole('region',{name:'Story and PDF appearance'})).toBeVisible();
        await testInfo.attach('Appearance-'+width+'-'+theme,{
          body:await page.screenshot({animations:'disabled'}),contentType:'image/png',
        });
        await page.locator('.dn-header').getByRole('link',{name:'Back to Settings'}).click();
        await expect(page).toHaveURL(/\/settings$/);

        await nav.getByRole('link',{name:'Open Data & Backup page'}).click();
        await expect(page).toHaveURL(/\/settings\/data-backup$/);
        await expect(page.getByRole('heading',{name:'Data & Backup'})).toBeVisible();
        await expect(page.getByRole('button',{name:'Export backup'})).toBeVisible();
        await page.getByRole('link',{name:'Back to Settings'}).click();
        await expect(page).toHaveURL(/\/settings$/);
        await page.goto('/settings#preferences');
        await expect(page).toHaveURL(/\/settings\/appearance$/);
        const geometry=await page.evaluate(()=>({
          width:document.documentElement.clientWidth, scroll:document.documentElement.scrollWidth,
        }));
        expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);
        expect(await page.evaluate(() => [
          'dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses','dn_guest_tasks',
        ].map((key) => localStorage.getItem(key)))).toEqual(original);
        expect(errors).toEqual([]);
      });
  }
}


test('Appearance theme is independent of unsaved creation defaults, reset and record data', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, { theme: 'dark' });
  await page.goto('/settings/appearance');
  const initialRecords = await page.evaluate(() => [
    'dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses', 'dn_guest_tasks',
  ].map((key) => localStorage.getItem(key)));
  const currency = page.getByRole('combobox', { name: 'Default currency' });
  await currency.click();
  const dropdownSearch = page.locator('.dropdown-menu-portal input[type="search"]');
  if (await dropdownSearch.count()) await dropdownSearch.fill('EUR');
  await page.getByRole('option', { name: /EUR/ }).click();
  await expect(currency).toContainText('EUR');
  await page.getByRole('group', { name: 'Color theme' })
    .getByRole('button', { name: /Soft light/ }).click();
  await expect(currency).toContainText('EUR');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await page.getByRole('button', { name: 'Reset defaults' }).click();
  await expect(currency).toContainText('INR');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await page.getByRole('button', { name: 'Save defaults' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_preferences')));
  expect(saved.theme).toBe('light');
  expect(saved.currency).toBe('INR');
  await page.reload();
  await expect(page.getByRole('group', { name: 'Color theme' })
    .getByRole('button', { name: /Soft light/ })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => [
    'dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses', 'dn_guest_tasks',
  ].map((key) => localStorage.getItem(key)))).toEqual(initialRecords);
  expect(errors).toEqual([]);
});
