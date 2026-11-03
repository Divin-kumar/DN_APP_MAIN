import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePdfStudioOptions, PDF_STYLE_NAMES, PDF_STYLE_PALETTES, PDF_PAGE_QUALITY_PROFILES, pdfPagePixelSize } from './pdfStudioOptions.js';
import { STORY_DESIGN_STYLES, STORY_DESIGN_DEFAULTS } from './storyDesignPreferences.js';

test('nine combinations keep Story format separate from the PDF look', () => {
  for (const template of ['journey', 'diary', 'chronicle']) {
    for (const visualStyle of STORY_DESIGN_STYLES) {
      const actual = normalizePdfStudioOptions({ template, visualStyle });
      assert.equal(actual.template, template);
      assert.equal(actual.visualStyle, visualStyle);
      assert.ok(PDF_STYLE_NAMES[visualStyle]);
      assert.match(PDF_STYLE_PALETTES[visualStyle].paper, /^#[0-9a-f]{6}$/i);
    }
  }
});

test('defaults can be inherited per format without writing the setting to records', () => {
  const savedStyles = { journey: 'minimal', diary: 'editorial', chronicle: 'heritage' };
  for (const format of Object.keys(savedStyles)) {
    assert.equal(normalizePdfStudioOptions({ template: format }, 'journey', savedStyles).visualStyle, savedStyles[format]);
  }
  assert.equal(normalizePdfStudioOptions({}, 'diary').visualStyle, STORY_DESIGN_DEFAULTS.diary);
  assert.equal(normalizePdfStudioOptions({ template: 'chronicle' }).visualStyle, STORY_DESIGN_DEFAULTS.chronicle);
  assert.equal(normalizePdfStudioOptions({ visualStyle: 'bogus' }, 'journey').visualStyle, 'editorial');
});

test('PDF format and content options retain all existing flags', () => {
  const actual = normalizePdfStudioOptions({
    template: 'diary', visualStyle: 'heritage', density: 'compact',
    includeCover: true, includeIntro: false, includeReflections: true,
    includeUpcoming: false, includeCompleted: false, includeCancelled: true,
  });
  assert.deepEqual({
    template: actual.template, density: actual.density, visualStyle: actual.visualStyle,
    includeCover: actual.includeCover, includeIntro: actual.includeIntro,
    includeReflections: actual.includeReflections, includeUpcoming: actual.includeUpcoming,
    includeCompleted: actual.includeCompleted, includeCancelled: actual.includeCancelled,
  }, {
    template: 'diary', visualStyle: 'heritage', density: 'compact',
    includeCover: true, includeIntro: false, includeReflections: true,
    includeUpcoming: false, includeCompleted: false, includeCancelled: true,
  });
});

test('paper quality profiles keep the legacy pixel size as default', () => {
  const standard = pdfPagePixelSize();
  const enhanced = pdfPagePixelSize('enhanced');
  const print = pdfPagePixelSize('print');
  assert.deepEqual(standard, { width: 982, height: 1389 });
  assert.deepEqual(enhanced, { width: 1785, height: 2526 });
  assert.deepEqual(print, { width: 2479, height: 3508 });
  assert.equal(normalizePdfStudioOptions().pageQuality, 'standard');
  assert.equal(normalizePdfStudioOptions({ pageQuality: 'enhanced' }).pageQuality, 'enhanced');
  assert.equal(normalizePdfStudioOptions({ pageQuality: 'print' }).pageQuality, 'print');
  assert.equal(normalizePdfStudioOptions({ pageQuality: 'fake' }).pageQuality, 'standard');
  assert.ok(PDF_PAGE_QUALITY_PROFILES.print.maxPages < PDF_PAGE_QUALITY_PROFILES.standard.maxPages);
  assert.equal(PDF_PAGE_QUALITY_PROFILES.print.dpi, 300);
});


test('4C page-number options retain the old default and safely validate choices', () => {
  const initial = normalizePdfStudioOptions();
  assert.equal(initial.pageNumberPosition, 'right');
  assert.equal(initial.numberCoverPage, true);
  assert.equal(normalizePdfStudioOptions({ pageNumberPosition: 'center', numberCoverPage: false }).pageNumberPosition, 'center');
  assert.equal(normalizePdfStudioOptions({ pageNumberPosition: 'none' }).pageNumberPosition, 'none');
  assert.equal(normalizePdfStudioOptions({ pageNumberPosition: 'bogus', numberCoverPage: 'false' }).pageNumberPosition, 'right');
  assert.equal(normalizePdfStudioOptions({ numberCoverPage: 'false' }).numberCoverPage, true);
});
test('4C cover numbering can be suppressed without changing physical page identity', async () => {
  const { pdfPageNumberLabel } = await import('./pdfStudioOptions.js');
  assert.equal(pdfPageNumberLabel(1), '1');
  assert.equal(pdfPageNumberLabel(2, { includeCover: true, numberCoverPage: false }), '1');
  assert.equal(pdfPageNumberLabel(1, { includeCover: true, numberCoverPage: false }), '');
  assert.equal(pdfPageNumberLabel(3, { includeCover: true, numberCoverPage: false }), '2');
  assert.equal(pdfPageNumberLabel(3, { pageNumberPosition: 'none' }), '');
  assert.equal(pdfPageNumberLabel(1, { includeCover: false, numberCoverPage: false }), '1');
  assert.equal(pdfPageNumberLabel(0), '');
});


test('4C optional page-per-Activity pagination preserves continuous existing defaults', () => {
  const unchanged = normalizePdfStudioOptions({});
  assert.equal(unchanged.pageBreakBetweenActivities, false);
  assert.equal(normalizePdfStudioOptions({ pageBreakBetweenActivities: true }).pageBreakBetweenActivities, true);
  assert.equal(normalizePdfStudioOptions({ pageBreakBetweenActivities: 'true' }).pageBreakBetweenActivities, false);
});
