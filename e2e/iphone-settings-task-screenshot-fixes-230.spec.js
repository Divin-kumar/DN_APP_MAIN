import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Source and owner screenshot evidence: simulated mobile Chromium, not native Safari.
test.use({ hasTouch: true, isMobile: true });

for(const [width,height,theme] of [
  [320,640,'dark'],[390,844,'light'],[430,932,'dark'],[844,390,'light'],
]){
  test(`Saved sort choices, Appearance spacing and Task rows ${width}x${height} ${theme}`,async({page},testInfo)=>{
    await page.setViewportSize({width,height});
    const errors=await seedGuest(page,{theme});
    await page.goto('/settings/list-defaults');
    const before=await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses','dn_guest_tasks']
      .map(key=>localStorage.getItem(key)));
    const cards=page.locator('.dn-list-defaults-page .dn-defaults-sort-card');
    await expect(cards).toHaveCount(3);
    for(const card of await cards.all()){
      const bounds=await card.evaluate(node=>{
        const buttons=[...node.querySelectorAll('.dn-refine-sort-chips button')];
        const c=node.getBoundingClientRect();
        const rail=node.querySelector('.dn-refine-sort-chips');
        return {num:buttons.length,first:Math.min(...buttons.map(b=>b.getBoundingClientRect().left)),
          last:Math.max(...buttons.map(b=>b.getBoundingClientRect().right)),
          left:c.left,right:c.right,overflow:rail.scrollWidth-rail.clientWidth};
      });
      expect(bounds.num).toBeGreaterThan(2);
      expect(bounds.first).toBeGreaterThanOrEqual(bounds.left-2);
      expect(bounds.last).toBeLessThanOrEqual(bounds.right+2);
      expect(bounds.overflow).toBeLessThanOrEqual(1);
    }
    await testInfo.attach(`list-sort-${width}-${theme}`,{
      body:await page.screenshot({animations:'disabled'}),contentType:'image/png',
    });
    await page.goto('/settings/appearance');
    const gap=await page.locator('#appearance-creation').evaluate(node=>{
      const inputs=node.querySelectorAll('.dn-appearance-default-fields .settings-input-block');
      const last=inputs[inputs.length-1].getBoundingClientRect();
      const save=node.querySelector('.dn-appearance-save-row').getBoundingClientRect();
      return save.top-last.bottom;
    });
    expect(gap).toBeLessThanOrEqual(45);
    await page.goto('/tasks');
    const row=page.locator('.dn-task-list .dn-task-row').first();
    await expect(row).toBeVisible();
    const appearance=await row.evaluate(el=>({
      border:getComputedStyle(el).borderTopWidth,radius:getComputedStyle(el).borderTopLeftRadius,
      heading:parseFloat(getComputedStyle(el.querySelector('.dn-task-copy strong')).fontSize),
      detail:parseFloat(getComputedStyle(el.querySelector('.dn-task-row-details')).fontSize),
      right:el.getBoundingClientRect().right,
    }));
    expect(appearance.border).toBe('0px');
    expect(appearance.radius).toBe('0px');
    expect(appearance.heading).toBeGreaterThanOrEqual(15);
    expect(appearance.detail).toBeGreaterThanOrEqual(12);
    expect(appearance.right).toBeLessThanOrEqual(width+1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    expect(await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses','dn_guest_tasks']
      .map(key=>localStorage.getItem(key)))).toEqual(before);
    expect(errors).toEqual([]);
  });
}

for(const width of [320,390,430]){
  test(`Code Lists action by tap and sticky shortcuts at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:740});
    const errors=await seedGuest(page,{theme:'dark'});
    await page.goto('/settings/code-lists');
    const rail=page.getByRole('navigation',{name:'Code List sections'});
    await expect(rail.getByRole('link')).toHaveCount(6);
    const first=page.locator('#code-list-eventTypes .code-list-row').first();
    await expect(first.locator('.dn-code-list-row-more')).toHaveCount(0);
    await first.tap();
    await expect(page.getByRole('menu',{name:/Actions for/})).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('#code-list-reminderPresets').scrollIntoViewIfNeeded();
    const sticky=await rail.evaluate(el=>({position:getComputedStyle(el).position,
      visible:el.getBoundingClientRect().bottom>0}));
    expect(sticky.position).toBe('sticky');
    expect(sticky.visible).toBe(true);
    await rail.getByRole('link',{name:'Expense Categories'}).tap();
    await expect(page).toHaveURL(/#code-list-expenseCategories$/);
    expect(errors).toEqual([]);
  });
}
