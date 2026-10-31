import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { formatMomentDate, getCalendarDaysRemaining, getEventDate, getNextBirthdayAge, getNextOccurrenceDate, parseMomentDate } from './momentDates.js';
import { getUpcomingDashboardEvents } from './dashboardVisibility.js';

test('next birthday age includes today, advances only after the birthday and respects the original start', () => {
  assert.equal(getNextBirthdayAge('2000-10-28', new Date(2026, 9, 27)), 26);
  assert.equal(getNextBirthdayAge('2000-10-28', new Date(2026, 9, 28)), 26);
  assert.equal(getNextBirthdayAge('2000-10-28', new Date(2026, 9, 29)), 27);
  assert.equal(getNextBirthdayAge('2027-10-28', new Date(2026, 9, 28)), 0);
  assert.equal(getNextBirthdayAge('2000-02-29', new Date(2026, 1, 28)), 26);
  assert.equal(getNextBirthdayAge('invalid'), null);
});

test('date-only Moments retain their local calendar day in negative UTC time zones', () => {
  const moduleUrl = new URL('./momentDates.js', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { getEventDate } from ${JSON.stringify(moduleUrl)};
    const date = getEventDate({date:'2026-10-22'});
    console.log(date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours());
  `], { env: { ...process.env, TZ: 'America/Los_Angeles' }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '2026 10 22 0');
});

test('Moment date parsing accepts Firestore and serialized timestamps and legacy startDate', () => {
  const local = new Date(2026, 10, 1, 12);
  assert.equal(formatMomentDate(getEventDate({ date: { toDate: () => local } })), '2026-11-01');
  assert.equal(formatMomentDate(getEventDate({ date: { seconds: local.getTime() / 1000 } })), '2026-11-01');
  assert.equal(formatMomentDate(getEventDate({ date: { _seconds: local.getTime() / 1000 } })), '2026-11-01');
  assert.equal(formatMomentDate(getEventDate({ startDate: '2026-11-02' })), '2026-11-02');
  assert.equal(parseMomentDate('2026-02-30'), null);
  assert.equal(getEventDate({ date: 'invalid' }), null);
});

test('upcoming includes today and day 30, excludes past and day 31, and sorts chronologically', () => {
  const events = [
    { id: 'last', date: '2026-11-21' },
    { id: 'past', date: '2026-10-21' },
    { id: 'next', startDate: '2026-11-01' },
    { id: 'today', date: '2026-10-22' },
    { id: 'outside', date: '2026-11-22' },
    { id: 'invalid', date: 'invalid' },
  ];
  const upcoming = getUpcomingDashboardEvents(events, new Date(2026, 9, 22, 15));
  assert.deepEqual(upcoming.map((event) => event.id), ['today', 'next', 'last']);
});

test('upcoming projects old monthly/yearly and legacy recurring Moments into the 30-day window', () => {
  const events = [
    { id: 'birthday', date: '1990-11-02', recurrence: 'yearly' },
    { id: 'monthly', date: '2020-01-25', recurrence: 'monthly' },
    { id: 'legacy', date: '2000-11-01', isRecurring: true },
    { id: 'next-year', date: '2000-10-01', recurrence: 'yearly' },
    { id: 'not-started', date: '2027-11-01', recurrence: 'yearly' },
  ];
  const upcoming = getUpcomingDashboardEvents(events, new Date(2026, 9, 22));
  assert.deepEqual(upcoming.map((event) => event.id), ['monthly', 'legacy', 'birthday']);
  assert.equal(formatMomentDate(getNextOccurrenceDate(events[0], new Date(2026, 11, 31))), '2027-11-02');
});

test('upcoming visibility changes with the saved type switch while retaining active and date boundaries', () => {
  const events = [
    { id: 'school', type: 'School', date: '2026-11-01' },
    { id: 'custom', type: 'Other', customType: 'Family', date: '2026-11-02' },
    { id: 'archived', type: 'School', date: '2026-11-01', archived: true },
    { id: 'cancelled', type: 'School', date: '2026-11-01', status: 'cancelled' },
    { id: 'too-far', type: 'School', date: '2026-11-22' },
  ];
  const today = new Date(2026, 9, 22);
  const hidden = [{ value: 'School', showInDashboardUpcoming: false }];
  const shown = [{ value: 'School', showInDashboardUpcoming: true }];
  assert.deepEqual(getUpcomingDashboardEvents(events, today, hidden).map((event) => event.id), ['custom']);
  assert.deepEqual(getUpcomingDashboardEvents(events, today, shown).map((event) => event.id), ['school', 'custom']);
});

test('calendar-day distance is stable across daylight saving changes', () => {
  const moduleUrl = new URL('./momentDates.js', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { getCalendarDaysRemaining, formatMomentDate } from ${JSON.stringify(moduleUrl)};
    import { getUpcomingDashboardEvents } from ${JSON.stringify(new URL('./dashboardVisibility.js', import.meta.url).href)};
    const today = new Date(2026, 9, 22);
    console.log(getCalendarDaysRemaining(new Date(2026, 10, 21), today));
    console.log(getUpcomingDashboardEvents([{date:'2026-11-22'}], today).length);
  `], { env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '30\n0');
  assert.equal(getCalendarDaysRemaining(new Date(2026, 9, 23), new Date(2026, 9, 22)), 1);
});

test('monthly Moments on the 29th, 30th and 31st use each shorter month’s last day', () => {
  const monthly = (day, reference) => formatMomentDate(getNextOccurrenceDate({
    date: `2020-01-${day}`, recurrence: 'monthly',
  }, new Date(...reference)));
  assert.equal(monthly('31', [2026, 1, 1]), '2026-02-28');
  assert.equal(monthly('31', [2026, 1, 28]), '2026-02-28');
  assert.equal(monthly('31', [2026, 2, 1]), '2026-03-31');
  assert.equal(monthly('31', [2026, 3, 1]), '2026-04-30');
  assert.equal(monthly('30', [2026, 1, 1]), '2026-02-28');
  assert.equal(monthly('29', [2028, 1, 1]), '2028-02-29');
  assert.equal(monthly('31', [2028, 1, 1]), '2028-02-29');
  assert.equal(monthly('31', [2026, 11, 31]), '2026-12-31');
  assert.equal(monthly('31', [2027, 0, 1]), '2027-01-31');
});

test('yearly leap-day anniversaries use February 28 in non-leap years and February 29 in leap years', () => {
  const event = { date: '2000-02-29', recurrence: 'yearly' };
  const next = (year, month, day) => formatMomentDate(getNextOccurrenceDate(event, new Date(year, month, day)));
  assert.equal(next(2026, 1, 27), '2026-02-28');
  assert.equal(next(2026, 1, 28), '2026-02-28');
  assert.equal(next(2026, 2, 1), '2027-02-28');
  assert.equal(next(2028, 1, 28), '2028-02-29');
  assert.equal(next(2028, 1, 29), '2028-02-29');
  assert.equal(getNextBirthdayAge('2000-02-29', new Date(2026, 1, 28)), 26);
  assert.equal(getNextBirthdayAge('2000-02-29', new Date(2026, 2, 1)), 27);
});

test('recurrence dates honor their original start and never shift saved dates or moment time', () => {
  const future = { date: '2027-01-31', recurrence: 'monthly' };
  assert.equal(formatMomentDate(getNextOccurrenceDate(future, new Date(2026, 1, 1))), '2027-01-31');
  const original = { date: '2020-01-31', recurrence: 'monthly', time: '09:45', name: 'Family tradition' };
  assert.equal(formatMomentDate(getNextOccurrenceDate(original, new Date(2026, 1, 1))), '2026-02-28');
  assert.deepEqual(original, { date: '2020-01-31', recurrence: 'monthly', time: '09:45', name: 'Family tradition' });
  assert.equal(formatMomentDate(getNextOccurrenceDate({ date: '2026-01-31', recurrence: 'none' }, new Date(2026, 1, 1))), '2026-01-31');
});

test('Dashboard respects calendar-safe recurring February dates and the inclusive 30-day window', () => {
  const events = [
    { id: 'monthly-31', date: '2020-01-31', recurrence: 'monthly' },
    { id: 'annual-leap', date: '2000-02-29', recurrence: 'yearly' },
    { id: 'future', date: '2028-01-31', recurrence: 'monthly' },
  ];
  const upcoming = getUpcomingDashboardEvents(events, new Date(2026, 1, 1));
  assert.deepEqual(upcoming.map((item) => item.id), ['monthly-31', 'annual-leap']);
  assert.equal(getUpcomingDashboardEvents(events, new Date(2026, 2, 1)).some((item) => item.id === 'annual-leap'), false);
});

test('short-month recurrence stays on local calendar dates in negative UTC zones', () => {
  const moduleUrl = new URL('./momentDates.js', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { getNextOccurrenceDate, formatMomentDate } from ${JSON.stringify(moduleUrl)};
    const monthly = getNextOccurrenceDate({ date: '2020-01-31', recurrence: 'monthly' }, new Date(2026, 1, 1));
    const yearly = getNextOccurrenceDate({ date: '2000-02-29', recurrence: 'yearly' }, new Date(2026, 1, 1));
    console.log(formatMomentDate(monthly), formatMomentDate(yearly));
  `], { env: { ...process.env, TZ: 'America/Los_Angeles' }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '2026-02-28 2026-02-28');
});
