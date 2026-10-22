import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { verifyAuditLog } from './audit-log.mjs';

const base = process.argv[2];
if (base !== undefined && !/^[a-f\d]{7,40}$/i.test(base)) throw new Error('Supply a Git base commit SHA, or omit it to validate current ordering only.');
const previous = base === undefined ? '' : execFileSync('git', ['show', `${base}:docs/CHANGE_AUDIT_LOG.md`], { encoding: 'utf8' });
const current = readFileSync(new URL('../docs/CHANGE_AUDIT_LOG.md', import.meta.url), 'utf8');
const result = verifyAuditLog(previous, current);
console.log(base === undefined
  ? `Validated newest-first ordering for ${result.added} audit entries; no historical baseline supplied.`
  : `Preserved ${result.preserved} historical entries; ${result.added} new entry/entries appear first. An unchanged log is permitted.`);
