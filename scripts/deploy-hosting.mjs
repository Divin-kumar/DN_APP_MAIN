import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagePath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');

const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
const lockJson = JSON.parse(await readFile(lockPath, 'utf8'));
const parts = String(packageJson.version || '1.0.0').split('.').map(Number);
if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
  throw new Error(`Invalid semantic version: ${packageJson.version}`);
}

parts[2] += 1;
const nextVersion = parts.join('.');
// Check the live worker before changing package/lock files or invoking Firebase.
// A stale checkout must never silently downgrade an already published release.
const guard = spawnSync(process.execPath, ['scripts/check-hosting-release-version.mjs', nextVersion], {
  cwd: root, env: process.env, stdio: 'inherit', shell: false,
});
if (guard.status !== 0) process.exit(guard.status ?? 1);
packageJson.version = nextVersion;
lockJson.version = nextVersion;
if (lockJson.packages?.['']) lockJson.packages[''].version = nextVersion;
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
await writeFile(lockPath, `${JSON.stringify(lockJson, null, 2)}\n`);

const deployDate = new Date().toISOString();
const env = {
  ...process.env,
  VITE_DEPLOYED_AT: deployDate,
  VITE_DEPLOY_ENV: 'Production',
};

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

console.log(`Releasing DN v${nextVersion} to Firebase Hosting (Production)`);
run('npm', ['run', 'build']);
run('npm', ['exec', '--', 'firebase-tools', 'deploy', '--only', 'hosting']);
