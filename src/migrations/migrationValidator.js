import { MIGRATION_DOMAIN } from './migrationConstants.js';
import { getMigrationDefinition } from './migrationRegistry.js';

const finding = (severity, ruleId, domain, recordId, message, details = {}) => ({
  severity, ruleId, domain, recordId: recordId || null, message, ...details,
});

export const validateMigrationDatasets = (datasets = {}, { principalId, version, existingRecords = {} } = {}) => {
  const definition = getMigrationDefinition(version);
  const findings = [];
  const recordsByDomain = {};

  if (!principalId) findings.push(finding('error', 'migration.principal.required', null, null, 'Migration principal is required.'));
  if (!definition) findings.push(finding('error', 'migration.version.unsupported', null, null, 'Migration version is not registered.'));

  for (const [domain, descriptor] of Object.entries(definition?.domains || {})) {
    const entries = Array.isArray(datasets[domain]) ? datasets[domain] : [];
    const records = entries.map((entry) => entry?.record ?? entry);
    recordsByDomain[domain] = records;

    records.forEach((record) => {
      const result = descriptor.validate(record);
      for (const message of result.errors || []) {
        findings.push(finding('error', `${domain}.row.invalid`, domain, record?.id, message));
      }
      if (record?.userId !== principalId) {
        findings.push(finding('error', `${domain}.owner.mismatch`, domain, record?.id, 'Record owner does not match the migration principal.'));
      }
    });
  }

  const indexIds = (domain) => new Set([
    ...(recordsByDomain[domain] || []),
    ...(existingRecords[domain] || []),
  ].map((record) => record?.id).filter(Boolean));
  const momentIds = indexIds(MIGRATION_DOMAIN.MOMENTS);
  const activityIds = indexIds(MIGRATION_DOMAIN.ACTIVITIES);

  const relations = [
    [MIGRATION_DOMAIN.ACTIVITIES, 'momentId', momentIds],
    [MIGRATION_DOMAIN.MEMORIES, 'momentId', momentIds],
    [MIGRATION_DOMAIN.ATTACHMENTS, 'momentId', momentIds],
    [MIGRATION_DOMAIN.EXPENSES, 'momentId', momentIds],
    [MIGRATION_DOMAIN.EXPENSES, 'activityId', activityIds],
  ];
  for (const [domain, field, ids] of relations) {
    (recordsByDomain[domain] || []).forEach((record) => {
      if (record?.[field] && !ids.has(record[field])) {
        findings.push(finding('error', `${domain}.relationship.orphan`, domain, record.id, `Referenced ${field} was not found in the staged migration data.`, { field, referenceId: record[field] }));
      }
    });
  }

  for (const domain of Object.values(MIGRATION_DOMAIN)) {
    const ids = (recordsByDomain[domain] || []).map((record) => record?.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      findings.push(finding('error', `${domain}.identity.duplicate`, domain, null, 'Duplicate canonical IDs exist within the staged dataset.'));
    }
  }

  return {
    valid: !findings.some((item) => item.severity === 'error'),
    findings,
    counts: Object.fromEntries(Object.entries(recordsByDomain).map(([domain, rows]) => [domain, rows.length])),
  };
};

export class MigrationValidator {
  validate(datasets, options) {
    return validateMigrationDatasets(datasets, options);
  }
}

export default MigrationValidator;
