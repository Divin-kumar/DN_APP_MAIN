import assert from 'node:assert/strict';
import test from 'node:test';

import config from '../vite.config.js';

test('build injects an app version for cache busting', () => {
  assert.ok(config?.define, 'Vite config should define a build version');
  const versionValue = config.define['import.meta.env.VITE_APP_VERSION'];
  assert.match(versionValue, /^".+"$/, 'build version should be serialized as a string');
  assert.match(config.define['import.meta.env.VITE_DEPLOYED_AT'], /^".+"$/, 'deployment timestamp should be serialized');
  assert.match(config.define['import.meta.env.VITE_DEPLOY_ENV'], /^".+"$/, 'deployment environment should be serialized');
});
