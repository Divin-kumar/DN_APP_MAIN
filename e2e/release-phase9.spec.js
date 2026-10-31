import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { seedGuest } from './fixtures.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

for (const [width, theme] of [[390, 'dark'], [1280, 'light']]) {
  test(`release information and refresh preserve Guest records at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height:900 });
    const errors = await seedGuest(page, { theme });
    await page.goto('/settings/about');
    await expect(page.locator('.about-version-footer')).toContainText(`v${version}`);
    const release = page.locator('.settings-section').filter({ has:page.getByRole('heading', { name:`What's New in v${version}`, exact:true }) });
    for (const text of ['Journal', 'Diary', 'Tasks', 'PDF Studio', 'Cash and Online', 'Settings → Code Lists', 'filters and search', 'Recovery backups', 'Guest demo', 'read-only reflections', 'Coming Soon']) {
      await expect(release).toContainText(text);
    }
    const information = page.locator('.settings-section').filter({ has:page.getByRole('heading', { name:'Version Information', exact:true }) });
    await expect(information).toContainText('Build date');
    await expect(information).toContainText('Test');
    await expect(information).not.toContainText('Production');
    const saved = await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses', 'dn_preferences'].map((key) => localStorage.getItem(key)));
    await page.getByRole('button', { name:'Refresh app', exact:true }).click();
    await expect(page.locator('.about-version-footer')).toContainText(`v${version}`);
    expect(await page.evaluate(() => ['dn_guest_eventGroups', 'dn_guest_incomes', 'dn_guest_expenses', 'dn_preferences'].map((key) => localStorage.getItem(key)))).toEqual(saved);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path:`.verification/phase9-about-${width}.png` });
  });
}
