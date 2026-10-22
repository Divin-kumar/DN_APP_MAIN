import { getCodeListLabel } from './codeLists.js';

// Tagged keys keep a custom Other type distinct from a stored type with the
// same label. These are UI keys only; the Moment and activity stay unchanged.
const momentType = (event) => {
  const type = String(event.type || 'Personal');
  const custom = type === 'Other' ? String(event.customType || '').trim() : '';
  return custom ? { key: `custom:${custom}`, value: custom } : { key: `type:${type}`, value: type };
};

export const activityMomentTypes = (events, codeListValues) => {
  const types = new Map();
  events.forEach((event) => {
    const { key, value } = momentType(event);
    if (!types.has(key)) types.set(key, {
      value: key,
      label: key.startsWith('custom:') ? value : getCodeListLabel('eventTypes', value, codeListValues),
    });
  });
  return [...types.values()].sort((first, second) => first.label.localeCompare(second.label));
};

export const filterActivityMoments = (events, typeKey = '') => typeKey
  ? events.filter((event) => momentType(event).key === typeKey)
  : events;
