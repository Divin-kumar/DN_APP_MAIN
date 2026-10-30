import test from 'node:test';
import assert from 'node:assert/strict';
import { compareReleaseVersions, getWorkerReleaseVersion, versionParts } from './release-version-guard.mjs';

test('semantic release versions compare all three numeric components', () => {
  assert.equal(compareReleaseVersions('2.1.0', '2.0.5'), 1);
  assert.equal(compareReleaseVersions('2.0.4', '2.0.5'), -1);
  assert.equal(compareReleaseVersions('2.0.5', '2.0.5'), 0);
  assert.equal(compareReleaseVersions('2.0.10', '2.0.9'), 1);
  assert.deepEqual(versionParts('2.0.3'), [2, 0, 3]);
});

test('bad release labels fail closed', () => {
  for (const invalid of ['2.1', '2.1.0-beta', 'dev', '', '2.0.5.1']) {
    assert.throws(() => versionParts(invalid), /Invalid release version/);
  }
});

test('reads the version from a Vite-generated service worker', () => {
  const worker = 'self.addEventListener("message", (event) => { if (event.data?.type === "DN_BUILD_VERSION") event.ports?.[0]?.postMessage({ type: "DN_BUILD_VERSION", version: "2.0.5" }); });';
  assert.equal(getWorkerReleaseVersion(worker), '2.0.5');
  assert.throws(() => getWorkerReleaseVersion('no version in this worker'), /no recognizable/);
});
