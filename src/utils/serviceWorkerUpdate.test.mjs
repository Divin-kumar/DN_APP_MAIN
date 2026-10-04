import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldPromptForServiceWorkerUpdate } from './serviceWorkerUpdate.js';

test('do not ask to refresh when the active worker already matches About version', () => {
  assert.equal(shouldPromptForServiceWorkerUpdate({
    hasController: true,
    activeVersion: '1.0.6',
    waitingVersion: '1.0.6',
    currentVersion: '1.0.6',
  }), false);
});

test('ask to refresh only when the current release is waiting behind an older active worker', () => {
  assert.equal(shouldPromptForServiceWorkerUpdate({
    hasController: true,
    activeVersion: '1.0.5',
    waitingVersion: '1.0.6',
    currentVersion: '1.0.6',
  }), true);
});

test('do not prompt before the app has an active controller or for another waiting build', () => {
  assert.equal(shouldPromptForServiceWorkerUpdate({
    hasController: false,
    activeVersion: null,
    waitingVersion: '1.0.6',
    currentVersion: '1.0.6',
  }), false);
  assert.equal(shouldPromptForServiceWorkerUpdate({
    hasController: true,
    activeVersion: '1.0.5',
    waitingVersion: '1.0.7',
    currentVersion: '1.0.6',
  }), false);
});