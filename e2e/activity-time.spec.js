import { test, expect } from '@playwright/test';
import { seedGuest, fixtureMoments, activityDetailAction } from './fixtures.js';

for (const width of [320,390,1280]) {
  test(`optional time create, edit, clear, list/Story/PDF order at ${width}px`, async ({page}) => {
    await page.setViewportSize({width,height:900});
    const moments=fixtureMoments();
    moments[0].activities=[
      {id:'late',title:'Evening chapter',date:'2026-10-01',time:'18:30',completed:false},
      {id:'untimed',title:'Untimed chapter',date:'2026-10-01',completed:false},
      {id:'early',title:'Morning chapter',date:'2026-10-01',time:'07:20',completed:false},
    ];
    const errors=await seedGuest(page,{moments,theme:width===1280?'light':'dark'});
    await page.goto('/events/moment-one/story');
    const original=await page.evaluate(()=>localStorage.getItem('dn_guest_eventGroups'));
    await expect(page.locator('[data-story-activity]')).toHaveCount(3);
    expect(await page.locator('[data-story-activity]').evaluateAll(nodes=>nodes.map(n=>n.dataset.storyActivity))).toEqual(['early','late','untimed']);
    await expect(page.locator('[data-story-activity="early"]')).toContainText('07:20');
    const pdfs=await page.evaluate(async()=>{
      const {renderMomentStudioPdf}=await import('/src/utils/momentPdf.js');
      const moment=JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0];
      const original=CanvasRenderingContext2D.prototype.fillText;
      const results=[];let words=[];
      CanvasRenderingContext2D.prototype.fillText=function(text,...rest){words.push(String(text));return original.call(this,text,...rest);};
      try {for(const template of ['journey','diary','chronicle']){
        words=[];const book=await renderMomentStudioPdf(moment,{template,includeCover:false});
        results.push({template,words:words.filter(w=>/Morning chapter|Evening chapter|Untimed chapter|07:20|18:30/.test(w)),bytes:book.blob.size});
      }}finally{CanvasRenderingContext2D.prototype.fillText=original;}
      return results;
    });
    for(const pdf of pdfs){
      const titles=pdf.words.filter(w=>/chapter/.test(w));
      expect(titles[0]).toContain('Morning chapter');expect(titles[1]).toContain('Evening chapter');expect(titles[2]).toContain('Untimed chapter');
      expect(pdf.words.join(' ')).toContain('07:20');expect(pdf.words.join(' ')).toContain('18:30');expect(pdf.bytes).toBeGreaterThan(1000);
    }
    expect(await page.evaluate(()=>localStorage.getItem('dn_guest_eventGroups'))).toBe(original);
    await page.goto('/events/moment-one/activities/early');
    await activityDetailAction(page,'Edit');
    await page.getByRole('dialog').locator('.dn-form-disclosure > summary').click();
    await expect(page.getByLabel('Activity time',{exact:true})).toHaveValue('07:20');
    await page.getByLabel('Activity time',{exact:true}).fill('06:30');
    await expect(page.getByRole('dialog')).toHaveCSS('opacity','1');
    await page.screenshot({path:`.verification/activity-time-editor-${width}.png`});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.getByRole('button',{name:'Save activity',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);await page.reload();
    await expect(page.locator('.activity-detail-due')).toContainText('06:30');
    await activityDetailAction(page,'Edit');await page.getByRole('dialog').locator('.dn-form-disclosure > summary').click();
    await page.getByRole('button',{name:'Clear activity time',exact:true}).click();
    await page.getByRole('button',{name:'Save activity',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto('/events/moment-one/activities?create=activity');
    await page.getByRole('dialog').locator('.dn-form-disclosure > summary').click();
    await expect(page.getByLabel('Activity time',{exact:true})).toHaveValue(/^[0-2]\d:[0-5]\d$/);
    await page.getByPlaceholder('Entry title',{exact:true}).fill('Midnight chapter');
    await page.getByLabel('Activity time',{exact:true}).fill('00:00');
    await page.locator('input[type="date"]').fill('2026-10-01');
    await page.getByRole('button',{name:'Add entry',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto('/activities');
    await expect(page.locator('.event-activity-list')).toContainText('Midnight chapter');
    const titles=await page.locator('.event-activity-title-row strong').allTextContents();
    expect(titles.indexOf('Midnight chapter')).toBeLessThan(titles.indexOf('Evening chapter'));
    await page.screenshot({path:`.verification/activity-time-list-${width}.png`});
    await page.getByRole('button',{name:/Filters and sort/}).click();
    await page.getByRole('button',{name:'Clear all',exact:true}).click();
    await page.getByRole('button',{name:'Add filter',exact:true}).click();
    await page.getByRole('combobox',{name:'Filter by',exact:true}).click();
    await page.getByRole('option',{name:'Time',exact:true}).click();
    await page.getByRole('combobox',{name:'Comparison',exact:true}).click();
    await page.getByRole('option',{name:'Is',exact:true}).click();
    await page.getByRole('combobox',{name:'Value for Time',exact:true}).click();
    await page.getByRole('option',{name:'18:30',exact:true}).click();
    await expect(page.locator('.event-activity-title-row strong')).toHaveText(['Evening chapter']);
    await page.reload();
    await expect(page.locator('.event-activity-title-row strong')).toHaveText(['Evening chapter']);
    expect(errors).toEqual([]);
  });
}

test('universal Activity creation saves its clock time and the next draft captures the current time', async ({page})=>{
  const errors=await seedGuest(page);
  await page.goto('/events/moment-one/story');
  const open=async()=>{
    await page.getByRole('button',{name:'Open quick create menu',exact:true}).click();
    await page.getByRole('button',{name:'Activity',exact:true}).click();
  };
  await open();
  await page.getByRole('dialog').locator('.dn-form-disclosure > summary').click();
  await page.getByRole('textbox',{name:'Entry title',exact:true}).fill('Lunch entry');
  await page.getByLabel('Activity time',{exact:true}).fill('12:45');
  await page.getByRole('button',{name:'Save entry',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0].activities.find(a=>a.title==='Lunch entry').time)).toBe('12:45');
  await open();await expect(page.getByLabel('Activity time',{exact:true})).toHaveValue(/^[0-2]\d:[0-5]\d$/);
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(errors).toEqual([]);
});
