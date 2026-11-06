import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';
for(const [width,height] of [[320,640],[375,667],[390,844],[430,932]])for(const theme of ['light','dark']) {
 test(`command panel fits and preserves creation at ${width} ${theme}`,async({page})=>{
  await page.setViewportSize({width,height});const errors=await seedGuest(page,{theme});await page.goto('/events');
  const before=await page.evaluate(()=>localStorage.getItem('dn_guest_eventGroups'));
  const bar=page.locator('.dn-command-bar');const rect=await bar.boundingBox();
  expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(width);expect(rect.y+rect.height).toBeLessThanOrEqual(height);
  await expect(bar.getByRole('searchbox',{name:'Search moments'})).toBeVisible();
  await expect(page.locator('.events-page .dn-list-controls-row')).toHaveCount(0);
  await page.getByRole('button',{name:'Open quick create menu'}).click();
  const dialog=page.getByRole('dialog',{name:'Navigate & create'});await expect(dialog).toBeVisible();
  const d=await dialog.boundingBox();expect(d.x).toBeGreaterThanOrEqual(0);expect(d.x+d.width).toBeLessThanOrEqual(width+1);
  await expect(dialog.getByRole('navigation').getByRole('link')).toHaveCount(5);
  await dialog.getByRole('button',{name:'Transaction',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Add Transaction'});await expect(form).toBeVisible();await form.getByRole('button',{name:'Cancel'}).click();
  await expect(bar).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('dn_guest_eventGroups'))).toBe(before);expect(errors).toEqual([]);
 });
}
test('Transactions keeps nested results above the command bar',async({page})=>{
 await page.setViewportSize({width:390,height:667});await seedGuest(page);await page.goto('/financials/transactions');
 const results=page.locator('.dn-transactions-results');await expect(results).toBeVisible();
 const r=await results.boundingBox(),d=await page.locator('.dn-command-bar').boundingBox();expect(r.y+r.height).toBeLessThanOrEqual(d.y+2);
});
test.describe('short touch landscape command bar',()=>{
 test.use({hasTouch:true});
 for(const [width,height] of [[844,390],[932,430]])test(`rotation retains navigation search and create ${width}`,async({page})=>{
  await page.setViewportSize({width:390,height:844});const errors=await seedGuest(page);await page.goto('/activities');await page.setViewportSize({width,height});
  await expect(page.locator('.dn-sidebar')).toBeHidden();await expect(page.locator('.dn-command-bar')).toBeVisible();
  await page.getByRole('button',{name:'Open quick create menu'}).click();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Finance'}).click();
  await expect(page).toHaveURL(/financials\/transactions$/);
  const r=await page.locator('.dn-transactions-results').boundingBox(),d=await page.locator('.dn-command-bar').boundingBox();expect(r.y+r.height).toBeLessThanOrEqual(d.y+2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);expect(errors).toEqual([]);
 });
});
