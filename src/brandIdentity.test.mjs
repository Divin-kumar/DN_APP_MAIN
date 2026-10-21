import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

// The retired brand is intentionally assembled rather than repeated in current app text.
// Its exact prefix still exists in a dedicated compatibility module to protect older data.
const retiredBrand = new RegExp(['life', 'hub'].join('[\\s_-]*'), 'i');

const walk = (dir, result = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
      walk(join(dir, entry.name), result);
    } else if (entry.isFile()) {
      result.push(relative(root, join(dir, entry.name)).replaceAll('\\\\', '/'));
    }
  }
  return result;
};

test('DN is the only official brand in the app metadata and visible About page', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(manifest.name, 'DN');
  assert.equal(manifest.short_name, 'DN');
  assert.equal(pkg.name, 'dn');
  assert.equal(lock.name, 'dn');
  assert.equal(lock.packages[''].name, 'dn');
  assert.match(read('index.html'), /<title>DN<\\/title>/);
  const about = read('src/pages/About.jsx');
  assert.match(about, /About DN/);
  assert.doesNotMatch(about, retiredBrand);
});

test('user-facing app code and styles never reintroduce retired branding', () => {
  const files = walk(join(root, 'src')).filter((path) => /\\.(js|jsx|css)$/.test(path)
    && path !== 'src/utils/storageMigration.js');
  const offenders = files.filter((path) => retiredBrand.test(read(path)));
  for (const path of ['scripts/deploy-hosting.mjs', 'index.html']) {
    if (retiredBrand.test(read(path))) offenders.push(path);
  }
  assert.deepEqual(offenders, [], 'Use DN for app branding. Keep retired storage identifiers only in the compatibility module.');
});

test('OldVersion stays within its four-file Markdown documentation budget', () => {
  const allowed = [
    'AGENTS.md',
    'README.md',
    'docs/CHANGE_AUDIT_LOG.md',
    'docs/MASTER_SOURCE_OF_TRUTH.md',
  ];
  const actual = walk(root).filter((path) => /\\.(md|markdown)$/i.test(path)).sort();
  assert.deepEqual(actual, allowed);
  assert.match(read('AGENTS.md'), /PERMANENT PRODUCT NAME: DN/);
  assert.match(read('README.md'), /^# DN\\b/m);
  assert.match(read('docs/MASTER_SOURCE_OF_TRUTH.md'), /^# DN\\b/m);
});
