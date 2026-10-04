import { getCodeListMeta } from './codeLists.js';

export const DEFAULT_MOMENT_TYPE_CONFIG = Object.freeze({
  value: '',
  label: '',
  canGenerateGreetingCards: true,
  greetingTemplate: '',
  showInDashboardUpcoming: true,
});

export const getMomentTypeConfig = (momentType, customValues = []) => {
  const configuredValue = String(momentType ?? '').trim();
  if (!configuredValue) {
    return { ...DEFAULT_MOMENT_TYPE_CONFIG };
  }

  const entries = getCodeListMeta('eventTypes', customValues);
  const match = entries.find((entry) => entry.value.toLowerCase() === configuredValue.toLowerCase())
    || entries.find((entry) => entry.label?.toLowerCase() === configuredValue.toLowerCase());

  if (!match) {
    return {
      ...DEFAULT_MOMENT_TYPE_CONFIG,
      value: configuredValue,
      label: configuredValue,
    };
  }

  return {
    ...DEFAULT_MOMENT_TYPE_CONFIG,
    value: match.value,
    label: match.label || match.value,
    canGenerateGreetingCards: match.canGenerateGreetingCards ?? true,
    greetingTemplate: typeof match.greetingTemplate === 'string' ? match.greetingTemplate : '',
    showInDashboardUpcoming: match.showInDashboardUpcoming ?? true,
  };
};

export const getDashboardVisibleEvents = (events = [], customValues = []) => ((Array.isArray(events) ? events : []).filter((event) => {
  const eventType = String(event?.type || event?.customType || '').trim();
  return getMomentTypeConfig(eventType, customValues).showInDashboardUpcoming !== false;
}));

export const getMomentTypeGreetingTemplate = (momentType, customValues = [], fallbackTemplate = '') => {
  const config = getMomentTypeConfig(momentType, customValues);
  if (config.canGenerateGreetingCards === false) return '';
  return (config.greetingTemplate || fallbackTemplate || '').trim();
};
