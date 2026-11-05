import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

test('Default New/Edit Moment shows Name then Type without opening More options', async ({ page }) => {
  const errors = await seedGuest(page, { moments: [], incomes: [], expenses: [] });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/events?create=event');

  const create = page.getByRole('dialog', { name: 'New event' });
  await expect(create).toBeVisible();
  const name = create.getByLabel('Moment name');
  const type = create.getByRole('combobox', { name: 'Moment type' });
  await expect(name).toBeVisible();
  await expect(type).toBeVisible();
  await expect(name).toBeInViewport();
  await expect(type).toBeInViewport();
  await expect(type).toContainText('Personal');
  await expect(create.locator('form.event-form > label').nth(0)).toContainText('Moment name');
  await expect(create.locator('form.event-form > label').nth(1)).toContainText('Moment type');
  await expect(create.locator('details.dn-form-disclosure')).not.toHaveAttribute('open', '');
  await expect(create.getByLabel('Date', { exact: true })).toBeHidden();

  // Save with the configured default and existing hidden date. No "Other"
  // selection or More options expansion should ever be required.
  await name.fill('Baseline Moment');
  await create.getByRole('button', { name: 'Save Event' }).click();
  await expect(create).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('dn_guest_eventGroups') || '[]'));
  const added = saved.find((moment) => moment.name === 'Baseline Moment');
  expect(added?.type).toBe('Personal');
  expect(added?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(added?.recurrence).toBe('none');

  await page.goto('/events');
  const card = page.locator('.dn-v2-moment-card').filter({ hasText: 'Baseline Moment' });
  await card.focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Baseline Moment' });
  await expect(edit.getByLabel('Moment name')).toBeVisible();
  await expect(edit.getByRole('combobox', { name: 'Moment type' })).toBeVisible();
  await expect(edit.getByRole('combobox', { name: 'Moment type' })).toContainText('Personal');
  await expect(edit.locator('details.dn-form-disclosure')).not.toHaveAttribute('open', '');
  expect(errors).toEqual([]);
});

test('Configured custom Moment Type stays accessible without opening More options', async ({ page }) => {
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
  const card = page.locator('.dn-v2-moment-card').filter({ hasText: 'Visible Type example' });
  await card.focus();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  const editDialog = page.getByRole('dialog', { name: 'Visible Type example' });
  await expect(editDialog.getByRole('combobox', { name: 'Moment type' })).toBeVisible();
  await expect(editDialog.getByLabel('Custom moment type')).toHaveValue('Family milestone');
  await expect(editDialog.locator('details.dn-form-disclosure')).not.toHaveAttribute('open', '');
  expect(errors).toEqual([]);
});
