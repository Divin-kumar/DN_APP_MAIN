import test from 'node:test';
import assert from 'node:assert/strict';

import { readServiceWorkerVersion, shouldPromptForServiceWorkerUpdate } from './serviceWorkerUpdate.js';

test('updated worker bytes override an older registration URL and suppress a duplicate release prompt', async () => {
  const activeVersion = await readServiceWorkerVersion({
    scriptURL:'https://dn.example/sw.js?v=1.0.35',
    postMessage(message, [port]) { port.postMessage({ type:message.type, version:'2.0.0' }); },
  });
  assert.equal(activeVersion, '2.0.0');
  assert.equal(shouldPromptForServiceWorkerUpdate({ hasController:true, activeVersion,
    waitingVersion:'2.0.0', currentVersion:'2.0.0' }), false);
});

test('legacy workers without the metadata response retain a bounded URL fallback and the real upgrade prompt', async () => {
  const activeVersion = await readServiceWorkerVersion({
    scriptURL:'https://dn.example/sw.js?v=1.0.35', postMessage() {},
  }, 10);
  assert.equal(activeVersion, '1.0.35');
  assert.equal(shouldPromptForServiceWorkerUpdate({ hasController:true, activeVersion,
    waitingVersion:'2.0.0', currentVersion:'2.0.0' }), true);
});

test('unavailable worker metadata never blocks a refresh check', async () => {
  assert.equal(await readServiceWorkerVersion(null), null);
  assert.equal(await readServiceWorkerVersion({ scriptURL:'invalid', postMessage() { throw new Error('Unavailable'); } }), null);
});

test('postMessage failure falls back to the known legacy version', async () => {
  assert.equal(await readServiceWorkerVersion({ scriptURL:'https://dn.example/sw.js?v=1.0.35',
    postMessage() { throw new Error('Worker stopped'); } }), '1.0.35');
});

test('unrelated and malformed worker messages cannot supply a version', async () => {
  const value = await readServiceWorkerVersion({ scriptURL:'https://dn.example/sw.js?v=1.0.35',
    postMessage(_message, [port]) {
      port.postMessage({ type:'OTHER', version:'2.0.0' });
      port.postMessage({ type:'DN_BUILD_VERSION', version:7 });
    },
  }, 10);
  assert.equal(value, '1.0.35');
});

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
