import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePdfStudioOptions, PDF_STYLE_NAMES, PDF_STYLE_PALETTES } from './pdfStudioOptions.js';
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
