import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMomentStory, resolveMomentStoryPresentation, STORY_PRESENTATIONS } from './momentStory.js';
import { getCodeListMeta, serializeCodeListEntries } from './codeLists.js';
import { getMomentTypeConfig } from './dashboardVisibility.js';

const on = '2026-10-28';
const build = (moment, overrides = {}) => buildMomentStory(moment, { now: on, ...overrides });
const chapters = (story) => story.timeline.flatMap((month) => month.days.flatMap((day) => day.entries));

test('empty or malformed Moment content produces a safe, non-mutating Story shell', () => {
  for (const moment of [{}, { activities: null, attachments: null, memories: null }, null]) {
    const story = build(moment);
    assert.deepEqual(story.timeline, []);
    assert.deepEqual(story.upcoming, []);
    assert.deepEqual(story.undated, []);
    assert.deepEqual(story.reflections, []);
    assert.deepEqual(story.keepsakes, []);
    assert.equal(story.presentation, STORY_PRESENTATIONS.JOURNEY);
  }
});

test('recorded Activity date determines month and day order, with stable equal-date order', () => {
  const moment = {
    id: 'journal', date: '2026-12-31', notes: '<p>My original rich-text introduction</p>',
    activities: [
      { id: 'late', date: '2026-10-03', title: 'Last' },
      { id: 'same-first', date: '2026-09-12' },
      { id: 'same-second', date: '2026-09-12' },
      { id: 'early', date: '2026-09-01' },
    ],
  };
  const before = JSON.stringify(moment);
  const story = build(moment);
  assert.deepEqual(story.timeline.map((month) => month.key), ['2026-09', '2026-10']);
  assert.deepEqual(story.timeline[0].days.map((day) => day.date), ['2026-09-01', '2026-09-12']);
  assert.deepEqual(chapters(story).map((item) => item.id), ['early', 'same-first', 'same-second', 'late']);
  assert.equal(story.momentDate, '2026-12-31', 'Moment date remains independent');
  assert.equal(story.introduction, '<p>My original rich-text introduction</p>');
  assert.equal(JSON.stringify(moment), before, 'Story construction must not write to saved records');
  assert.equal(chapters(story)[0].activity, moment.activities[3], 'read-only projection retains actual source records');
});

test('unfinished future Activities are separate; completed and cancelled entries retain their status', () => {
  const story = build({ activities: [
    { id: 'future-open', date: '2026-11-04', completed: false },
    { id: 'future-completed', date: '2026-11-05', completed: true },
    { id: 'future-cancelled', date: '2026-11-06', completed: true, cancelled: true },
    { id: 'today', date: on, status: 'in-progress' },
    { id: 'old-done', date: '2026-09-01', status: 'completed' },
  ] });
  assert.deepEqual(story.upcoming.map((item) => item.id), ['future-open']);
  assert.deepEqual(chapters(story).map((item) => item.id), ['old-done', 'today', 'future-completed', 'future-cancelled']);
  assert.deepEqual(chapters(story).map((item) => item.status), ['completed', 'in-progress', 'completed', 'cancelled']);
});

test('undated and invalid calendar Activities never borrow createdAt or Moment dates', () => {
  const story = build({
    date: '2026-02-01',
    activities: [
      { id: 'created-only', createdAt: '2025-01-01T08:00:00Z' },
      { id: 'bad-day', date: '2026-02-30', createdAt: '2026-02-03T12:00:00Z' },
      { id: 'missing', date: null },
      { id: 'recorded', date: '2026-02-02' },
    ],
  });
  assert.deepEqual(chapters(story).map((item) => item.id), ['recorded']);
  assert.deepEqual(story.undated.map((item) => item.id), ['created-only', 'bad-day', 'missing']);
  assert.equal(story.undated.every((item) => item.date === null), true);
});

test('numeric Activity IDs, multiple linked originals and orphan files preserve exact ownership', () => {
  const moment = {
    id: 7,
    activities: [{ id: 0, date: '2026-10-10' }, { id: 'second', date: '2026-10-11' }],
    attachments: [
      { id: 'moment-file', name: 'notes.pdf' },
      { id: 'first-photo', type: 'image/jpeg', activityId: 0, assetId: 'hash-reference' },
      { id: 'first-extra', activityId: '0', type: 'image/png' },
      { id: 'second-photo', activityId: 'second', type: 'image/jpeg' },
      { id: 'orphan', activityId: 'removed-activity', type: 'image/jpeg' },
    ],
  };
  const story = build(moment);
  assert.equal(story.momentId, '7');
  assert.deepEqual(chapters(story)[0].attachments.map((a) => a.id), ['first-photo', 'first-extra']);
  assert.deepEqual(chapters(story)[1].attachments.map((a) => a.id), ['second-photo']);
  assert.deepEqual(story.keepsakes.map((a) => a.id), ['moment-file', 'orphan']);
  assert.equal(chapters(story)[0].attachments[0], moment.attachments[1], 'original metadata is referenced, not duplicated');
});

test('legacy Memories are retained as undated reflections, never fabricated timeline chapters', () => {
  const memory = { id: 'old-memory', title: 'Remember this', body: '<p>Keep these words</p>', createdAt: '2026-05-12T13:40:00Z' };
  const story = build({ memories: [memory], activities: [] });
  assert.equal(story.timeline.length, 0);
  assert.deepEqual(story.reflections.map((item) => item.id), ['old-memory']);
  assert.equal(story.reflections[0].body, memory.body);
  assert.equal(story.reflections[0].createdAt, memory.createdAt);
  assert.equal(story.reflections[0].memory, memory);
  assert.equal(Object.hasOwn(story.reflections[0], 'date'), false);
});

test('legacy Firestore timestamp dates use existing calendar parser, without creation-date fallback', () => {
  const timestamp = { seconds: Date.UTC(2026, 8, 15, 12) / 1000, nanoseconds: 0 };
  const story = build({ activities: [
    { id: 'timestamp', date: timestamp },
    { id: 'created', createdAt: timestamp },
  ] });
  assert.deepEqual(chapters(story).map((a) => a.id), ['timestamp']);
  assert.deepEqual(story.undated.map((a) => a.id), ['created']);
});

test('default presentation adapts to known Moment Types without modifying Code Lists', () => {
  const cases = [
    ['Mini 💚', STORY_PRESENTATIONS.JOURNEY],
    ['Birthday', STORY_PRESENTATIONS.JOURNEY],
    ['Diary', STORY_PRESENTATIONS.DIARY],
    ['Career', STORY_PRESENTATIONS.CHRONICLE],
    ['IQVIA', STORY_PRESENTATIONS.CHRONICLE],
    ['Application and YouTube', STORY_PRESENTATIONS.CHRONICLE],
    ['Unknown kind', STORY_PRESENTATIONS.JOURNEY],
  ];
  for (const [type, expected] of cases) {
    assert.equal(resolveMomentStoryPresentation({ type }, []), expected, type);
  }
});

test('type metadata overrides defaults, including inactive and Other/custom types', () => {
  const configured = [
    { value: 'Diary', storyPresentation: 'chronicle', active: false, showActivitiesOnDashboard: false },
    { value: 'lab-id', label: 'Lab', storyPresentation: 'diary' },
    { value: 'Other', storyPresentation: 'chronicle' },
  ];
  assert.equal(resolveMomentStoryPresentation({ type: 'DIARY' }, configured), 'chronicle');
  assert.equal(resolveMomentStoryPresentation({ type: 'Other', customType: 'lAb' }, configured), 'diary');
  assert.equal(resolveMomentStoryPresentation({ type: 'Other', customType: 'Nonexistent' }, configured), 'chronicle');
  assert.equal(resolveMomentStoryPresentation({ type: 'Diary' }, [{ value: 'Diary', storyPresentation: 'invalid-style' }]), 'diary');
});

test('Story presentation metadata round-trips through existing Code Lists with Dashboard flags intact', () => {
  const original = {
    value: 'Diary', label: 'Diary', storyPresentation: 'chronicle',
    canGenerateGreetingCards: false, greetingTemplate: 'Do not lose me',
    showInDashboardUpcoming: false, showActivitiesOnDashboard: true, active: false,
  };
  const serialized = serializeCodeListEntries([original]);
  const reloaded = getCodeListMeta('eventTypes', JSON.parse(JSON.stringify(serialized)));
  assert.equal(reloaded[0].storyPresentation, 'chronicle');
  assert.equal(reloaded[0].greetingTemplate, 'Do not lose me');
  assert.equal(reloaded[0].active, false);
  assert.equal(resolveMomentStoryPresentation({ type: 'Diary' }, reloaded), 'chronicle');
  const flags = getMomentTypeConfig('Diary', reloaded);
  assert.equal(flags.showInDashboardUpcoming, false);
  assert.equal(flags.showActivitiesOnDashboard, true);
  assert.equal(flags.canGenerateGreetingCards, false);
});

test('Story construction does not create transactions, enrich files or make assumptions about originals', () => {
  const moment = {
    id: 'long-story',
    activities: [{ id: 'a', date: '2026-08-01', expenses: [{ id: 'expense-1', amount: 150 }] }],
    attachments: [{ id: 'photo-metadata', type: 'image/jpeg', activityId: 'a', assetId: 'a'.repeat(64) }],
  };
  const before = JSON.stringify(moment);
  const story = build(moment);
  assert.equal(chapters(story)[0].activity.expenses[0].amount, 150);
  assert.equal(chapters(story)[0].attachments[0].assetId, 'a'.repeat(64));
  assert.equal(Object.hasOwn(chapters(story)[0].attachments[0], 'originalAvailable'), false);
  assert.equal(JSON.stringify(moment), before);
});
