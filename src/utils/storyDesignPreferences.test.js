import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  STORY_DESIGN_DEFAULTS, STORY_DESIGN_FORMATS, STORY_DESIGN_STYLES,
  normalizeStoryDesign, storyDesignScope, readStoryDesign, saveStoryDesign,
  resetStoryDesign, exportStoryDesignForBackup, restoreStoryDesignFromBackup,
  validateStoryDesignBackup,
} from './storyDesignPreferences.js';

const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    keys: () => Array.from(values.keys()),
  };
};

test('all nine Story/appearance combinations remain possible', () => {
  for (const format of STORY_DESIGN_FORMATS) for (const style of STORY_DESIGN_STYLES) {
    assert.equal(normalizeStoryDesign({ [format]: style })[format], style);
  }
  assert.deepEqual(normalizeStoryDesign(), STORY_DESIGN_DEFAULTS);
});

test('bad JSON and unsupported values safely fall back', () => {
  const store = storage(), guest = { isGuest: true };
  store.setItem(storyDesignScope(guest), '{broken');
  assert.deepEqual(readStoryDesign(store, guest), STORY_DESIGN_DEFAULTS);
  assert.equal(normalizeStoryDesign({ diary: '__proto__', journey: null }).diary, 'heritage');
});

test('Guest and independent accounts never share appearance settings', () => {
  const store = storage(), guest = { isGuest: true }, a = { uid: 'a' }, b = { uid: 'b' };
  assert.equal(saveStoryDesign(store, guest, { journey: 'minimal' }).ok, true);
  assert.equal(saveStoryDesign(store, a, { journey: 'heritage' }).ok, true);
  assert.equal(readStoryDesign(store, guest).journey, 'minimal');
  assert.equal(readStoryDesign(store, a).journey, 'heritage');
  assert.equal(readStoryDesign(store, b).journey, 'editorial');
  resetStoryDesign(store, a);
  assert.equal(readStoryDesign(store, a).journey, 'editorial');
  assert.equal(readStoryDesign(store, guest).journey, 'minimal');
});

test('demo and anonymous contexts cannot write appearance choices', () => {
  const store = storage();
  assert.equal(saveStoryDesign(store, { isGuest: true, sample: true }, {}).ok, false);
  assert.equal(saveStoryDesign(store, {}, {}).ok, false);
  assert.equal(store.keys().length, 0);
});

test('backup preserves old omissions and validates optional scoped appearance', () => {
  const store = storage(), account = { uid: 'account' };
  saveStoryDesign(store, account, { diary: 'minimal' });
  assert.equal(exportStoryDesignForBackup(store, account).styles.diary, 'minimal');
  assert.equal(exportStoryDesignForBackup(store, { isGuest: true, sample: true }), null);
  assert.deepEqual(restoreStoryDesignFromBackup(store, account, undefined), { changed: false });
  assert.equal(readStoryDesign(store, account).diary, 'minimal');
  assert.equal(restoreStoryDesignFromBackup(store, account, {
    version: 1, styles: { diary: 'heritage' },
  }).changed, true);
  assert.equal(readStoryDesign(store, account).diary, 'heritage');
  assert.throws(() => validateStoryDesignBackup({ styles: {} }), /invalid/);
});
