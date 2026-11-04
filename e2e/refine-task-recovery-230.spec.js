import {test,expect} from '@playwright/test';
import {seedGuest} from './fixtures.js';
for(const width of [320,430]){
 test(`Every phone sort is visible in two columns ${width}`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900}); await seedGuest(page);
  for(const route of ['/events','/activities','/financials/transactions','/tasks']){
   await page.goto(route);
   await page.getByRole('button',{name:route==='/tasks'?'Refine':/Filters and sort/,exact:route==='/tasks'}).click();
   const group=page.locator('.dn-refine-sort-chips');
   expect(await group.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(2);
   expect(await group.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
   for(const b of await group.getByRole('button').all()){
    await b.click();
    const bounds=await b.boundingBox(),icon=await b.locator('svg').boundingBox();
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    expect(icon.x+icon.width).toBeLessThanOrEqual(bounds.x+bounds.width);
   }
   await testInfo.attach(`sort-${width}-${route.replaceAll('/','_')}`,{body:await page.screenshot(),contentType:'image/png'});
  }
 });
}
test('Task status failure stays visible and can be retried without data loss',async({page})=>{
 await seedGuest(page);await page.goto('/tasks?create=1');
 await page.getByLabel('Task title').fill('Retry safely');
 await page.getByRole('button',{name:'Create Task'}).click();
 const baseline=await page.evaluate(()=>localStorage.getItem('dn_guest_tasks'));
 const id=JSON.parse(baseline)[0].id;await page.goto(`/tasks?task=${id}`);
 // A deep link highlights the ordinary Task row; actions open only on tap.
 const row=page.locator('.dn-independent-task-row.is-dashboard-selected');
 await expect(row).toContainText('Retry safely');
 await expect(page.getByRole('dialog',{name:'Task actions'})).toHaveCount(0);
 await page.evaluate(async()=>{
  const store=(await import('/src/store/useTaskStore.js')).default;
  window.__savedTaskStatus=store.getState().setTaskStatus;
  store.setState({setTaskStatus:()=>{throw new Error('Storage unavailable. Try again.');}});
 });
 await row.click();
 await page.getByRole('menuitem',{name:'Done',exact:true}).click();
 await expect(page.locator('.dn-task-feedback[role="alert"]')).toHaveText('Storage unavailable. Try again.');
 await expect(page.getByRole('menu')).toHaveCount(0);
 expect(await page.evaluate(()=>localStorage.getItem('dn_guest_tasks'))).toBe(baseline);
 await page.evaluate(async()=>{
  const store=(await import('/src/store/useTaskStore.js')).default;
  store.setState({setTaskStatus:window.__savedTaskStatus});
 });
 await row.click();
 await page.getByRole('menuitem',{name:'Done',exact:true}).click();
 await expect(page.locator('.dn-task-feedback[role="alert"]')).toHaveCount(0);
 await expect(row.getByRole('img',{name:'Completed',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dn_guest_tasks'))[0].status)).toBe('completed');
});
