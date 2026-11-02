import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

test('Moment Type is immediately visible in New/Edit Moment; Other does not require More options', async ({ page }) => {
  const errors = await seedGuest(page, { moments: [] });
  // A fresh Guest's default Code List has no "Other" option. Configure it
  // explicitly in this disposable fixture; never modify the app's defaults.
  await page.addInitScript(() => {
    localStorage.setItem('dn_guest_admin_values', JSON.stringify({
      eventTypes: ['Personal', 'Birthday', 'Other'],
    }));
    localStorage.setItem('dn_guest_admin_values_schema_version', '2');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/events?create=event');

  const createDialog = page.getByRole('dialog', { name: 'New event' });
  await expect(createDialog).toBeVisible();
  const picker = createDialog.getByRole('combobox', { name: 'Moment type' });
  const moreOptions = createDialog.locator('details.dn-form-disclosure');
  await expect(picker).toBeVisible();
  await expect(picker).toBeInViewport();
  await expect(moreOptions).not.toHaveAttribute('open', '');
  await expect(createDialog.getByLabel('Date', { exact: true })).toBeHidden();

  await picker.click();
  await page.getByRole('option', { name: 'Other', exact: true }).click();
  await expect(createDialog.getByLabel('Custom moment type')).toBeVisible();
  await createDialog.getByLabel('Moment name').fill('Visible Type example');
  await createDialog.getByLabel('Custom moment type').fill('Family milestone');
  await createDialog.getByRole('button', { name: 'Save Event' }).click();
  await expect(createDialog).toHaveCount(0);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups') || '[]'));
  const created = saved.find((item) => item.name === 'Visible Type example');
  expect(created?.type).toBe('Other');
  expect(created?.customType).toBe('Family milestone');

  await page.goto('/events');
  await page.getByRole('button', { name: 'Actions for Visible Type example' }).click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: 'Visible Type example' });
  await expect(editDialog.getByRole('combobox', { name: 'Moment type' })).toBeVisible();
  await expect(editDialog.getByLabel('Custom moment type')).toHaveValue('Family milestone');
  await expect(editDialog.locator('details.dn-form-disclosure')).not.toHaveAttribute('open', '');
  expect(errors).toEqual([]);
});
