import { db } from '../database/index.js';
import { DATABASE_TABLES } from '../database/tables.js';
import { appendAudit } from './audit.js';

const createDeviceId = () => (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
  ? globalThis.crypto.randomUUID()
  : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const registerDevice = async ({
  deviceName,
  platform,
  appVersion,
  principalId,
  deviceId = createDeviceId(),
  status = 'active',
} = {}) => {
  const table = db.table(DATABASE_TABLES.DEVICE_REGISTRY);
  const createdAt = new Date().toISOString();
  const record = {
    deviceId,
    deviceName: deviceName || 'unknown-device',
    platform: platform || 'unknown',
    appVersion: appVersion || 'unknown',
    principalId: principalId || 'guest',
    status,
    syncEligible: status === 'active',
    registeredAt: createdAt,
    lastSeenAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };

  await table.put(record);
  await appendAudit({
    principalId: record.principalId,
    entityType: 'devices',
    eventType: 'device-registered',
    entityId: record.deviceId,
    originDeviceId: record.deviceId,
    details: { deviceName: record.deviceName, platform: record.platform, appVersion: record.appVersion },
  });
  return record;
};

export const getDevice = async (deviceId) => {
  const table = db.table(DATABASE_TABLES.DEVICE_REGISTRY);
  return table.get(deviceId);
};

export const updateDeviceLifecycle = async (deviceId, status, details = {}) => {
  const table = db.table(DATABASE_TABLES.DEVICE_REGISTRY);
  const existing = await table.get(deviceId);
  if (!existing) throw new Error(`Device ${deviceId} was not found.`);

  const updated = {
    ...existing,
    status,
    syncEligible: status === 'active',
    lastSeenAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...details,
  };

  await table.put(updated);
  await appendAudit({
    principalId: updated.principalId,
    entityType: 'devices',
    eventType: `device-${status}`,
    entityId: updated.deviceId,
    originDeviceId: updated.deviceId,
    details: { status, ...details },
  });

  return updated;
};
