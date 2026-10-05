import test from 'node:test';
import assert from 'node:assert/strict';
import { DATABASE_SCHEMA } from '../database/schema.js';
import './index.js';
import { getAllBackupDescriptors, getBackupRegistry, registerBackupDomain, validateBackupRegistry } from './registry.js';

test('backup registry covers every current Dexie table explicitly', () => {
  const result = validateBackupRegistry(Object.keys(DATABASE_SCHEMA));
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.equal(result.registeredTables.size, Object.keys(DATABASE_SCHEMA).length);
});

test('Profile is included automatically through the Settings Tier 1 registration', () => {
  const settings = getAllBackupDescriptors().find((descriptor) => descriptor.domain === 'settings');
  assert.ok(settings);
  assert.equal(settings.tier, 'tier1-user-data');
  assert.ok(settings.tables.includes('settings'));
});

test('attachment file bytes are absent in metadata-only mode and opt-in in include mode', () => {
  const metadataOnly = getBackupRegistry({ attachmentMode: 'metadata-only' });
  const withFiles = getBackupRegistry({ attachmentMode: 'include-attachments' });
  assert.equal(metadataOnly.some((descriptor) => descriptor.tables.includes('attachmentFiles')), false);
  assert.equal(withFiles.some((descriptor) => descriptor.tables.includes('attachmentFiles')), true);
});

test('registry rejects duplicate domain and duplicate table registrations', () => {
  const uniqueDomain = `test-domain-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
  registerBackupDomain({ domain: uniqueDomain, tables: [`table-${uniqueDomain}`], tier: 'tier1-user-data', ownershipPolicy: { type: 'principal-field', field: 'userId' }, restorePolicy: 'table' });
  assert.throws(() => registerBackupDomain({ domain: uniqueDomain, tables: [`another-${uniqueDomain}`], tier: 'tier1-user-data', ownershipPolicy: { type: 'principal-field', field: 'userId' }, restorePolicy: 'table' }), /already registered/);
  assert.throws(() => registerBackupDomain({ domain: `other-${uniqueDomain}`, tables: [`table-${uniqueDomain}`], tier: 'tier1-user-data', ownershipPolicy: { type: 'principal-field', field: 'userId' }, restorePolicy: 'table' }), /registered only once/);
});
