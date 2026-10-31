import { getCodeListMeta } from './codeLists.js';

// One authoritative mode resolver for creation, Story, PDF and legacy types.
// New types must save an explicit value in Moment Type settings. Existing
// configurations preserve their saved Story choice, with safe legacy inference.
export const MOMENT_ENTRY_MODES = Object.freeze(['diary', 'journey', 'chronicle']);
const TASK_NAME_HINTS = new Set(['application and youtube', 'career', 'iqvia', 'project', 'work', 'task', 'tasks', 'to-do', 'todo']);
export const inferLegacyEntryMode = (name) => {
  const key = String(name || '').trim().toLocaleLowerCase();
  if (key === 'diary') return 'diary';
  if (TASK_NAME_HINTS.has(key)) return 'chronicle';
  return 'journey';
};

export const resolveMomentEntryMode = (moment = {}, momentTypes = []) => {
  const raw = String(moment?.type || '').trim();
  const custom = String(moment?.customType || '').trim();
  const name = raw.toLocaleLowerCase() === 'other' && custom ? custom : raw;
  const configured = getCodeListMeta('eventTypes', momentTypes);
  const find = (value) => configured.find((entry) =>
    entry.value.toLocaleLowerCase() === value.toLocaleLowerCase()
    || entry.label.toLocaleLowerCase() === value.toLocaleLowerCase());
  const selected = find(name) || (raw.toLocaleLowerCase() === 'other' ? find('Other') : null);
  return MOMENT_ENTRY_MODES.includes(selected?.storyPresentation)
    ? selected.storyPresentation : inferLegacyEntryMode(name);
};
