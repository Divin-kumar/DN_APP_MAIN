import test from 'node:test';
import assert from 'node:assert/strict';

import { getDashboardVisibleActivityEvents, getDashboardVisibleEvents, getMomentTypeConfig, getMomentTypeGreetingTemplate } from './dashboardVisibility.js';

test('new moment types default to dashboard visibility and greeting generation enabled', () => {
  const birthday = getMomentTypeConfig('Birthday', [{ value: 'Birthday', label: 'Birthday' }]);
  assert.equal(birthday.canGenerateGreetingCards, true);
  assert.equal(birthday.showInDashboardUpcoming, true);
  assert.equal(birthday.showActivitiesOnDashboard, true);
  assert.equal(birthday.greetingTemplate, '');
});

test('Moment and Activity visibility are independent and preserve archived/cancelled exclusions', () => {
  const types = [
    { value: 'Moments only', showInDashboardUpcoming: true, showActivitiesOnDashboard: false },
    { value: 'Activities only', showInDashboardUpcoming: false, showActivitiesOnDashboard: true },
    { value: 'Legacy hidden moment', showInDashboard: false },
  ];
  const events = [{ id: 'moment', type: 'Moments only' }, { id: 'activity', type: 'Activities only' },
    { id: 'legacy', type: 'Legacy hidden moment' }, { id: 'unknown', type: 'Unknown type' },
    { id: 'archived', type: 'Activities only', archived: true }, { id: 'cancelled', type: 'Activities only', status: 'cancelled' }];
  assert.deepEqual(getDashboardVisibleEvents(events, types).map(({ id }) => id), ['moment', 'unknown']);
  assert.deepEqual(getDashboardVisibleActivityEvents(events, types).map(({ id }) => id), ['activity', 'legacy', 'unknown']);
});

test('Activity visibility resolves custom Other values and configured labels independently', () => {
  const events = [{ id: 'custom', type: 'Other', customType: 'fAmIlY' },
    { id: 'generic', type: 'Other', customType: 'Unconfigured' }, { id: 'label', type: 'FAMILY' }];
  const types = [{ value: 'Other', showInDashboardUpcoming: true, showActivitiesOnDashboard: false },
    { value: 'family-value', label: 'Family', showInDashboardUpcoming: false, showActivitiesOnDashboard: true }];
  assert.deepEqual(getDashboardVisibleEvents(events, types).map(({ id }) => id), ['generic']);
  assert.deepEqual(getDashboardVisibleActivityEvents(events, types).map(({ id }) => id), ['custom', 'label']);
});

test('config disables greeting cards and dashboard visibility when set on the moment type', () => {
  const config = getMomentTypeConfig('School', [{
    value: 'School',
    label: 'School',
    canGenerateGreetingCards: false,
    greetingTemplate: 'Good luck {name}',
    showInDashboardUpcoming: false,
  }]);

  assert.equal(config.canGenerateGreetingCards, false);
  assert.equal(config.showInDashboardUpcoming, false);
  assert.equal(config.greetingTemplate, 'Good luck {name}');
});

test('dashboard uses type visibility while continuing to exclude archived and cancelled Moments', () => {
  const events = [
    { id: '1', type: 'Birthday', date: '2026-11-01' },
    { id: '2', type: 'School', date: '2026-11-02' },
    { id: '3', type: 'School', date: '2026-11-02', archived: true },
    { id: '4', type: 'Birthday', date: '2026-11-02', status: 'cancelled' },
    { id: '5', type: 'Birthday', date: '2026-11-02', status: 'archived' },
  ];
  const visible = getDashboardVisibleEvents(events, [{ value: 'Birthday', label: 'Birthday', showInDashboardUpcoming: true }, { value: 'School', label: 'School', showInDashboardUpcoming: false }]);

  assert.deepEqual(visible.map((event) => event.id), ['1']);
});

test('historical missing type flags remain visible, including string and unknown types', () => {
  const events = [
    { id: 'string-type', type: 'Birthday' },
    { id: 'missing-flag', type: 'School' },
    { id: 'unknown-type', type: 'Retired value' },
    { id: 'no-type' },
  ];
  const types = ['Birthday', { value: 'School', label: 'School' }];
  assert.deepEqual(getDashboardVisibleEvents(events, types).map((event) => event.id), events.map((event) => event.id));
});

test('type visibility resolves configured labels case-insensitively and honors supported legacy flag alias', () => {
  const types = [{ value: 'school-id', label: 'School', showInDashboard: false }];
  assert.deepEqual(getDashboardVisibleEvents([{ type: 'SCHOOL' }], types), []);
  assert.deepEqual(getDashboardVisibleEvents([{ type: 'school-id' }], types), []);
});

test('Other uses a configured custom type visibility and otherwise falls back to generic Other', () => {
  const events = [
    { id: 'shown-custom', type: 'Other', customType: 'Family' },
    { id: 'hidden-custom', type: 'Other', customType: 'Diary' },
    { id: 'unconfigured-custom', type: 'Other', customType: 'A one-off label' },
    { id: 'generic-other', type: 'Other' },
  ];
  const types = [
    { value: 'Other', showInDashboardUpcoming: false },
    { value: 'family-value', label: 'Family', showInDashboardUpcoming: true },
    { value: 'Diary', showInDashboardUpcoming: false },
  ];
  assert.deepEqual(getDashboardVisibleEvents(events, types).map((event) => event.id), ['shown-custom']);
  assert.deepEqual(getDashboardVisibleEvents(events, []).map((event) => event.id), events.map((event) => event.id), 'unknown types retain historical default visibility');
});

test('greeting templates are only generated when the moment type allows greeting cards', () => {
  const birthdayTemplate = getMomentTypeGreetingTemplate('Birthday', [{ value: 'Birthday', label: 'Birthday', greetingTemplate: 'Happy {ordinal} Birthday {name}' }], 'Fallback');
  const hiddenTemplate = getMomentTypeGreetingTemplate('School', [{ value: 'School', label: 'School', canGenerateGreetingCards: false, greetingTemplate: 'Hidden' }], 'Fallback');

  assert.equal(birthdayTemplate, 'Happy {ordinal} Birthday {name}');
  assert.equal(hiddenTemplate, '');
});
