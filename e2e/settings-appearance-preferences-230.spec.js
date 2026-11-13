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
      await expect(page.getByRole('heading', { name: 'Make DN yours', exact: true })).toBeVisible();
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

      const defaults = page.getByRole('region', { name: 'Defaults for new records' });
      const status = defaults.getByRole('status');
      await expect(status).toHaveText('Defaults saved.');
      await pick(page, 'Default currency', 'USD · US dollar ($)');
      await pick(page, 'Default Moment type', 'Birthday');
      await expect(status).toHaveText('Save defaults to apply your changes.');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dn_preferences')).currency)).not.toBe('USD');
      const reset = await defaults.getByRole('button', { name: 'Reset defaults' }).boundingBox();
      const save = await defaults.getByRole('button', { name: 'Save defaults' }).boundingBox();
      expect(Math.abs(reset.y - save.y)).toBeLessThanOrEqual(1);
      expect(Math.min(reset.height, save.height)).toBeGreaterThanOrEqual(43.9);
      await defaults.getByRole('button', { name: 'Save defaults' }).click();
      await expect(status).toHaveText('Defaults saved.');
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


test('Creation defaults keeps a failed save available for retry', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const errors = await seedGuest(page, { theme: 'dark' });
  await page.goto('/settings/appearance');
  await pick(page, 'Default currency', 'USD · US dollar ($)');
  const defaults = page.getByRole('region', { name: 'Defaults for new records' });
  const status = defaults.getByRole('status');
  const save = defaults.getByRole('button', { name: 'Save defaults' });
  const before = await page.evaluate(() => localStorage.getItem('dn_preferences'));
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'dn_preferences') throw new Error('Storage is unavailable');
      return original.call(this, key, value);
    };
    window.__restorePreferenceWrites = () => { Storage.prototype.setItem = original; };
  });
  await save.click();
  await expect(status).toContainText('Could not save defaults');
  await expect(defaults.getByRole('combobox', { name: 'Default currency' })).toContainText('USD');
  expect(await page.evaluate(() => localStorage.getItem('dn_preferences'))).toBe(before);
  await page.evaluate(() => window.__restorePreferenceWrites());
  await save.click();
  await expect(status).toHaveText('Defaults saved.');
  await defaults.getByRole('button', { name: 'Reset defaults' }).click();
  await expect(defaults.getByRole('combobox', { name: 'Default currency' })).toContainText('INR');
  await expect(status).toHaveText('Save defaults to apply your changes.');
  await page.reload();
  await expect(defaults.getByRole('combobox', { name: 'Default currency' })).toContainText('USD');
  await expect(status).toHaveText('Defaults saved.');
  expect(errors).toEqual([]);
});
