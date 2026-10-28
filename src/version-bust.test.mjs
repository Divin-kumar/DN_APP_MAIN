import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

import config from '../vite.config.js';

test('build injects an app version for cache busting', () => {
  assert.ok(config?.define, 'Vite config should define a build version');
  const versionValue = config.define['import.meta.env.VITE_APP_VERSION'];
  assert.match(versionValue, /^".+"$/, 'build version should be serialized as a string');
  assert.match(config.define['import.meta.env.VITE_DEPLOYED_AT'], /^".+"$/, 'deployment timestamp should be serialized');
  assert.match(config.define['import.meta.env.VITE_DEPLOY_ENV'], /^".+"$/, 'deployment environment should be serialized');
  const app = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(JSON.parse(versionValue), app.version);
  assert.equal(lock.version, app.version);
  assert.equal(lock.packages[''].version, app.version);
});

test('Vercel review, local and explicitly labelled Firebase builds remain distinct', () => {
  const cases = [
    [{ NODE_ENV:'production' }, 'Local build'],
    [{ NODE_ENV:'development' }, 'Test'],
    [{ NODE_ENV:'production', VERCEL:'1' }, 'Vercel review'],
    [{ NODE_ENV:'production', VERCEL_ENV:'production' }, 'Vercel review'],
    [{ NODE_ENV:'production', VITE_DEPLOY_ENV:'Firebase preview' }, 'Firebase preview'],
    [{ NODE_ENV:'production', VITE_DEPLOY_ENV:'Production' }, 'Production'],
    [{ NODE_ENV:'production', VERCEL:'1', VITE_DEPLOY_ENV:'Production' }, 'Vercel review'],
  ];
  for (const [values, expected] of cases) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e',
      "const config=(await import('./vite.config.js')).default; process.stdout.write(config.define['import.meta.env.VITE_DEPLOY_ENV']);"], {
      cwd:new URL('../', import.meta.url), encoding:'utf8',
      env:{ ...process.env, VITE_DEPLOY_ENV:'', VERCEL:'', VERCEL_ENV:'', ...values },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout), expected);
  }
});
