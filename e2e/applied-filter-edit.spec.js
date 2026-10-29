import { test, expect } from '@playwright/test';
import { accountScope, fixtureMoments, seedGuest } from './fixtures.js';

const consumers = [
  {route:'/events',key:'moments',field:'Moment type',from:'Vacation',to:'Personal'},
  {route:'/activities',key:'activities',field:'Status',from:'Completed',to:'In progress'},
  {route:'/events/moment-one/activities',key:'moment-activities:moment-one',field:'Status',from:'Completed',to:'In progress'},
  {route:'/financials',key:'transactions',field:'Type',from:'Income',to:'Expense'},
  {route:'/events/moment-one/transactions',key:'moment-transactions:moment-one:all',field:'Type',from:'Income',to:'Expense'},
];
const rules = node => node.kind === 'group' ? node.children.flatMap(rules) : [node];
const saved = (page,key) => page.evaluate(key=>JSON.parse(localStorage.getItem(`dn_list_state_guest_${encodeURIComponent(`conditions:${key}`)}`)).group,key);
const records = page => page.evaluate(()=>['dn_guest_eventGroups','dn_guest_incomes','dn_guest_expenses'].map(key=>localStorage.getItem(key)));
async function choice(page,name,value) {
  await page.getByRole('combobox',{name,exact:true}).last().click();
  await page.getByRole('option',{name:value,exact:true}).click();
}
async function add(page,field,value) {
  await page.getByRole('button',{name:/^Filters(?: and sort)?(?:,|$)/}).click();
  const clear=page.getByRole('button',{name:'Clear all',exact:true});if(await clear.count())await clear.click();
  await page.getByRole('button',{name:'Add filter',exact:true}).click();
  await choice(page,'Filter by',field);
  if(value)await choice(page,`Value for ${field}`,value);
}
for(const width of [320,390,1280]) {
  test(`lightweight applied filter options edit the same rule in all five lists at ${width}px`,async({page})=>{
    test.setTimeout(90000);await page.setViewportSize({width,height:844});
    const errors=await seedGuest(page,{theme:width===390?'light':'dark'});await page.goto('/events');const original=await records(page);
    for(const consumer of consumers) {
      await page.goto(consumer.route);await add(page,consumer.field,consumer.from);
      await page.getByRole('button',{name:/^Filters(?: and sort)?(?:,|$)/}).click();
      const before=await saved(page,consumer.key);expect(rules(before)).toHaveLength(1);
      const chip=page.locator('.dn-condition-chip');
      const style=await chip.evaluate(e=>({border:getComputedStyle(e).borderWidth,background:getComputedStyle(e).backgroundColor}));
      expect(style).toEqual({border:'0px',background:'rgba(0, 0, 0, 0)'});
      await choice(page,`Change ${consumer.field} filter`,consumer.to);
      await expect(chip).toContainText(consumer.to);await expect(chip).toHaveCount(1);
      const after=await saved(page,consumer.key);expect(after.id).toBe(before.id);expect(after.join).toBe(before.join);
      const [oldRule]=rules(before),[newRule]=rules(after);
      expect({...newRule,value:oldRule.value}).toEqual(oldRule);expect(newRule.value).not.toBe(oldRule.value);
      expect(await page.locator('.dn-list-controls-panel').count()).toBe(0);
      await page.screenshot({path:`.verification/applied-edit-${width}-${consumer.key.replaceAll(':','-')}.png`});
      await page.reload();await expect(page.locator('.dn-condition-chip')).toContainText(consumer.to);
      await page.locator('.dn-condition-chip').getByRole('button',{name:/^Remove filter /}).click();
      await expect(page.locator('.dn-condition-chip')).toHaveCount(0);expect(rules(await saved(page,consumer.key))).toHaveLength(0);
    }
    expect(await records(page)).toEqual(original);expect(errors).toEqual([]);
  });
}
test('applied text, date and range edits keep their identity and Cancel discards a draft',async({page})=>{
  const errors=await seedGuest(page);await page.goto('/financials');const original=await records(page);
  await add(page,'Title');await page.getByRole('textbox',{name:'Value for Title',exact:true}).fill('Room');
  await page.getByRole('textbox',{name:'Value for Title',exact:true}).blur();
  await expect(page.locator('.dn-condition-chip')).toContainText('Room');
  await page.getByRole('button',{name:/^Filters/}).click();
  let before=rules(await saved(page,'transactions'))[0];
  await page.getByRole('button',{name:'Change Title filter',exact:true}).click();
  let dialog=page.getByRole('dialog',{name:'Change Title filter',exact:true});
  await dialog.getByRole('textbox',{name:'Value for Title',exact:true}).fill('Discard me');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(rules(await saved(page,'transactions'))[0]).toEqual(before);
  await page.getByRole('button',{name:'Change Title filter',exact:true}).click();
  await page.getByRole('dialog').getByRole('textbox',{name:'Value for Title',exact:true}).fill('Trip');
  await page.getByRole('dialog').getByRole('textbox',{name:'Value for Title',exact:true}).press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(rules(await saved(page,'transactions'))[0]).toEqual({...before,value:'Trip'});
  await page.locator('.dn-condition-chip-remove').click();
  await add(page,'Amount');await choice(page,'Comparison','Equals');
  await page.getByRole('spinbutton',{name:'Value for Amount',exact:true}).fill('100');await page.getByRole('spinbutton',{name:'Value for Amount',exact:true}).blur();
  await expect(page.locator('.dn-condition-chip')).toHaveCount(1);await page.getByRole('button',{name:/^Filters/}).click();before=rules(await saved(page,'transactions'))[0];
  await page.getByRole('button',{name:'Change Amount filter',exact:true}).click();
  await choice(page,'Comparison for Amount','Between');dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('button',{name:'Apply filter',exact:true})).toBeDisabled();
  await dialog.getByRole('spinbutton',{name:'From Amount',exact:true}).fill('20');await dialog.getByRole('spinbutton',{name:'To Amount',exact:true}).fill('200');
  await dialog.getByRole('button',{name:'Apply filter',exact:true}).click();
  expect(rules(await saved(page,'transactions'))[0]).toEqual({...before,operator:'between',value:['20','200']});
  await page.locator('.dn-condition-chip-remove').click();
  await add(page,'Date');await choice(page,'Comparison','This month');await page.getByRole('button',{name:/^Filters/}).click();before=rules(await saved(page,'transactions'))[0];
  await page.getByRole('button',{name:'Change Date filter',exact:true}).click();await choice(page,'Comparison for Date','Today');
  await page.getByRole('dialog').getByRole('button',{name:'Apply filter',exact:true}).click();
  expect(rules(await saved(page,'transactions'))[0]).toEqual({...before,operator:'today',value:''});
  expect(await records(page)).toEqual(original);expect(errors).toEqual([]);
});

test('stacked applied filters retain OR logic, share Code Lists changes and close drafts on an account switch',async({page})=>{
  const errors=await seedGuest(page);await page.addInitScript(()=>{
    if(localStorage.getItem('dn_applied_or_seed'))return;
    const group={id:'root',kind:'group',join:'OR',children:[
      {id:'completed-filter',kind:'rule',field:'activity.status',operator:'eq',value:'completed'},
      {id:'pending-filter',kind:'rule',field:'activity.status',operator:'eq',value:'in-progress'},
    ]};
    localStorage.setItem('dn_list_state_guest_conditions%3Aactivities',JSON.stringify({group,migrationVersion:1}));localStorage.setItem('dn_applied_or_seed','true');
  });
  await page.goto('/activities');const original=await records(page);const before=await saved(page,'activities');
  const chips=page.locator('.dn-condition-chip');await expect(chips).toHaveCount(2);
  const boxes=await chips.evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,h:r.height};}));
  expect(boxes[1].x).toBe(boxes[0].x);expect(boxes[1].y).toBeGreaterThanOrEqual(boxes[0].y+boxes[0].h);
  await chips.filter({hasText:'Completed'}).getByRole('combobox',{name:'Change Status filter'}).click();await page.getByRole('option',{name:'Cancelled',exact:true}).click();
  const changed=await saved(page,'activities');expect(changed).toEqual({...before,children:before.children.map(n=>n.id==='completed-filter'?{...n,value:'cancelled'}:n)});
  await page.goto('/settings/code-lists');const preferences=page.getByRole('region',{name:'List sorting and filters preferences'});
  await preferences.getByRole('button',{name:/Activities filters/}).click();const editor=preferences.getByRole('region',{name:'activities filters',exact:true});
  await editor.locator('.dn-condition-chip').filter({hasText:'Cancelled'}).getByRole('combobox',{name:'Change Status filter'}).click();await page.getByRole('option',{name:'Completed',exact:true}).click();
  expect(await saved(page,'activities')).toEqual(before);
  await page.goto('/financials');await add(page,'Title');await page.getByRole('textbox',{name:'Value for Title',exact:true}).fill('Room');await page.getByRole('textbox',{name:'Value for Title',exact:true}).blur();
  await expect(page.locator('.dn-condition-chip')).toHaveCount(1);await page.getByRole('button',{name:/^Filters/}).click();const guestFilter=await saved(page,'transactions');
  await page.getByRole('button',{name:'Change Title filter',exact:true}).click();await page.getByRole('dialog').getByRole('textbox',{name:'Value for Title',exact:true}).fill('Uncommitted draft');
  await accountScope(page,'applied-filter-review',fixtureMoments());await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await saved(page,'transactions')).toEqual(guestFilter);expect(await records(page)).toEqual(original);expect(await page.evaluate(()=>window.__dnAccountWrites)).toEqual([]);expect(errors).toEqual([]);
});
