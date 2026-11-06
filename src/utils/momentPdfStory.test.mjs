import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMomentPdfStory } from './momentPdfStory.js';
import { buildMomentStory } from './momentStory.js';

const all = story => [...story.timeline.flatMap(m => m.days.flatMap(d => d.entries)), ...story.upcoming, ...story.undated];
test('PDF excludes cancelled chapters, nested writing and linked files without changing Story or storage', () => {
  const moment = { activities: [
    { id: 'active', title: 'Keep', date: '2026-01-01' },
    { id: 'done', completed: true },
    { id: 'cancel', firestoreId: 'alias', status: 'cancelled', date: '2026-01-02', entries: [{description:'Private cancelled note'}] },
    { id: 'legacy', cancelled: true, completed: true },
  ], attachments: [
    { id: 'own', activityId: 'cancel' }, { id: 'alias-file', activityId: 'alias' },
    { id: 'legacy-file', activityId: 'legacy' }, { id: 'moment-file' },
    { id: 'orphan', activityId: 'missing' },
  ] };
  const before = JSON.stringify(moment);
  const pdf = buildMomentPdfStory(moment);
  assert.deepEqual(all(pdf).map(x => x.id), ['active','done']);
  assert.deepEqual(pdf.keepsakes.map(x => x.id), ['moment-file','orphan']);
  assert.equal(all(buildMomentStory(moment)).length, 4);
  assert.equal(JSON.stringify(moment), before);
  moment.activities[2].status = 'in-progress';
  assert.ok(all(buildMomentPdfStory(moment)).some(x => x.id === 'cancel'));
});
