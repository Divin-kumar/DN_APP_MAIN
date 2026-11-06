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
