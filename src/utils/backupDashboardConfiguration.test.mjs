import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dashboardConfigurationRestorePatch, validateBackupDashboardConfiguration,
} from './backupDashboardConfiguration.js';

const validMoments = new Set(['moment-one', 'moment-two', '42']);

test('an older backup with no Dashboard fields leaves existing shortcuts untouched', () => {
  assert.deepEqual(validateBackupDashboardConfiguration({}), {});
  assert.deepEqual(dashboardConfigurationRestorePatch({}, validMoments), {});
  assert.deepEqual(dashboardConfigurationRestorePatch({ recent: ['moment-one'] }, validMoments), {
    recent: ['moment-one'],
  });
});

test('an explicit empty Dashboard shortcut list clears only that list', () => {
  assert.deepEqual(dashboardConfigurationRestorePatch({ favorites: [] }, validMoments), { favorites: [] });
  assert.deepEqual(dashboardConfigurationRestorePatch({ recent: [] }, validMoments), { recent: [] });
  assert.deepEqual(dashboardConfigurationRestorePatch({ favorites: [], recent: [] }, validMoments), {
    favorites: [], recent: [],
  });
});

test('shortcuts restore only existing Moment IDs, once per ID, with recent capped at eight', () => {
  assert.deepEqual(dashboardConfigurationRestorePatch({ favorites: ['42'], recent: [42] },
    new Set(['moment-one', 42])), { favorites: ['42'], recent: ['42'] });
  const patch = dashboardConfigurationRestorePatch({
    favorites: ['moment-one', 'not-imported', 'moment-one', 42, 'moment-two'],
    recent: ['moment-one', 'moment-one', 'not-imported', 'moment-two', 42],
  }, validMoments);
  assert.deepEqual(patch, { favorites: ['moment-one', '42', 'moment-two'], recent: ['moment-one', 'moment-two', '42'] });
  const many = new Set(Array.from({ length: 12 }, (_, i) => String(i)));
  assert.equal(dashboardConfigurationRestorePatch({
    recent: Array.from({ length: 12 }, (_, i) => String(i)),
  }, many).recent.length, 8);
});

test('malformed optional Dashboard settings are rejected instead of erasing stored shortcuts', () => {
  for (const invalid of [
    null, [], 'not-an-object',
    { favorites: null }, { recent: {} },
    { favorites: [null] }, { recent: [{}] },
    { favorites: [''] }, { recent: [Number.NaN] },
  ]) {
    assert.throws(() => validateBackupDashboardConfiguration(invalid), /dashboard/i);
    assert.throws(() => dashboardConfigurationRestorePatch(invalid, validMoments), /dashboard/i);
  }
  assert.deepEqual(dashboardConfigurationRestorePatch({ favorites: ['moment-one'], other: true }, validMoments), {
    favorites: ['moment-one'],
  });
});
