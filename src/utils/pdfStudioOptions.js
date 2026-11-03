import { STORY_DESIGN_DEFAULTS, STORY_DESIGN_STYLES } from './storyDesignPreferences.js';
// PDF Studio configuration never writes into the source Moment or Code Lists.
// Internal values intentionally match DN's existing Story presentation codes.
export const PDF_TEMPLATES = Object.freeze([
  { value: 'journey', label: 'Journal', description: 'Photo memory book' },
  { value: 'diary', label: 'Diary', description: 'Monthly writing' },
  { value: 'chronicle', label: 'Tasks', description: 'Status report' },
]);
export const PDF_DENSITIES = Object.freeze(['airy', 'balanced', 'compact']);
export const PDF_PAGE_NUMBER_POSITIONS = Object.freeze([
  { value: 'right', label: 'Right' },
  { value: 'center', label: 'Center' },
  { value: 'none', label: 'Hidden' },
]);
// Keep the old right-aligned, cover-inclusive footer as the export default.
export const pdfPageNumberLabel = (pageNumber, options = {}) => {
  const position = options.pageNumberPosition || 'right';
  if (position === 'none' || !Number.isSafeInteger(pageNumber) || pageNumber < 1) return '';
  const skipCover = options.includeCover === true && options.numberCoverPage === false;
  if (skipCover && pageNumber === 1) return '';
  return String(pageNumber - (skipCover ? 1 : 0));
};
/*
 * Pixel density of the complete A4 paper page, not original-photo quality.
 * Print draft is experimental, bounded to avoid runaway multi-page memory use.
 * Original standard output retains the exact previous 1.65x / JPEG .84 path.
 */
export const PDF_PAGE_QUALITY_PROFILES = Object.freeze({
  standard: Object.freeze({ scale: 1.65, jpegQuality: .84, maxPages: 300, dpi: 119 }),
  enhanced: Object.freeze({ scale: 3, jpegQuality: .9, maxPages: 60, dpi: 216 }),
  print: Object.freeze({ scale: 300 / 72, jpegQuality: .92, maxPages: 24, dpi: 300 }),
});
export const PDF_PAGE_QUALITY_OPTIONS = Object.freeze([
  { value: 'standard', label: 'Standard', description: 'Fast and smaller files' },
  { value: 'enhanced', label: 'Enhanced · 216 dpi', description: 'Experimental, larger files' },
  { value: 'print', label: 'Print draft · 300 dpi', description: 'Experimental, up to 24 pages' },
]);
export const pdfPagePixelSize = (quality = 'standard') => {
  const profile = PDF_PAGE_QUALITY_PROFILES[quality] || PDF_PAGE_QUALITY_PROFILES.standard;
  return { width: Math.round(595 * profile.scale), height: Math.round(842 * profile.scale) };
};
export const PDF_STYLE_NAMES = Object.freeze({
  heritage: 'Heritage', editorial: 'Editorial', minimal: 'Minimal',
});
// Curated raster palettes share the existing proven PDF page/preview pipeline.
// A searchable vector-text renderer remains a separate DN 2.2.0 feasibility gate.
export const PDF_STYLE_PALETTES = Object.freeze({
  heritage: Object.freeze({
    paper: '#F8F3E9', ink: '#332D28', muted: '#746A5D',
    accent: '#7D6A50', line: '#D7CCBC', surface: '#EDE2D2',
  }),
  editorial: Object.freeze({
    paper: '#F8FAFA', ink: '#203443', muted: '#627783',
    accent: '#315D70', line: '#D6E3E6', surface: '#DCE9ED',
  }),
  minimal: Object.freeze({
    paper: '#FFFFFF', ink: '#25292D', muted: '#697179',
    accent: '#495660', line: '#E3E7EA', surface: '#F3F5F6',
  }),
});
export const PDF_TEMPLATE_NAMES = Object.freeze({
  journey: 'Journal', diary: 'Diary', chronicle: 'Tasks',
});
const flag = (value, fallback) => typeof value === 'boolean' ? value : fallback;
export const normalizePdfStudioOptions = (source = {}, defaultTemplate = 'journey', savedStyles = STORY_DESIGN_DEFAULTS) => {
  const template = PDF_TEMPLATE_NAMES[source?.template] ? source.template
    : PDF_TEMPLATE_NAMES[defaultTemplate] ? defaultTemplate : 'journey';
  const visualStyle = STORY_DESIGN_STYLES.includes(source?.visualStyle) ? source.visualStyle
    : STORY_DESIGN_STYLES.includes(savedStyles?.[template]) ? savedStyles[template]
      : STORY_DESIGN_DEFAULTS[template];
  return {
    template,
    visualStyle,
    searchableText: flag(source?.searchableText, false),
    pageQuality: Object.hasOwn(PDF_PAGE_QUALITY_PROFILES, source?.pageQuality)
      ? source.pageQuality : 'standard',
    density: PDF_DENSITIES.includes(source?.density) ? source.density : 'balanced',
    pageNumberPosition: PDF_PAGE_NUMBER_POSITIONS.some((item) => item.value === source?.pageNumberPosition)
      ? source.pageNumberPosition : 'right',
    numberCoverPage: flag(source?.numberCoverPage, true),
    includeCover: flag(source?.includeCover, template === 'journey'),
    includeIntro: flag(source?.includeIntro, true),
    includeReflections: flag(source?.includeReflections, false),
    includeUpcoming: flag(source?.includeUpcoming, true),
    includeCompleted: flag(source?.includeCompleted, true),
    includeCancelled: flag(source?.includeCancelled, false),
  };
};
export const pdfStudioTaskSections = (groups = [], options = {}) =>
  groups.filter((group) => group.status === 'in-progress'
    || (group.status === 'completed' && options.includeCompleted !== false)
    || (group.status === 'cancelled' && options.includeCancelled === true))
    .map((group) => ({ ...group, entries: [...group.entries] }));
