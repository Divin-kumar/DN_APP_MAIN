import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { verifyAuditLog } from './audit-log.mjs';

const base = process.argv[2];
if (!/^[a-f\d]{7,40}$/i.test(base || '')) throw new Error('Supply a Git base commit SHA.');
const previous = execFileSync('git', ['show', `${base}:docs/CHANGE_AUDIT_LOG.md`], { encoding: 'utf8' });
const current = readFileSync(new URL('../docs/CHANGE_AUDIT_LOG.md', import.meta.url), 'utf8');
const result = verifyAuditLog(previous, current);
console.log(`Preserved ${result.preserved} historical entries; ${result.added} new entry/entries appear first.`);
