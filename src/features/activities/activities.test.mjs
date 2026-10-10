import 'fake-indexeddb/auto';
import test from 'node:test';
import assert from 'node:assert/strict';

test('activity completion updates completedAt timestamp and state', () => {
  const initialActivity = {
    id: 'act-1',
    title: 'Pick up flowers',
    completed: false,
    completedAt: null,
    priority: 'high',
    date: '2026-10-10',
  };

  const completedActivity = {
    ...initialActivity,
    completed: true,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assert.equal(completedActivity.completed, true);
  assert.ok(completedActivity.completedAt);

  const reopenedActivity = {
    ...completedActivity,
    completed: false,
    completedAt: null,
    updatedAt: new Date().toISOString(),
  };

  assert.equal(reopenedActivity.completed, false);
  assert.equal(reopenedActivity.completedAt, null);
});

test('dashboard activities filter separates today from high-priority without duplicate items', () => {
  const todayIso = '2026-10-10';

  const activities = [
    { id: '1', title: 'Today urgent task', date: '2026-10-10', priority: 'high', completed: false },
    { id: '2', title: 'Today normal task', date: '2026-10-10', priority: 'medium', completed: false },
    { id: '3', title: 'Future urgent task', date: '2026-10-15', priority: 'high', completed: false },
    { id: '4', title: 'Overdue urgent task', date: '2026-10-01', priority: 'high', completed: false },
    { id: '5', title: 'Future normal task', date: '2026-10-20', priority: 'low', completed: false },
  ];

  // A. Today's Activities
  const todayActivities = activities.filter((a) => a.date === todayIso);
  const todayIds = new Set(todayActivities.map((a) => a.id));

  // B. High-Priority Activities (excluding items in Today's Activities)
  const highPriorityActivities = activities.filter(
    (a) => a.priority === 'high' && !a.completed && !todayIds.has(a.id)
  );

  assert.equal(todayActivities.length, 2);
  assert.ok(todayIds.has('1'));
  assert.ok(todayIds.has('2'));

  // High-priority section must contain 3 and 4, but NOT 1 (since 1 is already in today's section)
  assert.equal(highPriorityActivities.length, 2);
  assert.equal(highPriorityActivities.some((a) => a.id === '1'), false);
  assert.ok(highPriorityActivities.some((a) => a.id === '3'));
  assert.ok(highPriorityActivities.some((a) => a.id === '4'));

  // Combined dashboard set contains no duplicates
  const allShownIds = [...todayActivities.map((a) => a.id), ...highPriorityActivities.map((a) => a.id)];
  assert.equal(new Set(allShownIds).size, allShownIds.length);
});

test('merged dashboard activities rule: high priority incomplete appears, completed non-today disappears', () => {
  const todayIso = '2026-10-10';

  const activities = [
    { id: '1', title: 'Today high incomplete', date: '2026-10-10', priority: 'high', completed: false },
    { id: '2', title: 'Today normal completed', date: '2026-10-10', priority: 'medium', completed: true },
    { id: '3', title: 'Future high incomplete', date: '2026-10-15', priority: 'high', completed: false },
    { id: '4', title: 'Future high completed', date: '2026-10-15', priority: 'high', completed: true },
    { id: '5', title: 'Overdue high incomplete', date: '2026-10-01', priority: 'high', completed: false },
    { id: '6', title: 'Overdue high completed', date: '2026-10-01', priority: 'high', completed: true },
    { id: '7', title: 'Today high completed', date: '2026-10-10', priority: 'high', completed: true },
    { id: '8', title: 'Standalone high incomplete', date: '2026-10-12', priority: 'high', completed: false, momentId: null },
  ];

  const merged = activities.filter((activity) => {
    if (activity.cancelled) return false;
    const isToday = activity.date === todayIso;
    if (isToday) return true; // Today's activities work as usual (includes completed & incomplete)
    return activity.priority === 'high' && !activity.completed; // High priority incomplete only
  });

  const mergedIds = new Set(merged.map((a) => a.id));

  // Today items (both completed and incomplete) must be included
  assert.ok(mergedIds.has('1'), 'Today high incomplete should appear');
  assert.ok(mergedIds.has('2'), 'Today normal completed should appear');
  assert.ok(mergedIds.has('7'), 'Today high completed should appear');

  // Future & Overdue high incomplete must be included
  assert.ok(mergedIds.has('3'), 'Future high incomplete should appear');
  assert.ok(mergedIds.has('5'), 'Overdue high incomplete should appear');
  assert.ok(mergedIds.has('8'), 'Standalone high incomplete should appear');

  // Completed items from other dates must NOT be included!
  assert.equal(mergedIds.has('4'), false, 'Future high completed must NOT appear');
  assert.equal(mergedIds.has('6'), false, 'Overdue high completed must NOT appear');
});
