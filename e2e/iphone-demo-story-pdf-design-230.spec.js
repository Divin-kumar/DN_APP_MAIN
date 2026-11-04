import { test, expect } from '@playwright/test';

// The real public Explore DN Guest journey, not an injected synthetic setting.
// Uses an isolated demo key; checks the regular Guest style store is untouched.
test.use({ hasTouch: true, isMobile: true });
for(const [width,height] of [[320,740],[390,844],[430,932]]){
  test(`Guest demo Story and PDF designs save without touching personal choices ${width}px`,async({page})=>{
    await page.setViewportSize({width,height});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/login');
    await page.getByRole('button',{name:'Continue as Guest'}).click();
    await page.goto('/settings/appearance');
    const region=page.getByRole('region',{name:'Story and PDF appearance'});
    await expect(region.getByText(/Exploring the demo/)).toBeVisible();
    const guestBefore=await page.evaluate(()=>({
      styles:localStorage.getItem('dn_story_pdf_design_v1:guest'),
      moments:localStorage.getItem('dn_guest_eventGroups'),
      tasks:localStorage.getItem('dn_guest_tasks'),
    }));
    const heritage=region.getByRole('button',{name:'Journal: Heritage'});
    await expect(heritage).toBeEnabled();
    const save=region.getByRole('button',{name:'Save designs'});
    await expect(save).toBeEnabled();
    await expect(region.getByText('All designs saved.')).toBeVisible();
    await heritage.tap();
    await expect(region.getByText(/Unsaved changes/)).toBeVisible();
    await save.tap();
    await expect(region.getByText('All designs saved.')).toBeVisible();
    const demoKey='dn_story_pdf_design_v1:guest-demo';
    await expect.poll(()=>page.evaluate(key=>
      JSON.parse(localStorage.getItem(key)||'{}')?.styles?.journey,demoKey)).toBe('heritage');
    expect(await page.evaluate(()=>localStorage.getItem('dn_story_pdf_design_v1:guest')))
      .toBe(guestBefore.styles);
    await page.reload();
    await expect(region.getByRole('button',{name:'Journal: Heritage'})).toHaveAttribute('aria-pressed','true');
    const sample=await page.evaluate(()=>JSON.parse(localStorage.getItem('dn_dev_fixture_data')));
    expect(sample.scenario).toBe('tour');
    const journal=sample.events[0];
    await page.goto('/events/'+encodeURIComponent(journal.id)+'/pdf');
    const studio=page.locator('.dn-pdf-studio-page');
    await expect(studio.getByRole('button',{name:'PDF design Heritage'})).toHaveAttribute('aria-pressed','true',{timeout:25000});
    await page.goto('/settings');
    await page.getByRole('button',{name:'Use my Guest data'}).click();
    await page.goto('/settings/appearance');
    await expect(region.getByRole('button',{name:'Journal: Editorial'})).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>({
      styles:localStorage.getItem('dn_story_pdf_design_v1:guest'),
      moments:localStorage.getItem('dn_guest_eventGroups'),
      tasks:localStorage.getItem('dn_guest_tasks'),
    }))).toEqual(guestBefore);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    expect(errors).toEqual([]);
  });
}
