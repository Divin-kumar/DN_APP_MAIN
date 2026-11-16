import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

for (const theme of ['light', 'dark']) {
  test(`Shared form surfaces and permanent Repeat under More options: ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors = await seedGuest(page, { theme });
    await page.goto('/dashboard');
    for (const kind of ['Task', 'Transaction', 'Moment']) {
      await page.getByRole('button', { name: 'Open quick create menu' }).click();
      await page.getByRole('button', { name: kind === 'Moment' ? 'Life moment' : kind, exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const material = await dialog.evaluate(el => ({
        background: getComputedStyle(el).backgroundImage,
        blur: getComputedStyle(el).backdropFilter,
        opacity: getComputedStyle(el).opacity,
      }));
      expect(material.background).not.toBe('none');
      expect(material.blur).toContain('blur');
      if (kind === 'Task') {
        const title = dialog.getByRole('textbox', { name: 'Task title' });
        expect(await title.evaluate(el => el.getBoundingClientRect().width / el.closest('label').getBoundingClientRect().width)).toBeGreaterThan(.95);
      }
      if (kind !== 'Moment') {
        const more = dialog.locator('details').filter({ has: page.locator('summary').filter({ hasText: 'More options' }) });
        await expect(dialog.getByRole('radio', { name: 'Monthly', exact: true })).toBeHidden();
        await more.locator('summary').click();
        await expect(more.locator('details')).toHaveCount(0);
        await more.getByRole('radio', { name: 'Monthly', exact: true }).check();
        await expect(more.getByRole('radio', { name: 'Monthly', exact: true })).toBeChecked();
        await more.locator('summary').click();
        await expect(more.locator('summary')).toContainText('Monthly');
        await more.locator('summary').click();
        await expect(more.getByRole('radio', { name: 'Monthly', exact: true })).toBeChecked();
      }
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await testInfo.attach(`${kind}-${theme}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
      await dialog.getByRole('button', { name: 'Close dialog' }).click();
    }
    expect(errors).toEqual([]);
  });
}
