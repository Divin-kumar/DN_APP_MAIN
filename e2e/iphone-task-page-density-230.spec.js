import { test, expect } from '@playwright/test';
import { seedGuest, swipe } from './fixtures.js';

// iPhone-size Chromium checks, not native iOS Safari or VoiceOver.
test.use({hasTouch:true,isMobile:true});
for(const [width,height,theme] of [[320,640,'dark'],[390,844,'light'],[430,932,'dark'],[844,390,'light']]){
  test(`Task page density, list row controls and scope ${width}x${height}`,async({page},testInfo)=>{
    await page.setViewportSize({width,height});
    const errors=await seedGuest(page,{theme});
    await page.goto('/tasks');
    const taskPage=page.locator('.dn-tasks-page');
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading',{name:'Tasks',exact:true})).toHaveCount(1);
    await expect(taskPage.getByText('Standalone and Moment-linked Tasks.')).toHaveCount(0);
    await expect(taskPage.locator('.dn-task-eyebrow')).toHaveCount(0);
    const metrics=taskPage.locator('.dn-task-metrics span');
    await expect(metrics).toHaveCount(3);
    const baseline=await page.evaluate(()=>['dn_guest_eventGroups','dn_guest_expenses','dn_guest_incomes'].map(key=>localStorage.getItem(key)));
    await page.getByRole('button',{name:'Open quick create menu'}).tap();
    await page.getByRole('button',{name:'Task',exact:true}).tap();
    const form=page.getByRole('dialog',{name:'New Task'});
    await form.getByLabel('Task title').fill('One tidy list row');
    await form.getByRole('button',{name:'Create Task'}).tap();
    // The new sheet closes with full-height Framer motion. A row can render
    // beneath its still-exiting transparent backdrop, which owns pointer events.
    // Ensure it is actually actionable before synthesizing a swipe.
    await expect(form).toHaveCount(0);
    await expect(page.locator('.dn-modal-backdrop')).toHaveCount(0);
    const row=taskPage.locator('.dn-task-list .dn-independent-task-row');
    await expect(row).toHaveCount(1);
    expect(await row.evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(width+1);
    await expect(row.locator('.dn-task-calendar')).toBeVisible();
    await expect(row.locator('.dn-task-done')).toHaveCount(0);
    const swipeRow=taskPage.locator('.dn-task-list .dn-independent-task-row').first();
    // Exercise real actions only after the just-created Task form exits.
    await swipe(page, swipeRow, { distance: 125 });
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


// CHG-511: long linked-Moment names are information, not 11px footnotes.
// Synthetic Guest records, small screens, and a no-mutation assertion.
for (const [width, height, theme] of [[320, 640, 'dark'], [390, 844, 'light'], [430, 932, 'dark']]) {
  test(`Task linked context and summary labels remain readable at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const errors = await seedGuest(page, { theme });
    await page.goto('/tasks');
    const task = { id:'linked-reading', title:'Review family travel documents before departure',
      momentId:'moment-one', activityId:'shared', dueDate:'2026-12-03',
      dueTime:'09:45', priority:'high', status:'in-progress' };
    await page.evaluate(row => localStorage.setItem('dn_guest_tasks', JSON.stringify([row])), task);
    await page.reload();
    const before = await page.evaluate(() => ['dn_guest_tasks','dn_guest_eventGroups']
      .map(key => localStorage.getItem(key)));
    const list = page.locator('.dn-tasks-page .dn-task-list');
    const row = list.locator('.dn-independent-task-row').filter({ hasText: task.title });
    await expect(row).toBeVisible();
    const context = row.locator('.dn-task-context');
    await expect(context).toContainText('Weekend in Ooty');
    expect(await context.evaluate(node => parseFloat(getComputedStyle(node).fontSize)))
      .toBeGreaterThanOrEqual(13);
    expect(await context.evaluate(node => parseFloat(getComputedStyle(node).lineHeight)))
      .toBeGreaterThanOrEqual(19);
    const metrics = page.locator('.dn-tasks-page .dn-task-metrics span');
    await expect(metrics).toHaveCount(3);
    for (const label of await metrics.all()) {
      expect(await label.evaluate(node => parseFloat(getComputedStyle(node).fontSize)))
        .toBeGreaterThanOrEqual(12);
    }
    await expect(row.locator('.dn-task-calendar')).toBeVisible();
    await expect(row.getByRole('img', { name:'High priority' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    expect(await page.evaluate(() => ['dn_guest_tasks','dn_guest_eventGroups']
      .map(key => localStorage.getItem(key)))).toEqual(before);
    expect(errors).toEqual([]);
  });
}
