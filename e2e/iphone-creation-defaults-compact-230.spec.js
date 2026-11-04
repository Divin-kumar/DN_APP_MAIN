import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Synthetic coarse-pointer Chromium; iOS Safari and VoiceOver still need owner acceptance.
test.use({hasTouch:true,isMobile:true});
for(const [width,height,theme] of [[320,640,'dark'],[390,844,'light'],[430,932,'dark'],[844,390,'light']]){
  test(`Creation Defaults stay compact, readable and safe at ${width}x${height}`,async({page},testInfo)=>{
    await page.setViewportSize({width,height});
    const errors=await seedGuest(page,{theme});
    await page.goto('/settings/appearance');
    const before=await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses','dn_guest_tasks'].map(x=>localStorage.getItem(x)));
    const region=page.locator('#appearance-creation');
    const fields=region.locator('.dn-appearance-default-fields .settings-input-block');
    await expect(fields).toHaveCount(4);
    const geometry=await fields.evaluateAll(nodes=>nodes.map(n=>{
      const r=n.getBoundingClientRect(),button=n.querySelector('.dropdown-trigger');
      return {top:r.top,left:r.left,right:r.right,width:r.width,height:r.height,
        tap:button?.getBoundingClientRect().height||0,
        label:n.querySelector(':scope > span')?.textContent||''};
    }));
    expect(geometry.every(x=>x.right<=width+1&&x.left>=-1&&x.tap>=44)).toBe(true);
    if(width>=400&&width<=580){
      expect(Math.abs(geometry[1].top-geometry[2].top)).toBeLessThan(2);
      expect(geometry[0].width).toBeGreaterThan(geometry[1].width*1.8);
      expect(geometry[3].width).toBeGreaterThan(geometry[2].width*1.8);
    }else if(width<=390){
      expect(geometry[0].width).toBeGreaterThan(geometry[1].width-2);
      expect(geometry[2].top).toBeGreaterThan(geometry[1].top+10);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    await testInfo.attach(`appearance-defaults-${width}-${theme}`,{
      body:await page.screenshot({animations:'disabled'}),contentType:'image/png',
    });
    await page.getByRole('combobox',{name:'Default Moment type'}).tap();
    await page.getByRole('option',{name:'Birthday',exact:true}).tap();
    await page.getByRole('button',{name:'Save defaults'}).tap();
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('dn_preferences')).defaultEventType)).toBe('Birthday');
    await page.reload();
    await expect(page.getByRole('combobox',{name:'Default Moment type'})).toContainText('Birthday');
    expect(await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses','dn_guest_tasks'].map(x=>localStorage.getItem(x)))).toEqual(before);
    expect(errors).toEqual([]);
  });
}
