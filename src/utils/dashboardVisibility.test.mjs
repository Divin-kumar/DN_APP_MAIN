import test from 'node:test';
import assert from 'node:assert/strict';

import { getDashboardVisibleEvents, getMomentTypeConfig, getMomentTypeGreetingTemplate } from './dashboardVisibility.js';

test('new moment types default to dashboard visibility and greeting generation enabled', () => {
  const birthday = getMomentTypeConfig('Birthday', [{ value: 'Birthday', label: 'Birthday' }]);
  assert.equal(birthday.canGenerateGreetingCards, true);
  assert.equal(birthday.showInDashboardUpcoming, true);
  assert.equal(birthday.greetingTemplate, '');
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

test('dashboard visibility filters out moment types marked hidden from upcoming sections', () => {
  const events = [
    { id: '1', type: 'Birthday', date: '2026-11-01' },
    { id: '2', type: 'School', date: '2026-11-02' },
  ];
  const visible = getDashboardVisibleEvents(events, [{ value: 'Birthday', label: 'Birthday', showInDashboardUpcoming: true }, { value: 'School', label: 'School', showInDashboardUpcoming: false }]);

  assert.deepEqual(visible.map((event) => event.id), ['1']);
});

test('greeting templates are only generated when the moment type allows greeting cards', () => {
  const birthdayTemplate = getMomentTypeGreetingTemplate('Birthday', [{ value: 'Birthday', label: 'Birthday', greetingTemplate: 'Happy {ordinal} Birthday {name}' }], 'Fallback');
  const hiddenTemplate = getMomentTypeGreetingTemplate('School', [{ value: 'School', label: 'School', canGenerateGreetingCards: false, greetingTemplate: 'Hidden' }], 'Fallback');

  assert.equal(birthdayTemplate, 'Happy {ordinal} Birthday {name}');
  assert.equal(hiddenTemplate, '');
});
