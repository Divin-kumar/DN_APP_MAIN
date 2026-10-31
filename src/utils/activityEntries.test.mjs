import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENTRY_MODES, getMomentEntryMode, createOrAppendActivity, mergeLegacyDiaryActivities,
  mergeJournalActivities, linkJournalActivities, unlinkJournalActivities,
  updateActivityEntry, removeActivityEntry, activityOwnsLinkedId,
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
      { ...make('early', 'Morning', '07:30'), extra: { legacy: 'keep' },
        expenses: [{ id: 'legacy-cost', amount: 30, eventId: 'moment', activityId: 'early' }] },
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
  assert.equal(merged.activities[0].entries[0].legacyActivityFields.extra.legacy, 'keep');
  assert.equal(merged.activities[0].entries[1].legacyActivityFields.id, 'late');
  assert.equal(merged.activities[0].entries[0].legacyActivityFields.expenses, undefined);
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
  assert.deepEqual(storyEntries(append).map((item) => item.title), ['Travel', 'Dinner']);
  assert.equal(storyEntries(append)[0].subEntries[0].title, 'Note',
    'Journal append continues the original memory instead of another chapter');
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


test('Journal links preserve independent Activity IDs, photos and allow unlink', () => {
  const moment = { id: 'journal', type: 'Journal',
    activities: [make('a', 'First'), make('b', 'Second'), make('c', 'Third')],
    attachments: [{ id: 'photo', activityId: 'b', assetId: 'original' }] };
  const original = JSON.stringify(moment);
  const linked = linkJournalActivities(moment, 'a', 'b');
  assert.equal(JSON.stringify(moment), original);
  assert.deepEqual(linked.activities.map((a) => a.id), ['a', 'b', 'c']);
  assert.deepEqual(linked.activities[0].linkedJournalActivityIds, ['b']);
  assert.deepEqual(linked.attachments, moment.attachments);
  assert.equal(linkJournalActivities(linked, 'a', 'b'), linked);
  assert.throws(() => linkJournalActivities(linked, 'b', 'a'), /circle/);
  assert.throws(() => linkJournalActivities(linked, 'a', 'missing'), /different/);
  const unlinked = unlinkJournalActivities(linked, 'a', 'b');
  assert.deepEqual(unlinked.activities[0].linkedJournalActivityIds, []);
  assert.deepEqual(unlinked.attachments, moment.attachments);
  assert.throws(() => unlinkJournalActivities(unlinked, 'a', 'b'), /not linked/);
});

test('Appending linked Journal Activity retains old aliases and updates relationships', () => {
  const input = { id: 'journal', type: 'Journal', activities: [
    make('a', 'Main'), make('b', 'Related'), make('c', 'Other', '21:00')], attachments: [] };
  const linked = linkJournalActivities(linkJournalActivities(input, 'a', 'b'), 'c', 'b');
  const merged = mergeJournalActivities(linked, 'a', 'b');
  assert.equal(merged.activities.length, 2);
  assert.deepEqual(merged.activities[0].linkedJournalActivityIds, []);
  assert.deepEqual(merged.activities[1].linkedJournalActivityIds, ['a']);
  assert.deepEqual(storyEntries(merged).map((item) => item.title), ['Main', 'Other']);
  assert.equal(storyEntries(merged)[0].subEntries[0].title, 'Related');
  assert.equal(activityOwnsLinkedId(merged.activities[0], 'b'), true);
});
