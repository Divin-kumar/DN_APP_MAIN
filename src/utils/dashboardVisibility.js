import { getCodeListMeta } from './codeLists.js';
import { getEventDate, getNextOccurrenceDate, getStartOfDay } from './momentDates.js';

export const DEFAULT_MOMENT_TYPE_CONFIG = Object.freeze({
  value: '',
  label: '',
  canGenerateGreetingCards: true,
  greetingTemplate: '',
  showInDashboardUpcoming: true,
  showActivitiesOnDashboard: true,
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
    showActivitiesOnDashboard: match.showActivitiesOnDashboard ?? true,
  };
};

const getDashboardEventsFor = (events = [], customValues = [], visibilityKey) => {
  const momentTypes = getCodeListMeta('eventTypes', customValues);
  return (Array.isArray(events) ? events : []).filter((event) => {
    if (!event || event.archived || ['archived', 'cancelled'].includes(String(event.status || '').trim().toLowerCase())) return false;
    const eventType = String(event.type || event.customType || '').trim();
    const customType = String(event.customType || '').trim();
    const configuredCustomType = eventType.toLowerCase() === 'other' && customType && momentTypes.some((entry) => (
      entry.value.toLowerCase() === customType.toLowerCase() || entry.label.toLowerCase() === customType.toLowerCase()
    ));
    const effectiveType = configuredCustomType ? customType : eventType;
    return getMomentTypeConfig(effectiveType, momentTypes)[visibilityKey] !== false;
  });
};

export const getDashboardVisibleEvents = (events = [], customValues = []) => getDashboardEventsFor(events, customValues, 'showInDashboardUpcoming');

// Activity visibility is independent of whether the parent Moment appears.
export const getDashboardVisibleActivityEvents = (events = [], customValues = []) => getDashboardEventsFor(events, customValues, 'showActivitiesOnDashboard');

export const getUpcomingDashboardEvents = (events = [], referenceDate = new Date(), customValues = []) => {
  const today = getStartOfDay(referenceDate);
  const lastDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
  return getDashboardVisibleEvents(events, customValues)
    .map((event) => ({ event, date: getNextOccurrenceDate(event, today) }))
    .filter(({ date }) => date && date >= today && date <= lastDay)
    .sort((first, second) => first.date - second.date)
    .map(({ event }) => event);
};

export const getOnThisDayDashboardEvents = (events = [], referenceDate = new Date(), customValues = []) => {
  const today = getStartOfDay(referenceDate);
  return getDashboardVisibleEvents(events, customValues)
    .map((event) => ({ event, date: getEventDate(event) }))
    .filter(({ date }) => date && date.getFullYear() < today.getFullYear()
      && date.getMonth() === today.getMonth() && date.getDate() === today.getDate())
    .sort((first, second) => second.date - first.date)
    .map(({ event }) => event);
};

export const getMomentTypeGreetingTemplate = (momentType, customValues = [], fallbackTemplate = '') => {
  const config = getMomentTypeConfig(momentType, customValues);
  if (config.canGenerateGreetingCards === false) return '';
  return (config.greetingTemplate || fallbackTemplate || '').trim();
};
