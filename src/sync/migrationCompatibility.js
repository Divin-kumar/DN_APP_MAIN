export const withMigrationProvenance = (record = {}, { migrationRunId, migratedFromVersion, originDeviceId } = {}) => ({
  ...record,
  changeSource: 'migration',
  migrationRunId,
  migratedFromVersion,
  originDeviceId: originDeviceId || record.originDeviceId || 'unknown-device',
  migrationAppliedAt: new Date().toISOString(),
  revision: Number(record.revision) || 1,
});
