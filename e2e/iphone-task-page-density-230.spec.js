import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// iPhone-size Chromium checks, not native iOS Safari or VoiceOver.
test.use({hasTouch:true,isMobile:true});
for(const [width,height,theme] of [[320,640,'dark'],[390,844,'light'],[430,932,'dark'],[844,390,'light']]){
  test(`Task page density, list row controls and scope ${width}x${height}`,async({page},testInfo)=>{
    await page.setViewportSize({width,height});
    const errors=await seedGuest(page,{theme});
    await page.goto('/tasks');
    const taskPage=page.locator('.dn-tasks-page');
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(taskPage.getByRole('heading',{name:'Tasks',exact:true})).toBeVisible();
    await expect(taskPage.getByText('Standalone and Moment-linked Tasks.')).toBeVisible();
    await expect(taskPage.locator('.dn-task-eyebrow')).toHaveCount(0);
    const metrics=taskPage.locator('.dn-task-metrics span');
    await expect(metrics).toHaveCount(3);
    const baseline=await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_expenses','dn_guest_incomes'].map(key=>localStorage.getItem(key)));
    await page.getByRole('button',{name:'Open quick create menu'}).tap();
    await page.getByRole('button',{name:'Task',exact:true}).tap();
    const form=page.getByRole('dialog',{name:'New Task'});
    await form.getByLabel('Task title').fill('One tidy list row');
    await form.getByRole('button',{name:'Create Task'}).tap();
    const row=taskPage.locator('.dn-task-list .dn-task-row');
    await expect(row).toHaveCount(1);
    expect(await row.evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(width+1);
    await expect(row.locator('.dn-task-calendar')).toBeVisible();
    await expect(row.locator('.dn-task-done')).toHaveCount(0);
    const swipeRow=taskPage.locator('.dn-task-list .dn-task-row').first();
    const swipeTarget=await swipeRow.locator('.dn-task-copy').boundingBox();
    const startX=swipeTarget.x+Math.min(30,swipeTarget.width/4);
    const startY=swipeTarget.y+swipeTarget.height/2;
    await page.mouse.move(startX,startY);
    await page.mouse.down();
    await page.mouse.move(startX+52,startY,{steps:4});
    await page.mouse.up();
    const actionMenu=page.getByRole('menu').filter({hasText:'Edit'});
    await expect(actionMenu).toBeVisible();
    await expect(actionMenu.getByRole('menuitem',{name:'Cancel'})).toBeVisible();
    await expect(actionMenu.getByRole('menuitem',{name:'Delete'})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(actionMenu).toBeHidden();
    await swipeRow.focus();
    await page.keyboard.press('ArrowRight');
    await expect(actionMenu).toBeVisible();
    await expect(actionMenu.getByRole('menuitem',{name:'Edit'})).toBeVisible();
    await expect(actionMenu.getByRole('menuitem',{name:'Cancel'})).toBeVisible();
    await expect(actionMenu.getByRole('menuitem',{name:'Delete'})).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(actionMenu).toBeHidden();
    await expect(swipeRow).toBeFocused();
    await testInfo.attach(`tasks-${width}-${theme}`,{
      body:await page.screenshot({animations:'disabled'}),contentType:'image/png'
    });
    await swipeRow.tap();
    await page.getByRole('menuitem',{name:'Done',exact:true}).tap();
    await expect(row.getByRole('img',{name:'Completed',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_expenses','dn_guest_incomes'].map(key=>localStorage.getItem(key)))).toEqual(baseline);
    expect(errors).toEqual([]);
  });
}
