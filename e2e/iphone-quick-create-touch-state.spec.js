import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';
test.describe('command touch state',()=>{
 test.use({hasTouch:true,isMobile:true});
 for(const [width,theme] of [[390,'light'],[430,'dark']])test(`touch creation returns to stable command ${width}`,async({page})=>{
  await page.setViewportSize({width,height:844});const errors=await seedGuest(page,{theme});await page.goto('/dashboard');
  const plus=page.locator('.dn-command-trigger');
  const color=()=>plus.evaluate(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}));
  const before=await color();
  await plus.tap();await expect(page.getByRole('dialog',{name:'Navigate & create'})).toBeVisible();
  await page.getByRole('button',{name:'Close dialog'}).tap();await expect(plus).toBeVisible();expect(await color()).toEqual(before);
  await plus.tap();await page.getByRole('button',{name:'Transaction',exact:true}).tap();
  await expect(page.getByRole('dialog',{name:'Add Transaction'})).toBeVisible();await page.getByRole('button',{name:'Cancel',exact:true}).tap();
  await expect(plus).toBeVisible();expect(await color()).toEqual(before);expect(errors).toEqual([]);
 });
});
test('command Escape restores keyboard focus',async({page})=>{
 await seedGuest(page);await page.goto('/dashboard');const plus=page.locator('.dn-command-trigger');await plus.focus();await plus.press('Enter');
 await expect(page.getByRole('dialog',{name:'Navigate & create'})).toBeVisible();await page.keyboard.press('Escape');await expect(plus).toBeFocused();
});

test('quick-create opens all four mobile forms without overlapping sheets or moving Save and Cancel', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = await seedGuest(page, { theme: 'light' });
  await page.goto('/dashboard');

  for (const [action, title] of [
    ['Life moment', 'Create a life moment'],
    ['Activity', 'Add an activity'],
    ['Task', 'New Task'],
    ['Transaction', 'Add Transaction'],
  ]) {
    await page.locator('.dn-command-trigger').dispatchEvent('click', { detail: 1 });
    const menu = page.getByRole('dialog', { name: 'Navigate & create' });
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: action, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: title });
    await expect(dialog).toBeVisible();
    const state = await dialog.evaluate(node => ({
      actionsInBody: node.querySelectorAll('.dn-modal-body .form-actions, .dn-modal-body .event-form-actions').length,
      pinnedActions: node.querySelectorAll('.dn-modal-form-footer-content .form-actions, .dn-modal-form-footer-content .event-form-actions').length,
      visibleDialogs: [...document.querySelectorAll('section[role="dialog"][aria-modal="true"]')]
        .filter(item => !item.inert && getComputedStyle(item).visibility !== 'hidden' && item.getClientRects().length > 0).length,
    }));
    expect(state, action).toEqual({ actionsInBody: 0, pinnedActions: 1, visibleDialogs: 1 });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
