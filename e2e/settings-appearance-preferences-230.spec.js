import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

async function pick(page, name, option) {
  await page.getByRole('combobox', { name, exact: true }).click();
  const search = page.locator('.dropdown-menu-portal input[type="search"]');
  if (await search.count()) await search.fill(option);
  await page.getByRole('option', { name: option, exact: true }).click();
}

for (const { width, height, theme } of [
  { width: 320, height: 740, theme: 'dark' },
  { width: 390, height: 844, theme: 'light' },
  { width: 1280, height: 900, theme: 'dark' },
]) {
  test('Appearance preferences persist and existing Guest records stay unchanged at ' + width + 'px ' + theme,
    async ({ page }, testInfo) => {
      const errors = await seedGuest(page, { theme });
      await page.setViewportSize({ width, height });
      await page.goto('/settings/appearance');
      await expect(page.getByRole('heading', { name: 'Appearance & preferences', exact: true })).toBeVisible();
      const before = await page.evaluate(() => [
        'dn_guest_eventGroups', 'dn_guest_expenses', 'dn_guest_incomes', 'dn_guest_tasks',
      ].map(key => localStorage.getItem(key)));
      const themePicker = page.getByRole('group', { name: 'Color theme' });
      const light = themePicker.getByRole('button', { name: /Soft light/ });
      const dark = themePicker.getByRole('button', { name: /Dark/ });
      await expect(theme === 'dark' ? dark : light).toHaveAttribute('aria-pressed', 'true');
      await light.click();
      await expect(light).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dn_preferences')).theme)).toBe('light');
      await dark.click();
      await expect(dark).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');

      await pick(page, 'Default currency', 'USD · US dollar ($)');
      await pick(page, 'Default Moment type', 'Birthday');
      await page.getByRole('button', { name: 'Save defaults' }).click();
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dn_preferences')).currency)).toBe('USD');
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('dn_preferences')).defaultEventType)).toBe('Birthday');
      await page.reload();
      await expect(page.getByRole('combobox', { name: 'Default currency' })).toContainText('USD');
      await expect(page.getByRole('combobox', { name: 'Default Moment type' })).toContainText('Birthday');
      await expect(page.getByText('Default dashboard view')).toHaveCount(0);

      await testInfo.attach('Appearance-saved-' + width + '-' + theme, {
        body: await page.screenshot({ animations:'disabled', fullPage:false }),
        contentType:'image/png',
      });
      const size = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
      }));
      expect(size.scroll).toBeLessThanOrEqual(size.viewport + 1);
      expect(await page.evaluate(() => [
        'dn_guest_eventGroups', 'dn_guest_expenses', 'dn_guest_incomes', 'dn_guest_tasks',
      ].map(key => localStorage.getItem(key)))).toEqual(before);
      expect(errors).toEqual([]);
    });
}

test('Saved new-Moment type is honored by actual creation form without affecting existing Moments',async({page})=>{
  const errors=await seedGuest(page,{moments:[]});
  await page.setViewportSize({width:390,height:844});
  await page.goto('/settings/appearance');
  await pick(page,'Default Moment type','Birthday');
  await page.getByRole('button',{name:'Save defaults'}).click();
  await page.goto('/events?create=event');
  const editor=page.getByRole('dialog',{name:'New event'});
  await expect(editor.getByRole('combobox',{name:'Moment type'})).toContainText('Birthday');
  await editor.getByRole('button',{name:'Cancel'}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dn_guest_eventGroups')))).toEqual([]);
  expect(errors).toEqual([]);
});

test('legacy Settings bookmarks and header Back stay consistent and do not open modal states',async({page})=>{
  const errors=await seedGuest(page,{theme:'dark'});
  await page.setViewportSize({width:320,height:740});
  await page.goto('/settings#theme');
  await expect(page).toHaveURL(/\/settings\/appearance$/);
  await page.locator('.dn-header').getByRole('link',{name:'Back to Settings'}).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.locator('.dn-settings-home .settings-accordion-toggle')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Open Appearance & preferences'})).toBeVisible();
  await expect(page.getByText('Coming later. No alerts or reminders are currently sent by DN.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});
