import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTRY_MODES, addUnifiedContentEntry, createStandaloneActivity, orderedUnifiedContent } from './activityEntries.js';
import { buildMomentStory, groupMomentStoryTasks } from './momentStory.js';

const day = '2026-11-01';
const base = {
  id: 'activity-1', eventId: 'moment-1', date: day, description: '<p>Old writing</p>',
  title: 'Nice Day', mergedActivityIds: ['old-id'],
  expenses: [{ id: 'cost-1', activityId: 'old-id', amount: 120 }],
  entries: [
    { id: 'timed', date: day, time: '10:00', description: '<p>Ten</p>' },
    { id: 'untimed', date: day, description: '<p>No saved time</p>', title: 'Old memory' },
    { id: 'next-day', date: '2026-11-02', time: '09:30', description: '<p>Tomorrow</p>' },
    { id: 'early', date: day, time: '08:00', description: '<p>Eight</p>' },
  ],
};
const options = { makeId: () => 'new-row', now: '2026-11-01T11:00:00Z' };

test('unified reader preserves legacy root and stable original entries, with untimed first', () => {
  const frozen = JSON.stringify(base);
  const rows = orderedUnifiedContent(base);
  assert.deepEqual(rows.map((row) => row.id), ['root:activity-1', 'untimed', 'early', 'timed', 'next-day']);
  assert.equal(rows[0].description, '<p>Old writing</p>');
  assert.equal(rows[1].title, 'Old memory');
  assert.equal(rows[4].date, '2026-11-02');
  assert.equal(JSON.stringify(base), frozen, 'reading never mutates stored records');
});

test('adding a dated entry preserves Activity identity, financial aliases and every prior entry', () => {
  const frozen = JSON.stringify(base);
  const patch = addUnifiedContentEntry(base,
    { description: '<p>Eleven</p>', date: day, time: '11:00' }, options);
  assert.equal(patch.entries.length, 5);
  assert.deepEqual(patch.entries.slice(0, 4), base.entries);
  assert.equal(patch.entries[4].id, 'new-row');
  assert.equal(patch.entries[4].time, '11:00');
  assert.equal(JSON.stringify(base), frozen);
  const saved = { ...base, ...patch };
  assert.deepEqual(saved.mergedActivityIds, ['old-id']);
  assert.equal(saved.expenses[0].amount, 120);
  assert.equal(orderedUnifiedContent(saved).at(-2).id, 'new-row');
});

test('entry time is optional; unknown time remains unknown and does not use createdAt as clock', () => {
  const saved = { ...base, ...addUnifiedContentEntry(base, {
    description: 'Without clock', date: '2026-11-03', time: '',
  }, options) };
  const last = orderedUnifiedContent(saved).at(-1);
  assert.equal(last.time, '');
  assert.equal(last.date, '2026-11-03');
  assert.equal(saved.entries.at(-1).createdAt, options.now);
});

test('invalid content and duplicate IDs are rejected without changing originals', () => {
  assert.throws(() => addUnifiedContentEntry(base, { description: '', date: day }, options), /Write something/);
  assert.throws(() => addUnifiedContentEntry(base, { description: 'Hello', date: '2026-02-30' }, options), /valid entry date/);
  assert.throws(() => addUnifiedContentEntry(base, { description: 'Hello', date: day },
    { makeId: () => 'timed' }), /unique entry ID/);
});

test('Diary, Journal and Tasks all create independent Activities without merging same-day records', () => {
  for (const mode of Object.values(ENTRY_MODES)) {
    const moment = { id: 'moment-1', activities: [base] };
    const result = createStandaloneActivity(moment, {
      title: 'Another record', description: 'Original entry', date: day,
      time: '14:00', priority: 'high', mode,
    }, { makeId: () => 'new-activity', now: options.now });
    assert.equal(result.activities.length, 2);
    assert.equal(result.activities[0], base);
    assert.equal(result.activities[1].id, 'new-activity');
    assert.equal(result.activities[1].entryMode, mode);
    assert.equal(result.activities[1].description, 'Original entry');
    assert.deepEqual(result.activities[1].entries, []);
    assert.equal(moment.activities.length, 1);
  }
});

test('Story keeps Diary original writing and all dated rows, while Tasks and Journal keep one parent Activity', () => {
  const activity = { ...base, entryMode: ENTRY_MODES.DAILY };
  const moment = (type) => ({ id: 'moment-1', type, date: day, activities: [activity], attachments: [] });
  const diary = buildMomentStory(moment('Diary'), { now: new Date('2026-11-04T12:00:00') });
  const chapters = diary.timeline.flatMap((month) => month.days.flatMap((date) => date.entries));
  assert.deepEqual(chapters.map((entry) => entry.id),
    ['activity-1', 'untimed', 'early', 'timed', 'next-day']);
  assert.equal(chapters[0].description, base.description);
  for (const type of ['Journal', 'Project']) {
    const story = buildMomentStory(moment(type), { now: new Date('2026-11-04T12:00:00') });
    const projected = story.timeline.flatMap((month) => month.days.flatMap((date) => date.entries));
    assert.equal(projected.length, 1, type + ' retains the top-level Activity count');
    assert.equal(projected[0].subEntries.length, 4);
    assert.equal(projected[0].description, base.description);
    if (type === 'Project') {
      assert.equal(groupMomentStoryTasks(story).flatMap((group) => group.entries).length, 1);
    }
  }
});
