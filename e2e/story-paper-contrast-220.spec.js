import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest } from './fixtures.js';

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
