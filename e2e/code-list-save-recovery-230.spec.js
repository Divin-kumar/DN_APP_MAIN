import { test, expect } from '@playwright/test';
import { seedGuest, accountScope, fixtureMoments } from './fixtures.js';

for (const [width, theme] of [[320,'dark'],[390,'light'],[430,'dark'],[1280,'light']]) {
  test(`Code List failed add and rename retain drafts at ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const errors = await seedGuest(page, { theme });
    await page.goto('/settings/code-lists');
    const section = page.locator('#code-list-incomeTypes');
    const input = section.getByRole('textbox', { name: 'Add income type' });
    const records = () => page.evaluate(() => ['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses'].map(k => localStorage.getItem(k)));
    const before = await records();
    await expect(section.getByRole('button', { name: 'Add', exact: true })).toBeDisabled();
    await page.evaluate(() => {
      window.__originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'dn_guest_admin_values') throw new Error('Storage full. Free space and retry.');
        return window.__originalSetItem.call(this, key, value);
      };
    });
    await input.fill('Family allowance');
    await input.press('Enter');
    await expect(section.getByRole('alert')).toContainText('Storage full');
    await expect(input).toHaveValue('Family allowance');
    await section.getByRole('alert').scrollIntoViewIfNeeded();
    await testInfo.attach(`code-list-error-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
    await page.evaluate(() => { Storage.prototype.setItem = window.__originalSetItem; });
    await section.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(input).toHaveValue('');
    await section.getByRole('button', { name: 'Family allowance. Tap to open actions; swipe is optional.', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit value' });
    await dialog.getByRole('textbox').fill('Family support');
    await page.evaluate(async () => {
      const app = (await import('/src/store/useAppStore.js')).default;
      window.__saveCodeLists = app.getState().setAdminValues;
      window.__saveCalls = 0;
      app.setState({ setAdminValues: () => { window.__saveCalls++; return new Promise((resolve, reject) => { window.__rejectSave = reject; }); } });
    });
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Close dialog' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => window.__saveCalls)).toBe(1);
    await page.evaluate(() => window.__rejectSave(new Error('Connection lost. Try again.')));
    await expect(dialog.getByRole('alert')).toContainText('Connection lost');
    await expect(dialog.getByRole('textbox')).toHaveValue('Family support');
    await page.evaluate(async () => { const app = (await import('/src/store/useAppStore.js')).default; app.setState({ setAdminValues: window.__saveCodeLists }); });
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();
    await expect(section.getByRole('button', { name: 'Family support. Tap to open actions; swipe is optional.', exact: true })).toBeVisible();
    expect(await records()).toEqual(before);
    expect(errors).toEqual([]);
  });
}

test('synthetic account reload keeps the rename draft and session changes clear it', async ({ page }) => {
  await seedGuest(page);
  await page.goto('/settings/code-lists');
  await expect(page.locator('#code-list-incomeTypes .code-list-row').first()).toBeVisible();
  await accountScope(page, 'code-list-recovery', fixtureMoments());
  await page.evaluate(async () => {
    // Keep this injected account isolated from the real signed-out auth listener.
    const { authService } = await import('/src/services/firebase.js');
    authService.onAuthChange = () => () => {};
    const app = (await import('/src/store/useAppStore.js')).default;
    app.setState({ adminValuesOwner: 'code-list-recovery', adminValuesLoading: false, adminValuesError: null,
      setAdminValues: async () => { const error = new Error('Account save failed'); app.setState({ adminValuesError: error }); throw error; },
      hydrateAdminValuesForUser: async () => {
        app.setState({ adminValuesLoading: true, adminValuesError: null });
        await new Promise(resolve => { window.__finishCodeReload = resolve; });
        app.setState({ adminValuesLoading: false, adminValuesError: null });
      } });
  });
  await page.locator('#code-list-incomeTypes .code-list-row').first().click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit value' });
  await dialog.getByRole('textbox').fill('Retained account draft');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Account save failed');
  await dialog.getByRole('button', { name: 'Reload Code Lists to retry' }).click();
  await expect(dialog.getByRole('button', { name: 'Reloading Code Lists…' })).toBeDisabled();
  await expect(dialog.getByRole('textbox')).toHaveValue('Retained account draft');
  await page.evaluate(() => window.__finishCodeReload());
  await expect(dialog.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  await expect(dialog.getByRole('textbox')).toHaveValue('Retained account draft');
  await accountScope(page, 'different-account', fixtureMoments());
  await expect(dialog).toHaveCount(0);
});

test('in-use value confirmation remains open after a failed disable', async ({ page }) => {
  const errors = await seedGuest(page, { incomes: [{id:'used-income',name:'Salary',amount:100,type:'Salary',date:'2026-11-04'}] });
  await page.goto('/settings/code-lists');
  await expect(page.locator('#code-list-paymentMethods .code-list-row').first()).toBeVisible();
  await page.locator('#code-list-incomeTypes').getByRole('button', { name: /^Salary\. Tap/ }).click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Value is currently in use' });
  await expect(dialog).toBeVisible();
  await page.evaluate(async () => {
    const app = (await import('/src/store/useAppStore.js')).default;
    window.__saveCodeLists = app.getState().setAdminValues;
    app.setState({ setAdminValues: async () => { throw new Error('Could not save this change'); } });
  });
  await dialog.getByRole('button', { name: 'Disable Value' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Could not save this change');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#code-list-incomeTypes').getByRole('button', { name: /^Salary\. Tap/ })).toBeVisible();
  expect(errors).toEqual([]);
});
