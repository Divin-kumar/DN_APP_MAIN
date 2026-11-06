import test from 'node:test';
import assert from 'node:assert/strict';
import { projectPdfContent, pdfContentInventory, normalizePdfContentSelection } from './pdfContentSelection.js';
import { buildMomentPdfStory } from './momentPdfStory.js';
import { createListStateMemory, listStateKey } from './listStateMemory.js';
import { PDF_CONTENT_DEFAULTS, PDF_CONTENT_RULES } from './pdfContentSelection.js';

const moment = { activities: [
  { id: 'a', firestoreId: 'alias', title: 'A', entries: [{ id: 'child', description: 'hidden' }] },
  { id: 'b', title: 'B' }, { id: 'c', cancelled: true },
], attachments: [{ id: 'a-file', activityId: 'a' }, { id: 'alias-file', activityId: 'alias' },
  { id: 'b-file', activityId: 'b' }, { id: 'own' }, { id: 'cancel-file', activityId: 'c' }] };
test('activity exclusion removes nested writing and alias-linked attachments without orphan leakage', () => {
  const before = JSON.stringify(moment);
  const story = buildMomentPdfStory(moment, {}, { excludedActivities: ['a'] });
  assert.deepEqual(story.undated.map(item => item.id), ['b']);
  assert.deepEqual(story.keepsakes.map(item => item.id), ['own']);
  assert.equal(JSON.stringify(moment), before);
});
test('individual files can be excluded independently; new records remain included and reset restores eligible content', () => {
  const output = projectPdfContent(moment, { excludedAttachments: ['a-file', 'own', 'deleted'] });
  assert.deepEqual(output.attachments.map(item => item.id), ['alias-file', 'b-file']);
  assert.equal(output.activities.length, 2);
  assert.equal(projectPdfContent(moment).attachments.length, 4);
  assert.deepEqual(normalizePdfContentSelection({ excludedActivities: null, excludedAttachments: [7] }), PDF_CONTENT_DEFAULTS);
});
test('inventory groups canonical and alias-owned files and hides cancelled records', () => {
  const inventory = pdfContentInventory(moment);
  assert.equal(inventory.activities.length, 2);
  assert.equal(inventory.activities[0].attachments.length, 2);
  assert.deepEqual(inventory.attachments.map(item => item.id), ['own']);
});
test('selection memory remains separate by Moment and account and survives a fresh memory instance', () => {
  const storage = new Map();
  const getStorage = () => ({ getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) });
  const memory = createListStateMemory(getStorage);
  const key = listStateKey('guest', 'pdf-content:personal:one');
  memory.update(key, PDF_CONTENT_DEFAULTS, PDF_CONTENT_RULES, { excludedActivities: ['a'] });
  const restored = createListStateMemory(getStorage);
  assert.deepEqual(restored.read(key, PDF_CONTENT_DEFAULTS, PDF_CONTENT_RULES).excludedActivities, ['a']);
  for (const other of [listStateKey('account:one', 'pdf-content:personal:one'), listStateKey('guest', 'pdf-content:personal:two'), listStateKey('guest', 'pdf-content:demo:one')]) {
    assert.deepEqual(restored.read(other, PDF_CONTENT_DEFAULTS, PDF_CONTENT_RULES), PDF_CONTENT_DEFAULTS);
  }
});
