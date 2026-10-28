// PDF Studio configuration never writes into the source Moment or Code Lists.
// Internal values intentionally match DN's existing Story presentation codes.
export const PDF_TEMPLATES = Object.freeze([
  { value: 'journey', label: 'Journal', description: 'Photo memory book' },
  { value: 'diary', label: 'Diary', description: 'Monthly writing' },
  { value: 'chronicle', label: 'Tasks', description: 'Status report' },
]);
export const PDF_DENSITIES = Object.freeze(['airy', 'balanced', 'compact']);
export const PDF_TEMPLATE_NAMES = Object.freeze({
  journey: 'Journal', diary: 'Diary', chronicle: 'Tasks',
});
const flag = (value, fallback) => typeof value === 'boolean' ? value : fallback;
export const normalizePdfStudioOptions = (source = {}, defaultTemplate = 'journey') => {
  const template = PDF_TEMPLATE_NAMES[source?.template] ? source.template
    : PDF_TEMPLATE_NAMES[defaultTemplate] ? defaultTemplate : 'journey';
  return {
    template,
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
