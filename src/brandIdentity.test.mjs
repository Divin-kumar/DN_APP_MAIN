import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

// This regex matches the retired product name without adopting it as a product label.
// Historical storage prefixes remain valid in a dedicated compatibility module.
const retiredBrand = /life[\s_-]*hub/i;

const walk = (dir, result = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
      walk(join(dir, entry.name), result);
    } else if (entry.isFile()) {
      result.push(relative(root, join(dir, entry.name)).split(sep).join('/'));
    }
  }
  return result;
};

test('DN is the only official brand in app metadata and the About screen', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(manifest.name, 'DN');
  assert.equal(manifest.short_name, 'DN');
  assert.equal(pkg.name, 'dn');
  assert.equal(lock.name, 'dn');
  assert.equal(lock.packages[''].name, 'dn');
  assert.match(read('index.html'), /<title>DN<\/title>/);
  const about = read('src/pages/About.jsx');
  assert.match(about, /About DN/);
  assert.doesNotMatch(about, retiredBrand);
});

test('app source and styles never reintroduce retired product branding', () => {
  const files = walk(join(root, 'src')).filter((path) =>
    ['.js', '.jsx', '.css'].some((extension) => path.endsWith(extension))
    && path !== 'src/utils/storageMigration.js'
  );
  const offenders = files.filter((path) => retiredBrand.test(read(path)));
  for (const path of ['scripts/deploy-hosting.mjs', 'index.html']) {
    if (retiredBrand.test(read(path))) offenders.push(path);
  }
  assert.deepEqual(offenders, [], 'DN is the only product brand. Keep old storage identifiers in the dedicated compatibility module.');
});

test('OldVersion contains exactly four approved Markdown documents', () => {
  const allowed = [
    'AGENTS.md',
    'README.md',
    'docs/CHANGE_AUDIT_LOG.md',
    'docs/MASTER_SOURCE_OF_TRUTH.md',
  ];
  const actual = walk(root).filter((path) =>
    ['.md', '.markdown'].some((extension) => path.toLowerCase().endsWith(extension))
  ).sort();
  assert.deepEqual(actual, allowed);
  assert.match(read('AGENTS.md'), /PERMANENT PRODUCT NAME: DN/);
  assert.ok(read('README.md').startsWith('# DN'));
  assert.ok(read('docs/MASTER_SOURCE_OF_TRUTH.md').startsWith('# DN'));
});
