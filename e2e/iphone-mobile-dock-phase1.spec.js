import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';
for(const [width,height,theme] of [[320,640,'dark'],[390,844,'dark'],[430,932,'light']]) {
  test(`mobile command navigation and creation preserve records ${width}`,async({page})=>{
    await page.setViewportSize({width,height});const errors=await seedGuest(page,{theme});
    await page.goto('/dashboard');
    const before=await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses'].map(k=>localStorage.getItem(k)));
    for(const [name,path] of [['Moments','/events'],['Activities','/activities'],['Tasks','/tasks'],['Finance','/financials/transactions'],['Home','/dashboard']]) {
      await page.getByRole('button',{name:'Open quick create menu'}).click();
      const nav=page.getByRole('navigation',{name:'Main navigation'});
      await expect(nav.getByRole('link')).toHaveCount(5);
      await nav.getByRole('link',{name,exact:true}).click();
      await expect(page).toHaveURL(new RegExp(path+'$'));
    }
    await page.getByRole('button',{name:'Open quick create menu'}).click();
    const menu=page.getByRole('group',{name:'Quick create actions'});
    for(const name of ['Life moment','Activity','Task','Transaction'])await expect(menu.getByRole('button',{name,exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button',{name:'Open quick create menu'})).toBeFocused();
    const geometry=await page.evaluate(()=>{const d=document.querySelector('.dn-command-bar'),c=document.querySelector('.dn-content');return {bottom:parseFloat(getComputedStyle(d).bottom),height:d.getBoundingClientRect().height,padding:parseFloat(getComputedStyle(c).paddingBottom),width:document.documentElement.scrollWidth};});
    expect(geometry.padding).toBeGreaterThanOrEqual(geometry.bottom+geometry.height-7);
    expect(geometry.width).toBeLessThanOrEqual(width+1);
    expect(await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses'].map(k=>localStorage.getItem(k)))).toEqual(before);
    expect(errors).toEqual([]);
  });
}
