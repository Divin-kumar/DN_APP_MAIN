// Pure, testable Firebase release-version checks; no network or file side effects.
export function versionParts(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  if (!match) throw new Error('Invalid release version: ' + version);
  return match.slice(1).map(Number);
}

export function compareReleaseVersions(candidate, live) {
  const lhs = versionParts(candidate);
  const rhs = versionParts(live);
  for (let i = 0; i < lhs.length; i += 1) {
    if (lhs[i] !== rhs[i]) return lhs[i] > rhs[i] ? 1 : -1;
  }
  return 0;
}

export function getWorkerReleaseVersion(source) {
  const match = /\bversion:\s*["'](\d+\.\d+\.\d+)["']/.exec(String(source));
  if (!match) throw new Error('Live service worker has no recognizable release version');
  return match[1];
}
