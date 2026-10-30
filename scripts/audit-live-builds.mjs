// Read-only comparison of public DN shell fingerprints. No user data is fetched.
import { readFile } from 'node:fs/promises';

const sourceVersion = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const sites = [
  { label: 'Firebase production', origin: process.env.DN_AUDIT_PRODUCTION_URL || 'https://dn-10.web.app' },
  { label: 'OldVersion Vercel review', origin: process.env.DN_AUDIT_REVIEW_URL || 'https://life-hub-git-oldversion-dn-14b9.vercel.app' },
];

async function fetchPublicText(origin, path) {
  const response = await fetch(origin.replace(/\/$/, '') + path, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(20000),
    redirect: 'follow',
  });
  if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + path);
  return response.text();
}

async function inspectSite(site) {
  try {
    const [html, worker] = await Promise.all([
      fetchPublicText(site.origin, '/?dn_shell_audit=1'),
      fetchPublicText(site.origin, '/sw.js?dn_shell_audit=1'),
    ]);
    const version = worker.match(/\bversion:\s*["'](\d+\.\d+\.\d+)["']/)?.[1] || null;
    const build = worker.match(/CACHE_NAME\s*=\s*CACHE_PREFIX\s*\+\s*["']([^"']+)["']/)?.[1] || null;
    const assets = [...new Set([...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/g)].map((match) => match[1]))].sort();
    return { ...site, status: version ? 'read' : 'worker-version-unrecognized', version, build, assets };
  } catch (error) {
    return { ...site, status: 'unverified', error: String(error?.message || error) };
  }
}

const results = await Promise.all(sites.map(inspectSite));
const [production, review] = results;
const sameAssets = production.assets && review.assets
  ? JSON.stringify(production.assets) === JSON.stringify(review.assets) : null;

const cell = (value) => String(value ?? 'Not verified').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
console.log('### DN live-versus-review shell audit (read-only)');
console.log('');
console.log('Source package version: **' + cell(sourceVersion) + '**. Git ref: **' + cell(process.env.GITHUB_SHA || 'local check') + '**.');
console.log('');
console.log('| Target | Service-worker version | Shell build ID | Read status |');
console.log('|---|---|---|---|');
for (const site of results) {
  console.log('| ' + cell(site.label) + ' | ' + cell(site.version) + ' | ' + cell(site.build) + ' | ' + cell(site.status) + ' |');
}
console.log('');
if (production.version && review.version) {
  console.log('Version labels: ' + (production.version === review.version ? '**equal**.' : '**different** (expected when review contains unreleased changes).'));
} else {
  console.log('Version labels: **cannot be conclusively compared** from publicly fetched workers.');
}
if (sameAssets === null) {
  console.log('Entry asset paths: **not verified**.');
} else {
  console.log('Entry asset paths: **' + (sameAssets ? 'identical' : 'different') + '**.');
}
console.log('Source/feature parity: **not established** by version labels or entry asset paths alone. This audit never deploys or accesses Guest/account data.');
for (const site of results.filter((item) => item.error)) {
  console.log('- ' + cell(site.label) + ' fetch limitation: ' + cell(site.error));
}
