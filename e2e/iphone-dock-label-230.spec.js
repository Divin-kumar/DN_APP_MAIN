import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';
for (const width of [320,390,430,480]) for (const theme of ['light','dark']) {
  test(`Finance command destination is readable and navigates ${width} ${theme}`,async({page})=>{
    await page.setViewportSize({width,height:844});
    const errors=await seedGuest(page,{theme});
    await page.goto('/dashboard');
    await page.getByRole('button',{name:'Open quick create menu'}).click();
    const finance=page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Finance',exact:true});
    await expect(finance).toHaveAttribute('href','/financials/transactions');
    const box=await finance.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
    await finance.click();
    await expect(page).toHaveURL(/\/financials\/transactions$/);
    await expect(page.locator('.dn-command-controls').getByRole('searchbox',{name:'Search transactions'})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    expect(errors).toEqual([]);
  });
}
