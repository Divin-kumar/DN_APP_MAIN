import { test, expect } from '@playwright/test';
import { fixtureMoments, seedGuest } from './fixtures.js';

for (const template of ['journey', 'diary', 'chronicle']) {
  test(`${template} PDF excludes cancelled activities, even with legacy includeCancelled enabled`, async ({ page }) => {
    const moments = fixtureMoments();
    moments[0].activities = [
      { id: 'kept', title: 'Keep this chapter', description: 'Visible writing', date: '2026-01-01', completed: true },
      { id: 'cancelled', title: 'CANCELLED_SENTINEL', description: 'CANCELLED_BODY', date: '2026-01-02', status: 'cancelled',
        entries: [{ id: 'child', description: 'CANCELLED_CHILD', date: '2026-01-03' }] },
      { id: 'legacy', title: 'CANCELLED_LEGACY', cancelled: true, completed: true },
    ];
    const errors = await seedGuest(page, { moments });
    await page.goto('/events');
    const before = await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'));
    const result = await page.evaluate(async template => {
      const { renderMomentStudioPdf } = await import('/src/utils/momentPdf.js');
      const event = JSON.parse(localStorage.getItem('dn_guest_eventGroups'))[0];
      const output = await renderMomentStudioPdf(event, { template, includeCancelled: true,
        includeCover: false, includeIntro: false, searchableText: true });
      return { text: output.pages.flatMap(p => p.textRuns.map(r => r.text)).join(' '),
        bytes: output.blob.size, cancelled: output.options.includeCancelled };
    }, template);
    expect(result.bytes).toBeGreaterThan(1500);
    expect(result.text).toContain('Visible writing');
    expect(result.text).not.toContain('CANCELLED_');
    expect(result.cancelled).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('dn_guest_eventGroups'))).toBe(before);
    expect(errors).toEqual([]);
  });
}
