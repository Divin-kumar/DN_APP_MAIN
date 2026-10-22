import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAuditLog } from './audit-log.mjs';

const entry = (id, body = 'Evidence preserved.') => `## CHG-${id} | Change\n${body}\n\n`;
const first = entry('20261021-001');
const second = entry('20261021-002');
const newest = entry('20261022-075', 'Current work.');

test('audit migration preserves ascending history when reordered newest first with a new top entry', () => {
  assert.deepEqual(verifyAuditLog(`# Old policy\n${first}${second}`, `# New policy\n${newest}${second}${first}`), { preserved: 2, added: 1 });
});

test('audit validation accepts subsequent newest-first entries and Windows line endings', () => {
  const previous = second + first;
  assert.deepEqual(verifyAuditLog(previous, (newest + previous).replace(/\n/g, '\r\n')), { preserved: 2, added: 1 });
});

test('routine changes may retain an unchanged audit log without new entries', () => {
  const previous = second + first;
  assert.deepEqual(verifyAuditLog(previous, previous), { preserved: 2, added: 0 });
  assert.deepEqual(verifyAuditLog(previous, previous.replace(/\n/g, '\r\n')), { preserved: 2, added: 0 });
});

test('audit ordering is validated even when a historical baseline is unavailable', () => {
  assert.deepEqual(verifyAuditLog('', newest + second + first), { preserved: 0, added: 3 });
  assert.throws(() => verifyAuditLog('', first + second), /newest first/);
  assert.throws(() => verifyAuditLog('', '# Empty log\n'), /must contain entries/);
});

test('audit validation rejects changed, removed or renamed historical records', () => {
  assert.throws(() => verifyAuditLog(second + first, second + first.replace('Evidence preserved.', 'Edited.')), /edited/);
  assert.throws(() => verifyAuditLog(second + first, first), /removed/);
  assert.throws(() => verifyAuditLog(first + second, newest + second + first.replace('Evidence preserved.', 'Edited.')), /edited/);
  assert.throws(() => verifyAuditLog(first + second, newest + first), /removed/);
  assert.throws(() => verifyAuditLog(first, newest + first.replace('20261021-001', '20261021-003')), /removed/);
});

test('audit validation rejects duplicate, malformed, oldest-first and misplaced new entries', () => {
  assert.throws(() => verifyAuditLog(first, newest + first + first), /Duplicate/);
  assert.throws(() => verifyAuditLog(first, newest + first + '## CHG-invalid | Change\n'), /Malformed/);
  assert.throws(() => verifyAuditLog(first, first + newest), /newest first/);
  assert.throws(() => verifyAuditLog(newest + first, newest + second + first), /must precede historical/);
});
