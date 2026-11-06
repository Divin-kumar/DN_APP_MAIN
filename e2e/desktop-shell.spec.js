import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

for (const [width,height] of [[320,844],[390,844],[430,932],[932,430],[1024,430]]) {
  test(`desktop polish leaves mobile pixels unchanged ${width}x${height}`, async ({page}) => {
    await page.setViewportSize({width,height});
    await seedGuest(page,{theme:'dark'});
    await page.goto('/events');
    await expect(page.getByRole('button', {name:'Open Weekend in Ooty — family plans and memories',exact:true})).toBeVisible();
    await expect(page.locator('.dn-header')).toBeVisible();
    await expect(page.locator('.dn-desktop-navigation-options')).toBeHidden();
    await page.evaluate(() => document.fonts.ready);
    const before = await page.screenshot({animations:'disabled'});
    await page.evaluate(() => {
      const sheet = [...document.styleSheets].find(s => s.ownerNode?.getAttribute('data-vite-dev-id')?.endsWith('/DesktopShell.css'));
      if (!sheet) throw new Error('Desktop stylesheet missing');
      sheet.disabled = true;
    });
    // Hide only the new desktop destinations; all pre-existing DOM/CSS is the baseline.
    await page.addStyleTag({content:'.dn-desktop-navigation-options { display:none!important; }'});
    const after = await page.screenshot({animations:'disabled'});
    expect(before.equals(after)).toBe(true);
  });
}
for (const width of [1024,1280,1440]) {
  test(`desktop direct destinations and larger create control ${width}`,async ({page})=>{
    await page.setViewportSize({width,height:800});
    await seedGuest(page,{theme:'light'});
    await page.goto('/tasks');
    const side=page.locator('.dn-sidebar');
    await expect(side.locator('a')).toHaveText(['Home','Moments','Activities','Tasks','Transactions','Insights','Profile','Settings']);
    for(const label of ['Profile','Transactions','Insights','Settings']) await expect(side.getByRole('link',{name:label,exact:true})).toBeVisible();
    await expect(side.getByRole('button',{name:'Logout',exact:true})).toBeVisible();
    await expect(page.locator('.profile-trigger')).toBeHidden();
    await expect(page.locator('.dn-quick-create-trigger')).toHaveCSS('width','56px');
    const controls=await page.locator('.header-user-controls').boundingBox();
    const sidebar=await side.boundingBox();
    const header=await page.locator('.dn-header').boundingBox();
    const content=await page.locator('.dn-content').boundingBox();
    expect(header.x).toBe(sidebar.x);
    expect(header.width).toBe(sidebar.width);
    expect(content.y).toBeLessThan(header.y+header.height);
    expect(controls.x).toBeGreaterThanOrEqual(sidebar.x);
    expect(controls.x+controls.width).toBeLessThanOrEqual(sidebar.x+sidebar.width);
    await side.getByRole('link',{name:'Transactions',exact:true}).click();
    await expect(page).toHaveURL(/financials\/transactions/);
    await page.locator('.dn-quick-create-trigger').click();
    await expect(page.locator('.dn-quick-create-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.dn-quick-create-menu')).toBeHidden();
  });
}
