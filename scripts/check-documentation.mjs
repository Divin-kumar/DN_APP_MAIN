import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyAuditLog } from './audit-log.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const allowed = ['AGENTS.md', 'README.md', 'docs/CHANGE_AUDIT_LOG.md', 'docs/DN_BUSINESS_GUIDE.md', 'docs/MASTER_SOURCE_OF_TRUTH.md'];
const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage', '.verification', 'playwright-report', 'test-results']);
const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? ignored.has(entry.name) ? [] : walk(path) : /\.(md|markdown)$/i.test(entry.name) ? [relative(root, path)] : [];
});
if (JSON.stringify(walk(root).sort()) !== JSON.stringify(allowed)) throw new Error('Keep exactly the five authorized Markdown documents.');
let links = 0;
for (const file of allowed.filter((path) => !path.endsWith('CHANGE_AUDIT_LOG.md'))) {
  const source = readFileSync(join(root, file), 'utf8');
  for (const match of source.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    if (!existsSync(resolve(dirname(join(root, file)), target))) throw new Error(`Broken documentation link: ${file} -> ${target}`);
    links += 1;
  }
}
const base = process.argv[2] || 'HEAD';
if (base !== 'HEAD' && !/^[a-f\d]{7,40}$/i.test(base)) throw new Error('Supply HEAD or a Git base commit SHA.');
const previous = execFileSync('git', ['show', `${base}:docs/CHANGE_AUDIT_LOG.md`], { cwd: root, encoding: 'utf8' });
const current = readFileSync(join(root, 'docs/CHANGE_AUDIT_LOG.md'), 'utf8');
const audit = verifyAuditLog(previous, current);
const master = readFileSync(join(root, 'docs/MASTER_SOURCE_OF_TRUTH.md'), 'utf8');
for (const contract of ['/events/:eventId/activities/:activityId', '/events/:eventId/transactions', 'Overview, Activities, Transactions, Timeline, Memories and Attachments']) {
  if (!master.includes(contract)) throw new Error(`Master is missing the route/workspace contract: ${contract}`);
}
console.log(`Documentation PASS: five documents, ${links} local links, ${audit.preserved} historical entries preserved, ${audit.added} new entries; route/workspace contracts present.`);
