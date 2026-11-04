/* DN 2.2.0: presentation settings only. Never write to Moment/Activity records. */
export const STORY_DESIGN_FORMATS = Object.freeze(['journey', 'diary', 'chronicle']);
export const STORY_DESIGN_STYLES = Object.freeze(['heritage', 'editorial', 'minimal']);
export const STORY_DESIGN_DEFAULTS = Object.freeze({
  journey: 'editorial', diary: 'heritage', chronicle: 'minimal',
});
export const STORY_DESIGN_EVENT = 'dn:story-design-changed';
const PREFIX = 'dn_story_pdf_design_v1';
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export const normalizeStoryDesign = (value) => {
  const source = record(value) ? value : {};
  return Object.fromEntries(STORY_DESIGN_FORMATS.map((format) => [
    format, STORY_DESIGN_STYLES.includes(source[format])
      ? source[format] : STORY_DESIGN_DEFAULTS[format],
  ]));
};

// Demo designs use an independent key, never the personal Guest key.
// Anonymous non-Guest sessions stay read-only.
export const storyDesignScope = ({ uid, isGuest = false, sample = false } = {}) => {
  if (sample) return isGuest && !uid ? PREFIX + ':guest-demo' : null;
  if (isGuest && !uid) return PREFIX + ':guest';
  if (typeof uid === 'string' && uid.trim() && !isGuest) return PREFIX + ':user:' + encodeURIComponent(uid);
  return null;
};

export const readStoryDesign = (storage, session) => {
  const key = storyDesignScope(session);
  if (!key || !storage) return normalizeStoryDesign();
  try {
    const parsed = JSON.parse(storage.getItem(key) || 'null');
    return normalizeStoryDesign(parsed?.version === 1 ? parsed.styles : {});
  } catch {
    return normalizeStoryDesign();
  }
};

const signalChange = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(STORY_DESIGN_EVENT));
};

export const saveStoryDesign = (storage, session, requested) => {
  const key = storyDesignScope(session);
  if (!key || !storage) return { ok: false, reason: 'No writable Guest or account session.' };
  const styles = normalizeStoryDesign(requested);
  storage.setItem(key, JSON.stringify({ version: 1, styles }));
  signalChange();
  return { ok: true, styles };
};

export const resetStoryDesign = (storage, session) => {
  const key = storyDesignScope(session);
  if (!key || !storage) return false;
  storage.removeItem(key);
  signalChange();
  return true;
};

export const exportStoryDesignForBackup = (storage, session) => {
  // Demo style choices are for exploration, not part of personal backups.
  if (session?.sample || !storyDesignScope(session)) return null;
  return { version: 1, styles: readStoryDesign(storage, session) };
};

// The field is optional in old v3 backups. Unexpected style names become safe defaults.
export const validateStoryDesignBackup = (value) => {
  if (value === undefined) return true;
  if (!record(value) || value.version !== 1 || !record(value.styles)) {
    throw new Error('Backup Story & PDF appearance settings are invalid.');
  }
  return true;
};

export const restoreStoryDesignFromBackup = (storage, session, value) => {
  if (value === undefined) return { changed: false };
  validateStoryDesignBackup(value);
  if (session?.sample) throw new Error('Exit Explore DN before restoring personal design settings.');
  const result = saveStoryDesign(storage, session, value.styles);
  if (!result.ok) throw new Error(result.reason);
  return { changed: true, styles: result.styles };
};
