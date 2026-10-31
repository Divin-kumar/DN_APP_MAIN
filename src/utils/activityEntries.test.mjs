import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENTRY_MODES, getMomentEntryMode, createOrAppendActivity, mergeLegacyDiaryActivities,
  mergeJournalActivities, updateActivityEntry, removeActivityEntry, activityOwnsLinkedId,
} from './activityEntries.js';
import { buildMomentStory } from './momentStory.js';
import { projectMomentTransactions } from './momentTransactions.js';
import { createBackupDocument, buildEventGroupsFromBackup } from '../services/backupService.js';
import { DEFAULT_CODE_LISTS } from './codeLists.js';
import { reconcileExpenseActivities, requireLinkedActivity } from './transactionRelations.js';

let index = 0;
const makeId = () => 'test-' + ++index;
const date = '2026-10-31';
const make = (id, title, time = '09:00', day = date) => ({
  id, eventId: 'moment', title, date: day, time, description: '<p>' + title + '</p>',
  createdAt: '2026-10-31T09:00:00Z', priority: 'medium',
});
const fixed = { makeId, now: '2026-10-31T18:00:00Z' };
const storyEntries = (moment) => buildMomentStory(moment, { now: '2026-11-05' })
  .timeline.flatMap((month) => month.days.flatMap((day) => day.entries));

test('three mandatory type modes resolve both configured values and legacy names', () => {
  const meta = [
    { value: 'Personal', storyPresentation: 'journey' },
    { value: 'Daily notes', storyPresentation: 'diary' },
    { value: 'Build project', storyPresentation: 'chronicle' },
  ];
  assert.equal(getMomentEntryMode({ type: 'Daily notes' }, meta), ENTRY_MODES.DAILY);
  assert.equal(getMomentEntryMode({ type: 'Personal' }, meta), ENTRY_MODES.JOURNAL);
  assert.equal(getMomentEntryMode({ type: 'Build project' }, meta), ENTRY_MODES.TASKS);
  assert.equal(getMomentEntryMode({ type: 'Diary' }, []), ENTRY_MODES.DAILY);
});

test('Diary consolidates same-day legacy records with stable ID and owner-specific originals', () => {
  const input = {
    id: 'moment', type: 'Diary', activities: [
      { ...make('early', 'Morning', '07:30'), expenses: [{ id: 'legacy-cost', amount: 30, eventId: 'moment', activityId: 'early' }] },
      make('late', 'Evening', '20:30'),
      make('tomorrow', 'Next day', '10:00', '2026-11-01'),
    ],
    attachments: [{ id: 'portrait', activityId: 'late', assetId: 'original-ref', type: 'image/jpeg' }],
  };
  const previous = JSON.stringify(input);
  const merged = mergeLegacyDiaryActivities(input);
  assert.equal(JSON.stringify(input), previous, 'migration is pure');
  assert.equal(merged.activities.length, 2);
  assert.equal(merged.activities[0].id, 'early');
  assert.deepEqual(merged.activities[0].entries.map((item) => item.title), ['Morning', 'Evening']);
  assert.deepEqual(merged.activities[0].mergedActivityIds, ['late']);
  assert.equal(merged.activities[0].expenses[0].id, 'legacy-cost');
  assert.equal(merged.attachments[0].assetId, 'original-ref');
  assert.equal(merged.attachments[0].activityId, 'early');
  assert.equal(merged.attachments[0].entryId, 'late');
  assert.equal(activityOwnsLinkedId(merged.activities[0], 'late'), true);
  assert.equal(mergeLegacyDiaryActivities(merged), merged, 'reopening does not remigrate');
  const chapters = storyEntries(merged);
  assert.deepEqual(chapters.map((item) => item.title), ['Morning', 'Evening', 'Next day']);
  assert.deepEqual(chapters[1].attachments.map((item) => item.id), ['portrait']);
  assert.equal(chapters[1].activityId, 'early');
});

test('Diary appends new same-day records but Tasks create independently', () => {
  const diary = mergeLegacyDiaryActivities({ id: 'moment', type: 'Diary', activities: [make('first', 'Morning')] });
  const appended = createOrAppendActivity(diary, { mode: ENTRY_MODES.DAILY, date, time: '12:30', title: 'Lunch' }, fixed).moment;
  assert.equal(appended.activities.length, 1);
  assert.equal(appended.activities[0].entries.length, 2);
  assert.deepEqual(storyEntries(appended).map((item) => item.title), ['Morning', 'Lunch']);
  const task = createOrAppendActivity({ id: 'moment', type: 'Project', activities: [make('first', 'Task 1')] },
    { mode: ENTRY_MODES.TASKS, date, title: 'Task 2' }, fixed).moment;
  assert.equal(task.activities.length, 2);
  assert.equal(task.activities[1].title, 'Task 2');
  assert.throws(() => createOrAppendActivity(task,
    { mode: ENTRY_MODES.TASKS, date, title: 'Invalid', targetId: 'first' }, fixed));
});

test('Journal retains separate Activities until user selects Append or Merge', () => {
  const original = { id: 'moment', type: 'Journal', activities: [
    make('memory-one', 'Travel', '09:15'),
    make('memory-two', 'Dinner', '21:00'),
  ], attachments: [{ id: 'original', activityId: 'memory-two', assetId: 'photo-ref' }] };
  const newRecord = createOrAppendActivity(original, { mode: ENTRY_MODES.JOURNAL, date, title: 'New memory' }, fixed).moment;
  assert.equal(newRecord.activities.length, 3);
  const append = createOrAppendActivity(original,
    { mode: ENTRY_MODES.JOURNAL, date, time: '12:00', title: 'Note', targetId: 'memory-one' }, fixed).moment;
  assert.equal(append.activities.length, 2);
  assert.equal(append.activities[0].entries[0].title, 'Note');
  assert.deepEqual(storyEntries(append)[0].subEntries.map((item) => item.title), ['Note']);
  const merged = mergeJournalActivities(original, 'memory-one', 'memory-two');
  assert.equal(original.activities.length, 2, 'merge never modifies old source');
  assert.equal(merged.activities.length, 1);
  assert.equal(merged.activities[0].id, 'memory-one');
  assert.equal(merged.activities[0].entries[0].title, 'Dinner');
  assert.equal(merged.attachments[0].activityId, 'memory-one');
  assert.equal(merged.attachments[0].entryId, 'memory-two');
  assert.equal(activityOwnsLinkedId(merged.activities[0], 'memory-two'), true);
  assert.throws(() => mergeJournalActivities(original, 'memory-one', 'memory-one'));
});

test('alias transactions stay associated and per-entry edits cannot overwrite siblings', () => {
  const journal = mergeJournalActivities({ id: 'moment', type: 'Journal',
    activities: [make('main', 'Main'), make('linked', 'Linked')],
    attachments: [],
  }, 'main', 'linked');
  const projected = projectMomentTransactions([journal], [], [
    { id: 'txn', eventId: 'moment', activityId: 'linked', category: 'Food', amount: 120, date },
  ], 'moment');
  assert.equal(projected.length, 1);
  assert.equal(projected[0].activityId, 'main', 'finance view resolves canonical Activity');
  assert.equal(projected[0].originalActivityId, 'linked', 'original ledger ID survives');
  const activity = journal.activities[0];
  const changed = updateActivityEntry(activity, 'linked', { title: 'New text' });
  assert.equal(changed.entries[0].title, 'New text');
  assert.equal(activity.entries[0].title, 'Linked');
  assert.equal(removeActivityEntry(activity, 'linked').entries.length, 0);
});

test('backup restore and transaction updates retain merged Activity aliases', () => {
  const merged = mergeJournalActivities({ id: 'moment', type: 'Journal',
    activities: [make('main', 'Parent'), make('old', 'Before merge')],
    attachments: [],
  }, 'main', 'old');
  const expense = { id: 'expense', eventId: 'moment', activityId: 'old', amount: 75, category: 'Food', date };
  const backup = createBackupDocument({
    moments: [merged], expenses: [expense], codeLists: DEFAULT_CODE_LISTS,
  });
  const [restored] = buildEventGroupsFromBackup(backup);
  assert.equal(restored.activities.length, 1);
  assert.equal(restored.activities[0].expenses.length, 1);
  assert.equal(restored.activities[0].expenses[0].id, 'expense');
  assert.equal(restored.activities[0].expenses[0].activityId, 'old', 'historical ledger ID remains');
  assert.doesNotThrow(() => requireLinkedActivity([restored], expense));
  const updated = reconcileExpenseActivities([restored], null, { ...expense, amount: 90, transactionKind: 'expense' });
  assert.equal(updated.length, 1);
  assert.equal(updated[0].activities[0].expenses[0].amount, 90);
});
