import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

async function expectFullMobileScrollCanvas(page) {
  const metrics = await page.locator('.dn-main').evaluate(main => {
    const content = main.querySelector('.dn-content');
    return { reserved:parseFloat(getComputedStyle(main).paddingBottom),
      gap:main.getBoundingClientRect().bottom - content.getBoundingClientRect().bottom };
  });
  expect(metrics.reserved).toBe(0);
  expect(Math.abs(metrics.gap)).toBeLessThanOrEqual(1);
}
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
  for(const route of ['/dashboard','/settings','/settings/about','/settings/appearance']){
   await page.goto(route);
   const bar=page.locator('.dn-command-bar');
   await expect(page.locator('.dn-command-controls > *')).toHaveCount(0);
   const visual=await bar.evaluate(e=>({w:e.getBoundingClientRect().width,b:getComputedStyle(e).borderTopWidth,bg:getComputedStyle(e).backgroundColor}));
   expect(visual.w).toBeGreaterThanOrEqual(51);expect(visual.w).toBeLessThanOrEqual(53);expect(visual.b).toBe('0px');
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
      centers:['.dn-list-controls-search','.dn-list-controls-trigger','.dn-command-trigger'].map(selector=>{
        const rect=e.querySelector(selector).getBoundingClientRect();
        return rect.top + rect.height/2;
      }),
      width:document.documentElement.scrollWidth};
   });
   expect(box.h).toBeLessThanOrEqual(70);expect(box.border).toBe('0px');
   expect(box.bg).toBe('rgba(0, 0, 0, 0)');
   expect(box.searchH).toBeGreaterThanOrEqual(49);
   expect(box.glass).toContain('gradient');
   expect(box.plus).toBeGreaterThanOrEqual(51);expect(box.plus).toBeLessThanOrEqual(53);
   expect(box.refine).toBeGreaterThanOrEqual(49);
   // All three controls must share a centerline; independent translation of
   // Search previously left the draggable + 13px lower on iPhone.
   expect(Math.max(...box.centers)-Math.min(...box.centers)).toBeLessThanOrEqual(1);
   expect(box.width).toBeLessThanOrEqual(width+1);
   // Searchable routes still leave enough room for the entire dock.
   const bottom=await page.locator('.dn-content').evaluate(node=>parseFloat(getComputedStyle(node).paddingBottom));
   expect(bottom).toBeGreaterThanOrEqual(90);
  }
  expect(errors).toEqual([]);
 });
}

for(const theme of ['light','dark']) test(`About History scrolls to its last release without an 88px dead strip at iPhone Plus 430×932 ${theme}`,async({page})=>{
  await page.setViewportSize({width:430,height:932});
  const errors=await seedGuest(page,{theme});
  await page.goto('/settings/about');
  await expect(page.locator('.dn-command-controls > *')).toHaveCount(0);
  await expectFullMobileScrollCanvas(page);
  const last=page.locator('.dn-about-release-entry').last();
  await last.scrollIntoViewIfNeeded();
  const viewport=await page.locator('.dn-content').boundingBox();
  const release=await last.boundingBox();
  expect(release.y+release.height).toBeLessThanOrEqual(viewport.y+viewport.height+2);
  await expect(page.getByRole('button',{name:'Open quick create menu'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('iPhone search focus keeps its page canvas and one glass focus halo',async({page})=>{
 await page.setViewportSize({width:430,height:932});
 const errors=await seedGuest(page,{theme:'dark'});await page.goto('/events');
 const canvas=page.locator('.dn-content');
 await canvas.evaluate(el=>el.scrollTop=165);
 const before=await canvas.evaluate(el=>({top:el.scrollTop,h:el.closest('.dn-main').getBoundingClientRect().height}));
 const input=page.getByRole('searchbox',{name:'Search moments'});
 await input.focus();
 await expect(page.locator('html')).toHaveClass(/dn-command-search-focused/);
 const after=await canvas.evaluate(el=>({top:el.scrollTop,h:el.closest('.dn-main').getBoundingClientRect().height}));
 expect(Math.abs(after.h-before.h)).toBeLessThanOrEqual(1);
 expect(Math.abs(after.top-before.top)).toBeLessThanOrEqual(1);
 const focus=await input.evaluate(el=>({
  outline:getComputedStyle(el).outlineStyle,
  shadow:getComputedStyle(el.closest('.dn-list-controls-search')).boxShadow,
 }));
 expect(focus.outline).toBe('none');expect(focus.shadow).not.toBe('none');
 await input.blur();await expect(page.locator('html')).not.toHaveClass(/dn-command-search-focused/);
 expect(errors).toEqual([]);
});

test('iPhone Search stays aligned to the visual keyboard through Safari viewport jitter',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const errors=await seedGuest(page,{theme:'light'});
 await page.goto('/activities');
 const input=page.getByRole('searchbox',{name:'Search activities and Moments'});
 await input.focus();
 await expect(page.locator('html')).toHaveClass(/dn-command-search-focused/);
 // Chromium has no native software keyboard. Model Safari's shrinking visual
 // viewport and temporary negative offset without changing the document height.
 await page.evaluate(()=>{
   const v=window.visualViewport;
   Object.defineProperty(v,'height',{configurable:true,value:510});
   Object.defineProperty(v,'offsetTop',{configurable:true,value:-20});
   v.dispatchEvent(new Event('resize'));
 });
 await expect(page.locator('.dn-command-root')).toHaveClass(/is-keyboard-open/);
 await expect(input).toBeVisible();
 await expect(input).toBeFocused();
 await expect(page.locator('.dn-command-controls .dn-list-controls-search')).toHaveCount(1);
 const bar=page.locator('.dn-command-bar');
 await expect.poll(async()=>bar.evaluate(node=>Math.round(node.getBoundingClientRect().bottom))).toBe(502);
 const plus=page.getByRole('button',{name:'Open quick create menu'});
 await expect(plus).toBeVisible();
 await page.evaluate(()=>{
   Object.defineProperty(window.visualViewport,'offsetTop',{configurable:true,value:25});
   window.visualViewport.dispatchEvent(new Event('scroll'));
 });
 await expect.poll(async()=>bar.evaluate(node=>Math.round(node.getBoundingClientRect().bottom))).toBe(527);
 // The transient keyboard close must restore the original dock and retain Search.
 await page.evaluate(()=>{
   delete window.visualViewport.height;delete window.visualViewport.offsetTop;
   window.visualViewport.dispatchEvent(new Event('resize'));
 });
 await expect(page.locator('.dn-command-root')).not.toHaveClass(/is-keyboard-open/);
 await expect(input).toBeVisible();
 await input.blur();
 await expect(page.locator('html')).not.toHaveClass(/dn-command-search-focused/);
 await input.focus();
 await plus.click();
 await expect(input).not.toBeFocused();
 await expect(page.getByRole('dialog',{name:'Navigate & create'})).toBeVisible();
 expect(errors).toEqual([]);
});


test('Safari keyboard keeps Search visible when layout and visual viewport both shrink',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const errors=await seedGuest(page,{theme:'light'});await page.goto('/activities');
 const input=page.getByRole('searchbox',{name:'Search activities and Moments'});
 await input.focus();
 const bar=page.locator('.dn-command-bar');
 // iOS sometimes changes window.innerHeight along with visualViewport.height.
 // Under the old difference-only formula this looked like a CLOSED keyboard.
 await page.evaluate(()=>{
   Object.defineProperty(window,'innerHeight',{configurable:true,value:510});
   Object.defineProperty(window.visualViewport,'height',{configurable:true,value:510});
   Object.defineProperty(window.visualViewport,'offsetTop',{configurable:true,value:0});
   window.dispatchEvent(new Event('resize'));
   window.visualViewport.dispatchEvent(new Event('resize'));
 });
 await expect(page.locator('.dn-command-root')).toHaveClass(/is-keyboard-open/);
 await expect.poll(async()=>bar.evaluate(el=>Math.round(el.getBoundingClientRect().bottom))).toBe(502);
 await expect(input).toBeFocused();
 await expect(input).toBeVisible();
 // Safari may pan the visual viewport DOWN while leaving the keyboard up.
 // Even if the computed keyboard inset drops to zero, Search must track it.
 await page.evaluate(()=>{
   Object.defineProperty(window.visualViewport,'offsetTop',{configurable:true,value:330});
   window.visualViewport.dispatchEvent(new Event('scroll'));
 });
 await expect(page.locator('.dn-command-root')).toHaveClass(/is-keyboard-open/);
 await expect.poll(async()=>bar.evaluate(el=>Math.round(el.getBoundingClientRect().bottom))).toBe(832);
 // Computed bottom can resolve to pixels even with CSS bottom:auto; assert
 // the actual dock placement instead of the browser's resolved style text.
 const placed=await bar.evaluate(el=>({
   top:Math.round(el.getBoundingClientRect().top),
   height:Math.round(el.getBoundingClientRect().height),
 }));
 expect(placed.top).toBe(780);
 expect(placed.height).toBe(52);
 await page.evaluate(()=>{
   delete window.innerHeight;
   delete window.visualViewport.height;
   delete window.visualViewport.offsetTop;
   window.visualViewport.dispatchEvent(new Event('resize'));
   window.dispatchEvent(new Event('resize'));
 });
 await expect(page.locator('.dn-command-root')).not.toHaveClass(/is-keyboard-open/);
 await expect(input).toBeVisible();
 await input.blur();
 expect(errors).toEqual([]);
});

test('top-right profile hides duplicate Task and Transaction links; + preserves creation',async({page})=>{
 await page.setViewportSize({width:430,height:932});await seedGuest(page);await page.goto('/events');
 await page.getByRole('button',{name:'Open profile and account menu'}).click();
 const menu=page.getByRole('menu',{name:'Profile and account'});
 await expect(menu.getByRole('menuitem',{name:'Tasks'})).toHaveCount(0);
 await expect(menu.getByRole('menuitem',{name:'Transactions'})).toHaveCount(0);
 await expect(menu.getByRole('menuitem',{name:'Settings'})).toBeVisible();
 await expect(page.locator('.dn-command-trigger .dn-create-glyph')).toBeVisible();
 await expect(page.locator('.dn-command-trigger .dn-create-glyph')).toHaveCount(1);
});

test('animated creation opens and reverses, with matching form focus treatment',async({page})=>{
 await page.setViewportSize({width:390,height:844});await seedGuest(page,{theme:'light'});
 await page.goto('/events');
 const character=page.locator('.dn-command-trigger .dn-create-glyph');
 await expect(character).toBeVisible();
 await page.getByRole('button',{name:'Open quick create menu'}).click();
 await expect(page.getByRole('dialog',{name:'Navigate & create'})).toBeVisible();
 await page.getByRole('button',{name:'Life moment',exact:true}).click();
 const sheet=page.getByRole('dialog',{name:'Create a life moment'});
 await expect(sheet).toBeVisible();
 const field=sheet.locator('input:not([type="checkbox"]):not([type="radio"])').first();
 await field.focus();
 const styles=await field.evaluate(input=>({outline:getComputedStyle(input).outlineStyle,shadow:getComputedStyle(input).boxShadow}));
 expect(styles.outline).toBe('none');
 expect(styles.shadow).not.toBe('none');
 await sheet.getByRole('button',{name:'Close dialog'}).click();
 await expect(sheet).toHaveCount(0);
 await expect(character).toBeVisible();
});
test('reduced motion retains the + and accessible command sheet without animation',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.setViewportSize({width:430,height:932});await seedGuest(page,{theme:'dark'});await page.goto('/tasks');
 const mascot=page.locator('.dn-command-trigger .dn-create-glyph');
 await expect(mascot).toBeVisible();
 expect(await mascot.evaluate(node=>getComputedStyle(node).animationName)).toBe('none');
 await page.getByRole('button',{name:'Open quick create menu'}).click();
 await expect(page.getByRole('dialog',{name:'Navigate & create'})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog',{name:'Navigate & create'})).toHaveCount(0);
 await expect(mascot).toBeVisible();
});

test('solid blue circular plus stays visible at 320/390/430 and the sheet moves',async({page})=>{
 for(const width of [320,390,430]){
  await page.setViewportSize({width,height:844});
  await seedGuest(page,{theme:width===390?'dark':'light'});await page.goto('/events');
  const button=page.getByRole('button',{name:'Open quick create menu'});
  const b=await button.boundingBox();
  expect(b.width).toBeGreaterThanOrEqual(51);expect(b.height).toBeGreaterThanOrEqual(51);
  const visual=await button.evaluate(node=>({background:getComputedStyle(node).backgroundColor,border:getComputedStyle(node).borderTopWidth,
    radius:getComputedStyle(node).borderRadius,color:getComputedStyle(node).color,
    icon:getComputedStyle(node.querySelector('.dn-create-glyph')).color}));
  expect(visual.background).toBe('rgb(67, 131, 245)');
  expect(visual.border).toBe('0px');expect(visual.radius).toBe('50%');
  expect(visual.color).toBe('rgb(255, 255, 255)');
  expect(visual.icon).toBe('rgb(255, 255, 255)');
  expect(b.x+b.width).toBeLessThanOrEqual(width+1);
  const plus=button.locator('.dn-create-glyph');
  await expect(plus).toBeVisible();
  expect(await plus.evaluate(el=>Math.round(el.getBoundingClientRect().width))).toBeGreaterThanOrEqual(30);
  await button.click();
  const sheet=page.getByRole('dialog',{name:'Navigate & create'});
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(90);
  const midway=await sheet.evaluate(el=>getComputedStyle(el).transform);
  await page.waitForTimeout(470);
  const settled=await sheet.evaluate(el=>getComputedStyle(el).transform);
  expect(midway).not.toBe(settled);
  await sheet.getByRole('button',{name:'Activity',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Add an activity'});
  await expect(form).toBeVisible();
  await expect(sheet).toHaveCount(0);
  await form.getByRole('button',{name:'Cancel'}).click();
  await expect(form).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Open quick create menu'})).toBeVisible();
 }
});

test('mobile command and form sheets slide down from their header without changing Guest records',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 const errors=await seedGuest(page,{theme:'dark'});
 await page.goto('/events');
 const before=await page.evaluate(()=>localStorage.getItem('dn_guest_eventGroups'));
 const swipeHeader=async name=>{
   const modal=page.getByRole('dialog',{name});
   await expect(modal).toBeVisible();
   // Release after the opening transition has settled, then pull only the sheet
   // title/grabber. Text fields and scrollable bodies must retain touch scrolling.
   await expect.poll(async()=>modal.evaluate(node=>getComputedStyle(node).transform)).not.toBe('matrix(1, 0, 0, 1, 0, 100)');
   await page.waitForTimeout(450);
   const header=modal.locator('.dn-modal-header');
   const rect=await header.boundingBox();
   const x=rect.x+Math.min(80,rect.width/3), y=rect.y+rect.height/2;
   await page.mouse.move(x,y);
   await page.mouse.down();
   await page.mouse.move(x,y+205,{steps:12});
   await page.mouse.up();
   await expect(modal).toHaveCount(0,{timeout:3000});
 };
 await page.getByRole('button',{name:'Open quick create menu'}).click();
 await swipeHeader('Navigate & create');
 await page.getByRole('button',{name:'Open quick create menu'}).click();
 await page.getByRole('button',{name:'Life moment',exact:true}).click();
 await swipeHeader('Create a life moment');
 expect(await page.evaluate(()=>localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
 expect(errors).toEqual([]);
});


test('bottom sheet dismisses from safe body touch, but not from an editable field', async ({page}) => {
 await page.setViewportSize({width:390,height:844});
 const errors=await seedGuest(page,{theme:'light'});await page.goto('/events');
 const swipe=async locator => locator.evaluate(el=>{
   const start=new Touch({identifier:7,target:el,clientX:120,clientY:350});
   const end=new Touch({identifier:7,target:el,clientX:124,clientY:510});
   el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[start],targetTouches:[start],changedTouches:[start]}));
   el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,cancelable:true,touches:[],targetTouches:[],changedTouches:[end]}));
 });
 await page.getByRole('button',{name:'Open quick create menu'}).click();
 const menu=page.getByRole('dialog',{name:'Navigate & create'});
 await expect(menu).toBeVisible();
 await page.waitForTimeout(430);
 await swipe(menu.locator('.dn-command-actions h3'));
 await expect(menu).toHaveCount(0,{timeout:3000});
 await page.getByRole('button',{name:'Open quick create menu'}).click();
 await page.getByRole('button',{name:'Life moment',exact:true}).click();
 const form=page.getByRole('dialog',{name:'Create a life moment'});
 await expect(form).toBeVisible();
 await page.waitForTimeout(430);
 await swipe(form.locator('input').first());
 await expect(form).toBeVisible();
 await form.getByRole('button',{name:'Close dialog'}).click();
 // The close button now uses the same reverse slide instead of unmounting.
 await expect(form).toBeVisible();
 await expect(form).toHaveCount(0,{timeout:3000});
 expect(errors).toEqual([]);
});


// All phone bottom-sheet variants use the same glass layer, independent of
// the underlying list route, and only the shell is translucent.
for (const [width, theme] of [[320,'light'],[390,'dark'],[430,'light']]) {
 test(`phone glass stays legible at ${width}px ${theme}`,async({page})=>{
  await page.setViewportSize({width,height:width===320?700:932});
  const errors=await seedGuest(page,{theme});
  await page.goto('/activities');
  await page.getByRole('button',{name:'Open quick create menu'}).click();
  const dialog=page.getByRole('dialog',{name:'Navigate & create'});
  await expect(dialog).toBeVisible();
  const glass=await dialog.evaluate(el=>{
    const css=getComputedStyle(el);
    const r=el.getBoundingClientRect();
    return {background:css.backgroundColor,filter:css.backdropFilter,opacity:css.opacity,
      width:r.width,left:r.left,right:r.right};
  });
  expect(glass.background).toMatch(/(?:\/\s*0\.\d+|rgba\([^)]*,\s*0\.\d+\))/);
  expect(glass.filter).toContain('blur(');
  expect(glass.opacity).toBe('1');
  expect(glass.left).toBeGreaterThanOrEqual(-1);
  expect(glass.right).toBeLessThanOrEqual(width+1);
  await dialog.getByRole('button',{name:'Close dialog'}).click();
  await expect(dialog).toHaveCount(0);
  const refine=page.getByRole('button',{name:/^Filters and sort/}).first();
  await refine.click();
  const filter=page.getByRole('dialog',{name:'Activity filters'});
  await expect(filter).toBeVisible();
  const filterGlass=await filter.evaluate(el=>({bg:getComputedStyle(el).backgroundColor,blur:getComputedStyle(el).backdropFilter}));
  expect(filterGlass.bg).toMatch(/(?:\/\s*0\.\d+|rgba\([^)]*,\s*0\.\d+\))/);
  expect(filterGlass.blur).toContain('blur(');
  await filter.getByRole('button',{name:'Close dialog'}).click();
  await expect(filter).toHaveCount(0);
  expect(errors).toEqual([]);
 });
}

test('double-tapping the universal + returns to the previous DN page without opening a sheet', async ({page}) => {
  await page.setViewportSize({width:430,height:932});
  const errors = await seedGuest(page,{theme:'light'});
  await page.goto('/events');
  const plus = page.getByRole('button',{name:'Open quick create menu'});
  const before = await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses'].map(key=>localStorage.getItem(key)));
  await plus.click();
  await expect(page.getByRole('dialog',{name:'Navigate & create'})).toBeVisible();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Activities'}).click();
  await expect(page).toHaveURL(/\/activities$/);
  await expect(page.getByRole('dialog',{name:'Navigate & create'})).toHaveCount(0);
  await plus.dblclick({delay:60});
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByRole('dialog',{name:'Navigate & create'})).toHaveCount(0);
  await page.waitForTimeout(400);
  await expect(page.getByRole('dialog',{name:'Navigate & create'})).toHaveCount(0);
  await plus.click();
  await expect(page.getByRole('dialog',{name:'Navigate & create'})).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses'].map(key=>localStorage.getItem(key)))).toEqual(before);
  expect(errors).toEqual([]);
});

test('double-tap on a directly opened deep link stays inside DN; keyboard single activation is instant', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const errors = await seedGuest(page,{theme:'dark'});
  await page.goto('/settings/about');
  const plus = page.getByRole('button',{name:'Open quick create menu'});
  await plus.dblclick({delay:60});
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole('dialog',{name:'Navigate & create'})).toHaveCount(0);
  await plus.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog',{name:'Navigate & create'})).toBeVisible();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('starting to drag during single-tap recognition cancels menu opening', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const errors = await seedGuest(page);
  await page.goto('/activities');
  const plus = page.getByRole('button',{name:'Open quick create menu'});
  const rect = await plus.boundingBox();
  await plus.click();
  await page.mouse.move(rect.x+24,rect.y+24);
  await page.mouse.down();
  await page.mouse.move(40,330,{steps:10});
  await page.mouse.up();
  await page.waitForTimeout(420);
  await expect(page.getByRole('dialog',{name:'Navigate & create'})).toHaveCount(0);
  await expect(plus).toHaveCSS('position','fixed');
  expect(errors).toEqual([]);
});

// iPhone navigation animations must keep Guest records and routes unchanged.
for(const width of [320,390,430]) test('Navigation tile response preserves records at '+width+'px',async({page})=>{
 await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'no-preference'});
 const errors=await seedGuest(page);await page.goto('/events');
 const before=await page.evaluate(()=>localStorage.getItem('dn_guest_eventGroups'));
 await page.getByRole('button',{name:'Open quick create menu'}).click();
 const menu=page.getByRole('dialog',{name:'Navigate & create'});
 const nav=menu.getByRole('navigation',{name:'Main navigation'});
 await expect(nav.getByRole('link',{name:'Moments'})).toHaveAttribute('aria-current','page');
 await expect(nav.getByRole('link',{name:'Home'})).toHaveCSS('animation-name','dn-command-tile-arrive');
 await nav.getByRole('link',{name:'Tasks'}).click();
 await expect(page).toHaveURL(/\/tasks$/);await expect(menu).toHaveCount(0);
 expect(await page.evaluate(()=>localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
 expect(errors).toEqual([]);
});
test('Reduced Motion keeps keyboard navigation without tile animation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
 const errors=await seedGuest(page);await page.goto('/events');
 await page.getByRole('button',{name:'Open quick create menu'}).click();
 const menu=page.getByRole('dialog',{name:'Navigate & create'});
 const nav=menu.getByRole('navigation',{name:'Main navigation'});
 await expect(nav.getByRole('link',{name:'Home'})).toHaveCSS('animation-name','none');
 await expect(menu.getByRole('button',{name:'Task',exact:true})).toHaveCSS('animation-name','none');
 await page.keyboard.press('Tab');await expect(nav.getByRole('link',{name:'Home'})).toBeFocused();
 await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);
 expect(errors).toEqual([]);
});
