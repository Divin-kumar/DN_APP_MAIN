// Build-time development About ledger. Only public commit metadata enters the output.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const output = resolve('public/dn-pending-release.json');
const repo = process.env.GITHUB_REPOSITORY || 'Divin-kumar/DN_APP_MAIN';
const head = process.env.GITHUB_SHA || '';
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const override = process.env.DN_RELEASE_BASELINE_SHA || '';
const initialProduction = '15b487e93a5f5e03530acb1499c89c085be95c7f';
const shaValid = value => /^[a-f0-9]{40}$/i.test(value || '');
const api = async path => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch('https://api.github.com' + path, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      signal: controller.signal,
    });
    if (!response.ok) throw Error('GitHub metadata HTTP ' + response.status);
    return await response.json();
  } finally { clearTimeout(timeout); }
};
const ledger = { status: 'unavailable', production: { sha: initialProduction, version: '2.3.8', runUrl: 'https://github.com/' + repo + '/actions/runs/42226175568' }, sourceSha: head, generatedAt: new Date().toISOString(), commits: [] };
try {
  if (!shaValid(head) || (override && !shaValid(override))) throw Error('Invalid source or production SHA');
  const runs = override ? null : await api('/repos/' + repo + '/actions/workflows/dn-oldversion-firebase-production.yml/runs?branch=OldVersion&status=success&per_page=30');
  const latest = runs?.workflow_runs?.find(run => run.conclusion === 'success' && run.head_branch === 'OldVersion');
  const releasedSha = override || latest?.head_sha || initialProduction;
  if (!shaValid(releasedSha)) throw Error('Production baseline not verified');
  ledger.production.sha = releasedSha;
  ledger.production.runUrl = latest?.html_url || (releasedSha === initialProduction ? ledger.production.runUrl : null);
  try {
    const packageJson = releasedSha === head
      ? JSON.parse(await readFile('package.json', 'utf8'))
      : await api('/repos/' + repo + '/contents/package.json?ref=' + releasedSha)
        .then(file => JSON.parse(Buffer.from(file.content.replace(/\s+/g, ''), 'base64').toString('utf8')));
    ledger.production.version = packageJson.version || null;
  } catch {
    ledger.production.version = releasedSha === initialProduction ? '2.3.8' : null;
  }
  let page = 1, total = releasedSha === head ? 0 : null;
  const seen = new Set();
  while (total !== 0 && page <= 50) {
    const comparison = await api('/repos/' + repo + '/compare/' + releasedSha + '...' + head + '?per_page=100&page=' + page);
    if (!['ahead', 'identical'].includes(comparison.status)) throw Error('Production baseline not ancestor of development');
    if (total === null) total = comparison.total_commits;
    const batch = comparison.commits || [];
    for (const item of batch) {
      if (!shaValid(item.sha) || seen.has(item.sha)) continue;
      seen.add(item.sha);
      const [title, ...details] = (item.commit?.message || 'Untitled commit').split(/\r?\n/);
      ledger.commits.push({ sha:item.sha, title:title.trim(), details:details.join('\n').trim(), date:item.commit?.committer?.date || item.commit?.author?.date || '', url:'https://github.com/' + repo + '/commit/' + item.sha });
    }
    if (ledger.commits.length >= total) break;
    if (!batch.length) throw Error('Incomplete GitHub comparison');
    page += 1;
  }
  if (ledger.commits.length !== total) throw Error('Incomplete pending release log');
  ledger.commits.reverse();
  ledger.status = 'ready';
  console.log('DN pending production: ' + ledger.commits.length + ' commits since ' + releasedSha.slice(0, 7));
} catch (error) {
  // Keep the fast development deployment alive; never display incomplete notes as complete.
  ledger.error = String(error?.message || error);
  ledger.commits = [];
  console.warn('DN About ledger unavailable: ' + ledger.error);
}
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(ledger, null, 2) + '\n');
