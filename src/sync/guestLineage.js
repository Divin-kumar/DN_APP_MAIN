import { appendAudit } from './audit.js';

export const convertGuestToUser = async (record = {}, { targetPrincipalId, targetDeviceId } = {}) => {
  const converted = {
    ...record,
    principalId: targetPrincipalId || record.principalId,
    originDeviceId: targetDeviceId || record.originDeviceId || 'unknown-device',
    guestScope: false,
    changeSource: 'guest-conversion',
    updatedAt: new Date().toISOString(),
    auditTrail: Array.isArray(record.auditTrail) ? [...record.auditTrail] : [],
  };

  const audit = await appendAudit({
    principalId: converted.principalId,
    entityType: record.entityType || 'unknown',
    eventType: 'guest-to-user-converted',
    entityId: record.id || record.recordId,
    originDeviceId: converted.originDeviceId,
    details: { fromGuest: record.principalId, toUser: converted.principalId },
  });

  converted.auditTrail.push(audit);
  return converted;
};
