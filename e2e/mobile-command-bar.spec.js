import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';
for (const width of [320,390,430]) test(`module search state and creation survive command navigation ${width}`,async({page})=>{
 await page.setViewportSize({width,height:844});const errors=await seedGuest(page);await page.goto('/events');
 const bar=page.locator('.dn-command-bar');
 await bar.getByRole('searchbox',{name:'Search moments'}).fill('Ooty');
 await expect(page.getByRole('button',{name:'Open Weekend in Ooty — family plans and memories'})).toBeVisible();
 await page.getByRole('button',{name:'Open quick create menu'}).click();
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Tasks'}).click();
 await expect(bar.getByRole('searchbox',{name:'Search Tasks'})).toHaveValue('');
 await bar.getByRole('searchbox',{name:'Search Tasks'}).fill('different');
 await bar.getByRole('button',{name:'Refine',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Open quick create menu'}).click();
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Moments'}).click();
 await expect(bar.getByRole('searchbox',{name:'Search moments'})).toHaveValue('Ooty');
 if(width===390) await page.screenshot({path:test.info().outputPath('command-search-mobile.png')});
 await page.getByRole('button',{name:'Open quick create menu'}).click();
 await page.getByRole('button',{name:'Task',exact:true}).click();
 const form=page.getByRole('dialog',{name:'New Task'});await expect(form).toBeVisible();await form.getByRole('button',{name:'Cancel'}).click();
 await expect(page).toHaveURL(/\/events$/);expect(errors).toEqual([]);
});
test('drag snaps, persists, clamps on rotation and can return to dock',async({page})=>{
 await page.setViewportSize({width:390,height:844});const errors=await seedGuest(page);await page.goto('/activities');
 const plus=page.locator('.dn-command-trigger');await expect(plus).toBeVisible();const b=await plus.boundingBox();
 await page.mouse.move(b.x+24,b.y+24);await page.mouse.down();await page.mouse.move(40,330,{steps:12});await page.mouse.up();
 await expect(page.getByRole('dialog',{name:'Navigate & create'})).toHaveCount(0);
 await expect(plus).toHaveCSS('position','fixed');expect((await plus.boundingBox()).x).toBeLessThan(20);
 await page.reload();await expect(plus).toHaveCSS('position','fixed');
 await expect(page.locator('.dn-command-button-slot')).toHaveCSS('width','0px');
 await page.goto('/settings');await expect(plus).toBeVisible();await expect(page.locator('.dn-command-bar')).toHaveCSS('width','0px');
 await page.goto('/activities');await expect(page.locator('.dn-command-controls input')).toBeVisible();
 await page.setViewportSize({width:320,height:640});const clamped=await plus.boundingBox();expect(clamped.x+clamped.width).toBeLessThanOrEqual(320);expect(clamped.y+clamped.height).toBeLessThanOrEqual(640);
 await plus.click();await expect(page.getByRole('dialog',{name:'Navigate & create'})).toHaveCSS('opacity','1');await expect(page.locator('.dn-modal-backdrop')).toHaveCSS('opacity','1');await page.screenshot({path:test.info().outputPath('command-panel-mobile.png')});await page.getByRole('button',{name:'Return to dock'}).click();await expect(plus).not.toHaveCSS('position','fixed');
 await page.reload();await expect(plus).not.toHaveCSS('position','fixed');expect(errors).toEqual([]);
});
test('desktop controls and navigation remain in-page',async({page})=>{
 await page.setViewportSize({width:1280,height:900});await seedGuest(page);await page.goto('/events');
 await expect(page.locator('.dn-command-root')).toHaveCount(0);await expect(page.locator('.dn-list-controls').getByRole('searchbox',{name:'Search moments'})).toBeVisible();await expect(page.locator('.dn-sidebar').getByRole('link',{name:'Tasks'})).toBeVisible();
});
for (const width of [320,390,430]) for(const theme of ['light','dark']){
 test(`no-search routes show only the detached + ${width} ${theme}`,async({page})=>{
  await page.setViewportSize({width,height:844});const errors=await seedGuest(page,{theme});
  for(const route of ['/dashboard','/settings']){
   await page.goto(route);
   const bar=page.locator('.dn-command-bar');
   await expect(page.locator('.dn-command-controls > *')).toHaveCount(0);
   const visual=await bar.evaluate(e=>({w:e.getBoundingClientRect().width,b:getComputedStyle(e).borderTopWidth,bg:getComputedStyle(e).backgroundColor}));
   expect(visual.w).toBeLessThanOrEqual(49);expect(visual.b).toBe('0px');
   expect(visual.bg).toBe('rgba(0, 0, 0, 0)');
   await expect(page.getByRole('button',{name:'Open quick create menu'})).toBeVisible();
   // No permanently reserved search dock on search-free screens.
   const flow=await page.locator('.dn-content').evaluate(node=>{
     const style=getComputedStyle(node);
     return {bottom:parseFloat(style.paddingBottom),focusClearance:parseFloat(style.scrollPaddingBottom)};
   });
   expect(flow.bottom).toBeLessThanOrEqual(50);
   expect(flow.focusClearance).toBeGreaterThanOrEqual(68);
  }
  await page.getByRole('button',{name:'Open quick create menu'}).click();
  await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link')).toHaveCount(5);
  await page.keyboard.press('Escape');expect(errors).toEqual([]);
 });
 test(`mobile glass search retains full module access ${width} ${theme}`,async({page})=>{
  await page.setViewportSize({width,height:844});const errors=await seedGuest(page,{theme});
  for(const route of ['/events','/activities','/tasks','/financials/transactions']){
   await page.goto(route);
   await expect(page.locator('.dn-command-controls .dn-list-controls-search input')).toBeVisible();
   const box=await page.locator('.dn-command-bar').evaluate(e=>{
    const st=getComputedStyle(e),search=e.querySelector('.dn-list-controls-search');
    return {h:e.getBoundingClientRect().height,bg:st.backgroundColor,border:st.borderTopWidth,
      searchH:search.getBoundingClientRect().height,glass:getComputedStyle(search).backgroundImage,
      plus:e.querySelector('.dn-command-trigger').getBoundingClientRect().width,
      refine:e.querySelector('.dn-list-controls-trigger').getBoundingClientRect().height,
      width:document.documentElement.scrollWidth};
   });
   expect(box.h).toBeLessThanOrEqual(49);expect(box.border).toBe('0px');
   expect(box.bg).toBe('rgba(0, 0, 0, 0)');
   expect(box.searchH).toBeGreaterThanOrEqual(44);
   expect(box.glass).toContain('gradient');
   expect(box.plus).toBeGreaterThanOrEqual(47);
   expect(box.refine).toBeGreaterThanOrEqual(44);
   expect(box.width).toBeLessThanOrEqual(width+1);
   // Searchable routes still leave enough room for the entire dock.
   const bottom=await page.locator('.dn-content').evaluate(node=>parseFloat(getComputedStyle(node).paddingBottom));
   expect(bottom).toBeGreaterThanOrEqual(90);
  }
  expect(errors).toEqual([]);
 });
}
