import { test, expect } from '@playwright/test';
import { calendarDate, seedGuest } from './fixtures.js';

const tasks = [
  { id:'focused-task',title:'Review travel documents',notes:'Keep originals',status:'in-progress',
    priority:'high',momentId:'moment-one',activityId:'',dueDate:calendarDate(2),dueTime:'09:15',
    createdAt:'2026-10-25T08:00:00Z' },
  { id:'late-task',title:'Book return tickets',notes:'',status:'in-progress',
    priority:'medium',momentId:'',activityId:'',dueDate:calendarDate(-2),dueTime:'' },
  { id:'done-task',title:'Archive old pictures',notes:'Family',status:'completed',
    priority:'low',momentId:'',activityId:'',dueDate:'',dueTime:'' },
];
async function seedTasks(page,theme){
  const errors=await seedGuest(page,{theme});
  await page.goto('/tasks');
  await page.evaluate((entries)=>localStorage.setItem('dn_guest_tasks',JSON.stringify(entries)),tasks);
  await page.reload();
  await expect(page.locator('.dn-independent-task-row')).toHaveCount(3);
  return errors;
}
async function selectOption(page,name,value){
  await page.getByRole('combobox',{name,exact:true}).last().click();
  const search=page.locator('.dropdown-menu-portal input[type="search"]');
  if(await search.count()) await search.fill(value);
  await page.getByRole('option',{name:value,exact:true}).click();
}

for(const [width,theme] of [[320,'dark'],[390,'light'],[1280,'dark']]){
  test('Task Refine shares editable chips and preserves draft/cancel at '+width+'px '+theme,async ({page},testInfo)=>{
    await page.setViewportSize({width,height:width<700?790:900});
    const errors=await seedTasks(page,theme);
    const before=await page.evaluate(()=>localStorage.getItem('dn_guest_tasks'));
    await page.getByRole('button',{name:'Refine',exact:true}).click();
    const sheet=page.getByRole('dialog',{name:'Refine Tasks'});
    await expect(sheet.getByRole('group',{name:'Sort Tasks'}).getByRole('button')).toHaveCount(6);
    await expect(sheet.getByText('Group by')).toHaveCount(0);
    await expect(sheet.locator('.dn-condition-rule')).toHaveCount(0);
    await sheet.getByRole('button',{name:'Add filter',exact:true}).click();
    await selectOption(page,'Filter by','Status');
    await selectOption(page,'Value for Status','Completed');
    const fieldBounds=await sheet.locator('.dn-condition-rule').first()
      .getByRole('combobox',{name:'Filter by',exact:true}).boundingBox();
    expect(fieldBounds).not.toBeNull();
    expect(fieldBounds.width).toBeGreaterThan(width===320?150:50);
    await expect(sheet.locator('.dn-condition-rule').first()
      .getByRole('combobox',{name:'Filter by',exact:true})).toContainText('Status');
    await expect(sheet.getByRole('status')).toContainText('1 matching Tasks');
    await expect(page.locator('.dn-independent-task-row')).toHaveCount(3);
    const selected=sheet.getByRole('group',{name:'Sort Tasks'}).getByRole('button',{name:/Sort by Priority/});
    await selected.click();
    const looks=await sheet.evaluate((el)=>{
      const sort=el.querySelector('.dn-refine-sort-chips > button');
      const rule=el.querySelector('.dn-condition-rule');
      const a=getComputedStyle(sort), b=getComputedStyle(rule);
      return {sortBorder:a.borderTopWidth,sortRadius:a.borderTopLeftRadius,
        ruleBorder:b.borderTopWidth,ruleRadius:b.borderTopLeftRadius};
    });
    expect(looks.sortBorder).toBe('0px');
    expect(looks.ruleBorder).toBe('0px');
    await testInfo.attach('TaskRefine-'+width+'-'+theme,{body:await page.screenshot(),contentType:'image/png'});
    await sheet.getByRole('button',{name:'Cancel',exact:true}).click();
    await expect(page.locator('.dn-independent-task-row')).toHaveCount(3);
    await page.getByRole('button',{name:'Refine',exact:true}).click();
    await sheet.getByRole('button',{name:'Add filter',exact:true}).click();
    await selectOption(page,'Filter by','Due timing');
    await selectOption(page,'Value for Due timing','Overdue');
    await expect(sheet.getByRole('status')).toContainText('1 matching Tasks');
    await sheet.getByRole('button',{name:'Show results'}).click();
    await expect(page.locator('.dn-independent-task-row')).toHaveCount(1);
    await expect(page.getByText('Book return tickets',{exact:true})).toBeVisible();
    await expect(page.locator('.dn-task-metrics strong')).toHaveText(['1','1','0']);
    const chips=page.getByRole('region',{name:'Active filters'});
    await expect(chips).toBeVisible();
    await expect(chips.getByRole('button',{name:/Remove filter/})).toHaveCount(1);
    await chips.getByRole('button',{name:/Remove filter/}).click();
    await expect(page.locator('.dn-independent-task-row')).toHaveCount(3);
    expect(await page.evaluate(()=>localStorage.getItem('dn_guest_tasks'))).toBe(before);
    const geometry=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:document.documentElement.clientWidth}));
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.width+1);
    expect(errors).toEqual([]);
  });
  test('Dashboard Task rows navigate without mutating Task or Moment records at '+width+'px '+theme,async({page},testInfo)=>{
    await page.setViewportSize({width,height:width<700?790:900});
    const errors=await seedTasks(page,theme);
    const original=await page.evaluate(()=>localStorage.getItem('dn_guest_eventGroups'));
    await page.goto('/dashboard');
    const rows=page.locator('.dn-dashboard-tasks .dn-dashboard-task-row');
    await expect(rows).toHaveCount(2);
    await expect(page.locator('.dn-dashboard-tasks .dn-dashboard-task-check')).toHaveCount(0);
    await expect(page.locator('.dn-dashboard-tasks .dn-dashboard-task-date')).toHaveCount(2);
    await expect(rows.first()).toContainText(/days? (away|overdue)|Due today/);
    await expect(rows.first().locator('[data-priority]')).toHaveCount(0);
    const originalTasks=await page.evaluate(()=>localStorage.getItem('dn_guest_tasks'));
    await testInfo.attach('DashboardTasks-'+width+'-'+theme,{body:await page.screenshot(),contentType:'image/png'});
    await page.getByRole('link',{name:'Open Task Review travel documents'}).click();
    await expect(page.getByRole('dialog',{name:'Task actions'})).toBeVisible();
    await page.getByRole('dialog',{name:'Task actions'}).getByRole('button',{name:'Edit',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Edit Task'}).getByLabel('Task title')).toHaveValue('Review travel documents');
    await page.getByRole('dialog',{name:'Edit Task'}).getByRole('button',{name:'Cancel',exact:true}).click();
    await page.goto('/dashboard');
    await expect(page.locator('.dn-dashboard-tasks .dn-dashboard-task-row')).toHaveCount(2);
    expect(await page.evaluate(()=>localStorage.getItem('dn_guest_tasks'))).toBe(originalTasks);
    expect(await page.evaluate(()=>localStorage.getItem('dn_guest_eventGroups'))).toBe(original);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    expect(errors).toEqual([]);
  });
}

test('old Task filters become visible chips and are removable without modifying Task records',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const errors=await seedTasks(page,'dark');
  const records=await page.evaluate(()=>localStorage.getItem('dn_guest_tasks'));
  await page.evaluate(()=>localStorage.setItem('dn_list_state_guest_tasks',JSON.stringify({
    search:'',status:'in-progress',priority:'high',due:'all',field:'dueDate',direction:'asc',
  })));
  await page.reload();
  await expect(page.locator('.dn-independent-task-row')).toHaveCount(1);
  await expect(page.getByRole('region',{name:'Active filters'})).toBeVisible();
  await page.getByRole('button',{name:'Refine',exact:true}).click();
  const sheet=page.getByRole('dialog',{name:'Refine Tasks'});
  await expect(sheet.locator('.dn-condition-rule')).toHaveCount(2);
  await sheet.getByRole('button',{name:'Reset',exact:true}).click();
  await expect(sheet.getByRole('status')).toContainText('3 matching Tasks');
  await sheet.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.locator('.dn-independent-task-row')).toHaveCount(1);
  expect(await page.evaluate(()=>localStorage.getItem('dn_guest_tasks'))).toBe(records);
  expect(errors).toEqual([]);
});

for(const route of ['/events','/activities','/financials/transactions','/settings/list-defaults']){
  test('all sort/filter configurations stay lightweight at '+route,async({page})=>{
    const errors=await seedGuest(page);
    await page.setViewportSize({width:390,height:844});
    await page.goto(route);
    if(route.includes('list-defaults')){
      const cards=page.locator('.dn-defaults-sort-card');
      await expect(cards).toHaveCount(3);
      const styles=await cards.first().evaluate(node=>({background:getComputedStyle(node).backgroundColor,
        border:getComputedStyle(node).borderTopWidth}));
      expect(styles.border).toBe('0px');
    }else{
      await page.getByRole('button',{name:/^Filters and sort/}).first().click();
      const dialog=page.getByRole('dialog');
      const styles=await dialog.locator('.dn-refine-sort-chips > button').first().evaluate(node=>({
        border:getComputedStyle(node).borderTopWidth,radius:getComputedStyle(node).borderTopLeftRadius,
      }));
      expect(styles.border).toBe('0px');
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
    expect(errors).toEqual([]);
  });
}
