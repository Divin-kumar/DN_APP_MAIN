import { test, expect } from '@playwright/test';
import { calendarDate, fixtureMoments, seedGuest } from './fixtures.js';

const formatNames = [
  { id: 'journal-contrast', type: 'Vacation', format: 'journey',
    heading: '.dn-journal-page .dn-journal-chapter .dn-v2-story-entry-body > h4',
    paper: '.dn-journal-page' },
  { id: 'diary-contrast', type: 'Diary', format: 'diary',
    heading: '.dn-diary-monthbook .dn-diary-paragraph h4',
    paper: '.dn-diary-monthbook' },
  { id: 'tasks-contrast', type: 'Tasks', format: 'chronicle',
    heading: '.dn-task-group .dn-task-row-heading a',
    paper: '.dn-task-group' },
];

const readableContrast = async (element, paper) => {
  const colors = await element.evaluate((node, paperSelector) => {
    const getColor = (value) => {
      const channels = value.match(/[\d.]+/g)?.slice(0,3).map(Number);
      return channels?.length === 3 ? channels : [0,0,0];
    };
    const background = getColor(getComputedStyle(document.querySelector(paperSelector)).backgroundColor);
    return { ink: getColor(getComputedStyle(node).color), background };
  }, paper);
  const lum = (channel) => {
    const x = channel / 255;
    return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4;
  };
  const lightness = (rgb) => .2126 * lum(rgb[0]) + .7152 * lum(rgb[1]) + .0722 * lum(rgb[2]);
  const x = lightness(colors.ink), y = lightness(colors.background);
  return (Math.max(x,y) + .05) / (Math.min(x,y) + .05);
};

for (const theme of ['dark', 'light']) {
  test(`Story book pages keep readable text in ${theme} app theme at iPhone width`, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const source = fixtureMoments()[0];
    const moments = formatNames.map(({ id, type }) => ({
      ...structuredClone(source), id, name: id, type,
      activities: [{ id: id + '-chapter', title: 'The little village',
        description: '<p>We walked between shops and discovered a calm street.</p>',
        date: '2026-10-14', completed: true }],
    }));
    const errors = await seedGuest(page, { moments, theme });
    await page.setViewportSize({ width: 390, height: 844 });
    // Establish the local DN origin before touching browser-local preferences.
    await page.goto('/events');
    for (const style of ['heritage', 'editorial', 'minimal']) {
      await page.evaluate((visualStyle) => {
        localStorage.setItem('dn_story_pdf_design_v1:guest', JSON.stringify({
          version: 1, styles: { journey: visualStyle, diary: visualStyle, chronicle: visualStyle },
        }));
      }, style);
      for (const { id, format, heading, paper } of formatNames) {
        await page.goto('/events/' + id + '/story');
        const story = page.locator('.dn-v2-story');
        await expect(story).toHaveAttribute('data-presentation', format);
        await expect(story).toHaveAttribute('data-design-style', style);
        const paperRgb = await story.locator(paper).first().evaluate(el => getComputedStyle(el).backgroundColor.match(/\d+/g).slice(0,3).map(Number));
        expect(paperRgb.every(channel => theme === 'dark' ? channel < 65 : channel > 230)).toBe(true);
        const h = story.locator(heading).first();
        await expect(h).toBeVisible();
        expect(await readableContrast(h, paper), `${format}/${style}/${theme} title`).toBeGreaterThanOrEqual(4.5);
        if (format === 'journey' && style === 'heritage') {
          await h.scrollIntoViewIfNeeded();
          await testInfo.attach(`journal-heritage-${theme}-390px`, {
            body: await page.screenshot({ fullPage: false }), contentType: 'image/png',
          });
        }
        if (format !== 'chronicle') {
          const prose = story.locator(paper + ' .dn-v2-story-entry-description').first();
          await expect(prose).toBeVisible();
          expect(await readableContrast(prose, paper), `${format}/${style}/${theme} prose`).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
    expect(errors).toEqual([]);
  });
}


// 2.3 Phase 1: auxiliary future/undated chapters render on the application
// shell, not on the light book paper. They must not inherit dark paper ink.
for (const { width, theme } of [
  { width: 320, theme: 'dark' },
  { width: 390, theme: 'dark' },
  { width: 430, theme: 'dark' },
  { width: 390, theme: 'light' },
]) {
  test('Unboxed future and undated Story chapters use shell ink at ' + width + 'px ' + theme, async ({ page }, testInfo) => {
    test.setTimeout(120000);
    const moments = [
      { id: 'aux-journey', type: 'Vacation', presentation: 'journey' },
      { id: 'aux-diary', type: 'Diary', presentation: 'diary' },
    ].map(({ id, type }) => ({
      id, name: 'Shell contrast sample', type, date: calendarDate(-2),
      notes: 'A synthetic Story contrast check.',
      attachments: [], memories: [],
      activities: [
        { id: id + '-future', eventId: id, title: 'Future chapter',
          description: '<p>Future writing should be readable.</p>',
          status: 'in-progress', completed: false, date: calendarDate(8),
          entries: [{ id: id + '-continuation', date: calendarDate(9),
            time: '10:15', description: '<p>Additional future writing.</p>' }] },
        { id: id + '-undated', eventId: id, title: 'Undated chapter',
          description: '<p>Untimed writing should be readable.</p>',
          status: 'in-progress', completed: false, date: '' },
      ],
    }));
    const errors = await seedGuest(page, { moments, theme });
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/events');
    for (const style of ['heritage', 'editorial', 'minimal']) {
      await page.evaluate((visualStyle) => {
        localStorage.setItem('dn_story_pdf_design_v1:guest', JSON.stringify({
          version: 1, styles: {
            journey: visualStyle, diary: visualStyle, chronicle: visualStyle,
          },
        }));
      }, style);
      for (const moment of moments) {
        await page.goto('/events/' + moment.id + '/story');
        const story = page.locator('.dn-v2-story');
        await expect(story).toHaveAttribute('data-design-style', style);
        const shellInk = await story.evaluate((node) => getComputedStyle(node).color);
        const sections = story.locator('.dn-v2-story-aux');
        await expect(sections).toHaveCount(2);
        for (const section of [sections.nth(0), sections.nth(1)]) {
          for (const selector of [
            '.dn-v2-story-entry-body > h4',
            '.dn-v2-story-entry-body > h4 a',
            '.dn-v2-story-entry-description',
          ]) {
            const element = section.locator(selector).first();
            await expect(element).toBeVisible();
            const ink = await element.evaluate((node) => getComputedStyle(node).color);
            expect(ink, style + ' ' + moment.type + ' ' + selector + ' ' + theme).toBe(shellInk);
          }
        }
        if (theme === 'dark' && width === 390 && style === 'editorial' && moment.type === 'Vacation') {
          await testInfo.attach('unboxed-story-dark-390px', {
            body: await page.screenshot({ fullPage: false }),
            contentType: 'image/png',
          });
        }
      }
    }
    expect(errors).toEqual([]);
  });
}
