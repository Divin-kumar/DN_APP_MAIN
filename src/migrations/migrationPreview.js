import { detectMigrationDuplicates } from './migrationDeduplication.js';
import { getMigrationDefinition } from './migrationRegistry.js';
import { validateMigrationDatasets } from './migrationValidator.js';

export const buildImportPreview = async ({ datasets, principalId, migrationVersion, database }) => {
  const definition = getMigrationDefinition(migrationVersion);
  if (!definition) throw new Error(`Migration version ${migrationVersion} is not registered.`);

  const dedupedDatasets = {};
  const duplicates = [];
  const conflicts = [];
  const counts = {};
  const existingByDomain = {};

  for (const domain of definition.domainOrder) {
    const entries = datasets[domain] || [];
    const descriptor = definition.domains[domain];
    const existing = await database.table(descriptor.table).where('userId').equals(principalId).toArray();
    existingByDomain[domain] = existing;
    const comparison = await detectMigrationDuplicates(domain, entries.map((entry) => entry.record), existing);
    const lineageById = new Map(entries.map((entry) => [entry.record.id, entry.lineage]));
    dedupedDatasets[domain] = comparison.kept.map((record) => ({ record, lineage: lineageById.get(record.id) || { source: record.source || 'legacy', originalId: record.id, domain } }));
    duplicates.push(...comparison.duplicates.map((item) => ({ domain, ...item })));
    conflicts.push(...comparison.conflicts.map((item) => ({ domain, ...item })));
    counts[domain] = {
      source: entries.length,
      import: comparison.kept.length,
      duplicate: comparison.duplicates.length,
      conflict: comparison.conflicts.length,
    };
  }

  const incomingForValidation = Object.fromEntries(definition.domainOrder.map((domain) => [
    domain,
    dedupedDatasets[domain] || [],
  ]));
  const validation = validateMigrationDatasets(incomingForValidation, {
    principalId,
    version: migrationVersion,
    existingRecords: existingByDomain,
  });
  validation.findings.push(...(datasets.rawFindings || []));
  if (datasets.rawFindings?.length) validation.valid = false;
  if (conflicts.length) {
    validation.findings.push({ severity: 'error', ruleId: 'migration.conflict.unresolved', domain: null, recordId: null, message: `${conflicts.length} conflicting record(s) require resolution before commit.` });
    validation.valid = false;
  }

  const reconciled = Object.values(counts).reduce((sum, entry) => sum + entry.source, 0);
  const outcomes = Object.values(counts).reduce((sum, entry) => sum + entry.import + entry.duplicate + entry.conflict, 0);
  if (reconciled !== outcomes) {
    validation.findings.push({ severity: 'error', ruleId: 'migration.counts.unreconciled', domain: null, recordId: null, message: 'Source and migration outcome counts do not reconcile.' });
    validation.valid = false;
  }

  return { datasets: dedupedDatasets, existingByDomain, duplicates, conflicts, counts, validation, valid: validation.valid };
};

export class MigrationPreviewManager {
  constructor({ database }) {
    this.database = database;
  }

  build(options) {
    return buildImportPreview({ ...options, database: options.database || this.database });
  }
}

export default buildImportPreview;
