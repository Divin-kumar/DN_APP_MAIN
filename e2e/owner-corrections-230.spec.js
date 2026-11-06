import {test,expect} from '@playwright/test';
import {seedGuest,calendarDate} from './fixtures.js';
for(const [width,theme] of [[320,'dark'],[430,'dark'],[390,'light']]){
 test(`Owner corrections survive Story navigation ${width} ${theme}`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900});
  const errors=await seedGuest(page,{theme});
  await page.goto('/events/moment-one/overview');
  await expect(page.locator('.dn-v2-story')).toBeVisible();
  await page.evaluate(async({past,future})=>{
   const store=(await import('/src/store/useTaskStore.js')).default;
   store.getState().loadTasks();
   for(const item of [
    {title:'Return the library book',dueDate:past,dueTime:'16:00',priority:'low'},
    {title:'Confirm electrician visit',dueDate:future,dueTime:'09:30',priority:'high'},
    {title:'Choose a new bookshelf',priority:'medium'},
    {title:'Measure the window',priority:'low',status:'completed'},
   ])store.getState().saveTask(item);
  },{past:calendarDate(-2),future:calendarDate(2)});
  // Client-side navigation retains the lazily loaded Story stylesheet.
  await page.getByRole('button',{name:'Open quick create menu'}).click();
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Home',exact:true}).click();
  await page.locator('.dn-dashboard-tasks').getByRole('link',{name:'View all'}).click();
  const rows=page.locator('.dn-independent-task-row');
  await expect(rows).toHaveCount(4);
  for(const row of await rows.all()){
   expect(await row.locator('.dn-task-copy').evaluate(el=>el.getBoundingClientRect().width)).toBeGreaterThan(100);
   const square=await row.locator('.dn-task-calendar').boundingBox();
   expect(Math.abs(square.width-square.height)).toBeLessThan(1);
   await expect(row.locator('.dn-task-calendar svg')).toHaveCount(0);
  }
  const late=rows.filter({hasText:'Return the library book'});
  await expect(late.locator('.dn-task-calendar')).toContainText('16:00');
  await expect(late.getByRole('img',{name:'Overdue',exact:true})).toBeVisible();
  await expect(rows.filter({hasText:'Confirm electrician visit'}).getByRole('img',{name:'High priority',exact:true})).toBeVisible();
  await expect(rows.filter({hasText:'Choose a new bookshelf'}).locator('.dn-task-flag')).toHaveCount(0);
  await testInfo.attach('tasks-square-'+width,{body:await page.screenshot(),contentType:'image/png'});
  const metrics=page.locator('.dn-task-metrics strong');
  await expect(metrics).toHaveText(['4','3','1']);
  await page.getByRole('searchbox',{name:'Search Tasks'}).fill('Measure');
  await expect(metrics).toHaveText(['1','0','1']);
  await page.getByRole('searchbox',{name:'Search Tasks'}).fill('no matches');
  await expect(metrics).toHaveText(['0','0','0']);
  await page.goto('/settings/code-lists');
  await expect(page.locator('.dn-code-list-nav-arrow')).toHaveCount(0);
  const rail=page.locator('.dn-code-list-index-scroll');
  await rail.evaluate(el=>{el.scrollLeft=el.scrollWidth;});
  await expect(rail.getByRole('link',{name:'Reminder Presets'})).toBeInViewport();
  await page.goto('/activities');
  await page.getByRole('button',{name:/Filters and sort/}).click();
  const sort=page.locator('.dn-refine-sort-chips');
  await sort.getByRole('button',{name:'Sort by Status',exact:true}).click();
  const selected=sort.locator('button[aria-pressed="true"]');
  const label=await selected.locator('.dn-sort-choice-content > span').boundingBox();
  const arrow=await selected.locator('svg').boundingBox();
  expect(arrow.x).toBeGreaterThanOrEqual(label.x+label.width);
  await expect(selected.locator('svg')).toBeVisible();
  await selected.click();
  await expect(selected).toHaveAccessibleName(/descending/);
  await testInfo.attach('sort-direction-'+width,{body:await page.screenshot(),contentType:'image/png'});
  expect(errors).toEqual([]);
 });
}
