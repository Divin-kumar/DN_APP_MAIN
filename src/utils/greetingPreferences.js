export const migrateGreetingPreferences = (stored = {}, defaultTemplates = {}) => {
  const greetingTemplates = { ...defaultTemplates, ...(stored.greetingTemplates || {}) };
  const greetingTemplateStyles = { ...(stored.greetingTemplateStyles || {}) };
  const greetingCustomTemplates = { ...(stored.greetingCustomTemplates || {}) };

  for (const [eventType, template] of Object.entries(greetingTemplates)) {
    if (greetingTemplateStyles[eventType]) continue;
    const isLegacyDefault = template === defaultTemplates[eventType];
    greetingTemplateStyles[eventType] = isLegacyDefault ? 'Default' : 'Custom';
    if (!isLegacyDefault && !greetingCustomTemplates[eventType]) greetingCustomTemplates[eventType] = template;
  }

  return { greetingTemplates, greetingTemplateStyles, greetingCustomTemplates };
};
