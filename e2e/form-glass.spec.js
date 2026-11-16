import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

for (const width of [320, 430]) for (const theme of ['light', 'dark']) {
  test(`Shared form surfaces and permanent Repeat under More options: ${width}px ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const errors = await seedGuest(page, { theme, moments: [], incomes: [], expenses: [] });
    await page.goto('/dashboard');
    for (const name of ['Browse Moments', 'Browse Activities']) {
      const link = page.getByRole('link', { name, exact: true });
      await expect(link).toBeVisible();
      expect(await link.evaluate(el => {
        const parent = el.closest('.dashboard-empty-browse');
        const text = parent.querySelector('p').getBoundingClientRect();
        const action = el.getBoundingClientRect();
        return action.left >= text.right && action.right <= parent.getBoundingClientRect().right + 1;
      })).toBe(true);
    }
    let transactionMaterial;
    for (const kind of ['Transaction', 'Task', 'Moment', 'Activity']) {
      await page.getByRole('button', { name: 'Open quick create menu' }).click();
      await page.getByRole('button', { name: kind === 'Moment' ? 'Life moment' : kind, exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const material = await dialog.evaluate(el => ({
        background: getComputedStyle(el).backgroundImage,
        blur: getComputedStyle(el).backdropFilter,
        border: getComputedStyle(el).borderTopColor,
        scrimBlur: getComputedStyle(el.parentElement).backdropFilter,
      }));
      expect(material.background).not.toBe('none');
      expect(material.blur).toContain('blur');
      expect(material.scrimBlur).toBe('none');
      if (kind === 'Transaction') transactionMaterial = material;
      else expect(material).toEqual(transactionMaterial);
      if (kind === 'Task') {
        const title = dialog.getByRole('textbox', { name: 'Task title' });
        expect(await title.evaluate(el => el.getBoundingClientRect().width / el.closest('label').getBoundingClientRect().width)).toBeGreaterThan(.95);
      }
      const date = dialog.locator('input[type="date"]');
      if (kind === 'Task' || kind === 'Transaction') {
        const time = dialog.locator('input[type="time"]');
        await expect(time).toBeVisible();
        const dateBox = await date.boundingBox(), timeBox = await time.boundingBox();
        expect(Math.abs(dateBox.y - timeBox.y)).toBeLessThan(4);
        expect(timeBox.x).toBeGreaterThan(dateBox.x);
        expect(await dialog.locator('summary').evaluate(el => getComputedStyle(el, '::after').content)).toBe('none');
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
      if (kind === 'Activity') {
        const more = dialog.locator('details.dn-form-disclosure').filter({ has: page.getByText('More options', { exact: true }) });
        const description = more.getByRole('textbox', { name: 'Description (optional)' });
        await expect(dialog.locator('summary > span').filter({ hasText: /^Description$/ })).toHaveCount(0);
        await expect(description).toBeHidden();
        await more.getByText('More options', { exact: true }).click();
        await expect(description).toBeVisible();
        const dateBox = await date.boundingBox(), timeBox = await more.locator('input[type="time"]').boundingBox();
        expect(Math.abs(dateBox.y - timeBox.y)).toBeLessThan(4);
        expect(timeBox.x).toBeGreaterThan(dateBox.x);
      }
      expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      await testInfo.attach(`${kind}-${theme}`, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
      await dialog.getByRole('button', { name: 'Close dialog' }).click();
    }
    expect(errors).toEqual([]);
  });
}
