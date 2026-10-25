import assert from 'node:assert/strict';
import test from 'node:test';
import { getMomentWorkspaceKey, getMomentWorkspaceSection, getRouteTransitionKey, isSameMomentWorkspace, primaryNavigationPath } from './momentWorkspaceRoutes.js';

test('Moment section links share a stable transition key, including direct aliases and trailing slashes', () => {
  for (const suffix of ['', '/overview', '/activities', '/transactions', '/timeline', '/memories', '/attachments', '/pdf', '/memories/']) {
    assert.equal(getRouteTransitionKey(`/events/moment-1${suffix}`), '/events/moment-1');
    assert.equal(isSameMomentWorkspace('/events/moment-1/activities', `/events/moment-1${suffix}`), true);
  }
});

test('Activity Detail highlights Activities; every other Moment workspace route highlights Moments', () => {
  for (const route of ['/events/moment/activities/child', '/events/moment/activities/child/', '/activities']) assert.equal(primaryNavigationPath(route), '/activities');
  for (const route of ['/events', '/events/moment', '/events/moment/activities', '/events/moment/transactions', '/events/moment/memories']) assert.equal(primaryNavigationPath(route), '/events');
  assert.equal(getMomentWorkspaceSection('/events/moment/transactions'), 'transactions');
  assert.equal(primaryNavigationPath('/dashboard'), '/dashboard');
  assert.equal(primaryNavigationPath('/'), '/dashboard');
  assert.equal(primaryNavigationPath('/financials/transactions'), null);
});

test('different Moments and app pages remain distinct navigation contexts', () => {
  assert.equal(isSameMomentWorkspace('/events/moment-1/activities', '/events/moment-2/activities'), false);
  assert.equal(isSameMomentWorkspace('/events', '/events'), false);
  for (const path of ['/events', '/dashboard', '/financials/transactions', '/settings', '/events/moment-1/unknown', '/events/moment-1/activities/extra']) {
    assert.equal(getMomentWorkspaceKey(path), null);
    assert.equal(getRouteTransitionKey(path), path);
  }
});

test('encoded Moment IDs normalize consistently without treating encoded slashes as route separators', () => {
  assert.equal(getMomentWorkspaceKey('/events/%61/activities'), '/events/a');
  assert.equal(isSameMomentWorkspace('/events/%61/activities', '/events/a/memories'), true);
  assert.equal(getMomentWorkspaceKey('/events/family%2Ftrip/memories'), '/events/family%2Ftrip');
  assert.equal(getMomentWorkspaceKey('/events/invalid%/memories'), '/events/invalid%');
});

test('section selection handles overview aliases and trailing slash deep links', () => {
  assert.equal(getMomentWorkspaceSection('/events/moment-1'), 'overview');
  assert.equal(getMomentWorkspaceSection('/events/moment-1/overview'), 'overview');
  assert.equal(getMomentWorkspaceSection('/events/moment-1/attachments/'), 'attachments');
  assert.equal(getMomentWorkspaceSection('/events/moment-1/timeline'), 'overview');
});
