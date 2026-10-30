// Fail closed if a proposed Firebase release would duplicate or downgrade the live shell.
// Only public service-worker text is read. No deployment or records access occurs here.
import { readFile } from 'node:fs/promises';
import { compareReleaseVersions, getWorkerReleaseVersion, versionParts } from './release-version-guard.mjs';

const packageVersion = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).version;
const candidate = process.argv[2] || packageVersion;
versionParts(candidate);
const origin = process.env.DN_FIREBASE_LIVE_URL || 'https://dn-10.web.app';

try {
  const response = await fetch(origin.replace(/\/$/, '') + '/sw.js?dn_release_check=1', {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(20000),
    redirect: 'follow',
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const active = getWorkerReleaseVersion(await response.text());
  if (compareReleaseVersions(candidate, active) <= 0) {
    throw new Error('Candidate v' + candidate + ' is not newer than live Firebase v' + active);
  }
  console.log('Release version check passed: v' + candidate + ' > live v' + active);
} catch (error) {
  console.error('Firebase release BLOCKED: ' + String(error?.message || error));
  console.error('Verify the live Hosting release and explicitly prepare a newer version before publishing.');
  process.exitCode = 1;
}
