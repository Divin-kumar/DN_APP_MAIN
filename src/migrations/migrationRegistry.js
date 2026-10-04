import { DATABASE_TABLES } from '../database/tables.js';
import { activityRepository } from '../repositories/activityRepository.js';
import { attachmentRepository } from '../repositories/attachmentRepository.js';
import { codeListRepository } from '../repositories/codeListRepository.js';
import { expenseRepository } from '../repositories/expenseRepository.js';
import { incomeRepository } from '../repositories/incomeRepository.js';
import { memoryRepository } from '../repositories/memoryRepository.js';
import { momentRepository } from '../repositories/momentRepository.js';
import { settingsRepository } from '../repositories/settingsRepository.js';
import { validateActivityRecord } from '../repositories/activityRepository.validation.js';
import { validateAttachmentRecord } from '../repositories/attachmentRepository.validation.js';
import { validateCodeListRecord } from '../repositories/codeListRepository.validation.js';
import { validateExpenseRecord } from '../repositories/expenseRepository.validation.js';
import { validateIncomeRecord } from '../repositories/incomeRepository.validation.js';
import { validateMemoryRecord } from '../repositories/memoryRepository.validation.js';
import { validateMomentRecord } from '../repositories/momentRepository.validation.js';
import { validateSettingsRecord } from '../repositories/settingsRepository.validation.js';
import { MIGRATION_DOMAIN, MIGRATION_VERSION } from './migrationConstants.js';

const definitions = {
  [MIGRATION_DOMAIN.SETTINGS]: { table: DATABASE_TABLES.SETTINGS, validate: validateSettingsRecord, write: (userId, rows) => settingsRepository.setMany(userId, rows) },
  [MIGRATION_DOMAIN.CODE_LISTS]: { table: DATABASE_TABLES.CODE_LISTS, validate: validateCodeListRecord, write: async (userId, rows) => {
    const written = [];
    for (const row of rows) written.push(await codeListRepository.upsertEntry(userId, row.listKey, row));
    return written.filter(Boolean);
  } },
  [MIGRATION_DOMAIN.MOMENTS]: { table: DATABASE_TABLES.MOMENTS, validate: validateMomentRecord, write: (userId, rows) => momentRepository.bulkUpsert(userId, rows) },
  [MIGRATION_DOMAIN.ACTIVITIES]: { table: DATABASE_TABLES.ACTIVITIES, validate: validateActivityRecord, write: (userId, rows) => activityRepository.bulkUpsert(userId, rows) },
  [MIGRATION_DOMAIN.EXPENSES]: { table: DATABASE_TABLES.EXPENSES, validate: validateExpenseRecord, write: (userId, rows) => expenseRepository.bulkUpsert(userId, rows) },
  [MIGRATION_DOMAIN.INCOMES]: { table: DATABASE_TABLES.INCOMES, validate: validateIncomeRecord, write: (userId, rows) => incomeRepository.bulkUpsert(userId, rows) },
  [MIGRATION_DOMAIN.MEMORIES]: { table: DATABASE_TABLES.MEMORIES, validate: validateMemoryRecord, write: (userId, rows) => memoryRepository.bulkUpsert(userId, rows) },
  [MIGRATION_DOMAIN.ATTACHMENTS]: { table: DATABASE_TABLES.ATTACHMENTS, validate: validateAttachmentRecord, write: (userId, rows) => attachmentRepository.bulkUpsert(userId, rows) },
};

export const getMigrationDefinition = (version = MIGRATION_VERSION) => {
  if (version !== MIGRATION_VERSION) return null;
  return Object.freeze({ version, domains: definitions, domainOrder: Object.keys(definitions) });
};

export const getDomainMigrationDefinition = (domain, version = MIGRATION_VERSION) =>
  getMigrationDefinition(version)?.domains?.[domain] || null;

export const getMigrationRegistry = () => ({ [MIGRATION_VERSION]: getMigrationDefinition(MIGRATION_VERSION) });

export const validateMigrationDefinition = (definition) => Boolean(
  definition && Number.isInteger(definition.version) && Array.isArray(definition.domainOrder)
  && definition.domainOrder.every((domain) => definition.domains[domain]?.table && definition.domains[domain]?.validate && definition.domains[domain]?.write),
);

export class MigrationRegistry {
  getMigrationDefinition(version = MIGRATION_VERSION) {
    return getMigrationDefinition(version);
  }

  getDomainDefinition(domain, version = MIGRATION_VERSION) {
    return getDomainMigrationDefinition(domain, version);
  }

  listVersions() {
    return Object.keys(getMigrationRegistry()).map(Number);
  }
}

export default MigrationRegistry;
