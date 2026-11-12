import { test, expect } from '@playwright/test';
import { seedGuest } from './fixtures.js';

// Source + owner iPhone screenshot follow-up. Simulated touch Chromium only.
test.use({ hasTouch: true, isMobile: true });

for (const [width, height] of [[320,640],[390,844],[430,932],[844,390]]) {
  test(`Task Refine starts clean and shows all sorting options at ${width}x${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({width,height});
    const errors=await seedGuest(page);
    await page.goto('/tasks');
    await page.evaluate(() => {
      localStorage.setItem('dn_list_state_guest_tasks', JSON.stringify({
        search:'',status:'all',priority:'all',due:'all',field:'dueDate',direction:'asc',
        group:{id:'root',kind:'group',join:'AND',children:[
          {id:'old-blank',kind:'rule',field:'',operator:'contains',value:''},
          {id:'old-value',kind:'rule',field:'status',operator:'eq',value:''},
        ]},
      }));
    });
    await page.reload();
    const before=await page.evaluate(() => ({
      sort:localStorage.getItem('dn_list_state_guest_tasks'),
      records:localStorage.getItem('dn_guest_tasks'),
      moments:localStorage.getItem('dn_guest_eventGroups'),
    }));
    await page.getByRole('button',{name:'Refine'}).click();
    const sheet=page.getByRole('dialog',{name:'Refine Tasks'});
    await expect(sheet.locator('.dn-condition-rule')).toHaveCount(0);
    const sorts=sheet.getByRole('group',{name:'Sort Tasks'});
    await expect(sorts.getByRole('button')).toHaveCount(6);
    const positions=await sorts.evaluate(root=>{
      const box=root.getBoundingClientRect();
      return {overflow:root.scrollWidth-root.clientWidth,
        columns:getComputedStyle(root).gridTemplateColumns.split(' ').length,
        links:[...root.querySelectorAll('button')].map(node=>({
          left:node.getBoundingClientRect().left,
          right:node.getBoundingClientRect().right,
          height:node.getBoundingClientRect().height,
        })),left:box.left,right:box.right};
    });
    expect(positions.columns).toBe(width <= 760 || height <= 500 ? 2 : 3);
    expect(positions.overflow).toBeLessThanOrEqual(1);
    for(const p of positions.links){
      expect(p.left).toBeGreaterThanOrEqual(positions.left-1);
      expect(p.right).toBeLessThanOrEqual(positions.right+1);
      expect(p.height).toBeGreaterThanOrEqual(43.9);
    }
    await testInfo.attach(`task-refine-${width}`,{
      body:await page.screenshot({animations:'disabled'}),contentType:'image/png',
    });
    await sorts.getByRole('button',{name:'Sort by Title'}).tap();
    await sheet.getByRole('button',{name:'Cancel'}).tap();
    expect(await page.evaluate(()=>localStorage.getItem('dn_list_state_guest_tasks'))).toBe(before.sort);
    await page.getByRole('button',{name:'Refine'}).tap();
    const reopened=page.getByRole('dialog',{name:'Refine Tasks'});
    await reopened.getByRole('button',{name:'Add filter'}).tap();
    await reopened.getByRole('combobox',{name:'Filter by'}).click();
    await page.getByRole('option',{name:'Status',exact:true}).click();
    await reopened.getByRole('combobox',{name:'Value for Status'}).click();
    await page.getByRole('option',{name:'Completed',exact:true}).click();
    await reopened.getByRole('group',{name:'Sort Tasks'}).getByRole('button',{name:'Sort by Title'}).tap();
    await reopened.getByRole('button',{name:'Show results'}).tap();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dn_list_state_guest_tasks')));
    expect(saved.group.children).toHaveLength(1);
    expect(saved.group.children[0]).toMatchObject({field:'status',operator:'eq',value:'completed'});
    expect(saved.field).toBe('title');
    expect(await page.evaluate(()=>localStorage.getItem('dn_guest_tasks'))).toBe(before.records);
    expect(await page.evaluate(()=>localStorage.getItem('dn_guest_eventGroups'))).toBe(before.moments);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    expect(errors).toEqual([]);
  });
}

test('Task Refine preserves meaningful saved filters while hiding inactive placeholders',async({page})=>{
  const errors=await seedGuest(page);
  await page.goto('/tasks');
  await page.evaluate(()=>{
    localStorage.setItem('dn_list_state_guest_tasks',JSON.stringify({
      search:'',status:'all',priority:'all',due:'all',field:'dueDate',direction:'asc',
      group:{id:'root',kind:'group',join:'AND',children:[
        {id:'status',kind:'rule',field:'status',operator:'eq',value:'completed'},
        {id:'blank',kind:'rule',field:'',operator:'contains',value:''},
      ]},
    }));
  });
  await page.reload();
  await page.getByRole('button',{name:'Refine'}).click();
  const sheet=page.getByRole('dialog',{name:'Refine Tasks'});
  await expect(sheet.locator('.dn-condition-rule')).toHaveCount(1);
  await expect(sheet.getByRole('status')).toContainText('0 matching Tasks');
  await sheet.getByRole('button',{name:'Cancel'}).click();
  expect(errors).toEqual([]);
});
