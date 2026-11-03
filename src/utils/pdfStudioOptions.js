import { STORY_DESIGN_DEFAULTS, STORY_DESIGN_STYLES } from './storyDesignPreferences.js';
// PDF Studio configuration never writes into the source Moment or Code Lists.
// Internal values intentionally match DN's existing Story presentation codes.
export const PDF_TEMPLATES = Object.freeze([
  { value: 'journey', label: 'Journal', description: 'Photo memory book' },
  { value: 'diary', label: 'Diary', description: 'Monthly writing' },
  { value: 'chronicle', label: 'Tasks', description: 'Status report' },
]);
export const PDF_DENSITIES = Object.freeze(['airy', 'balanced', 'compact']);
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
    density: PDF_DENSITIES.includes(source?.density) ? source.density : 'balanced',
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
