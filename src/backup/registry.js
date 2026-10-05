const TIERS = new Set(['tier1-user-data', 'tier2-system-metadata', 'tier3-sync-foundation']);
const RESTORE_POLICIES = new Set(['table', 'repository', 'settings', 'code-lists', 'skip']);
const domains = new Map();

export const registerBackupDomain = (descriptor) => {
  if (!descriptor || typeof descriptor !== 'object') throw new TypeError('Backup domain descriptor must be an object.');
  const { domain, tables, tier, ownershipPolicy, restorePolicy, descriptorVersion = 1 } = descriptor;
  if (typeof domain !== 'string' || !domain.trim()) throw new TypeError('Backup domain requires a stable domain name.');
  if (!Array.isArray(tables) || !tables.length || tables.some((table) => typeof table !== 'string' || !table)) throw new TypeError(`Backup domain ${domain} requires one or more table names.`);
  if (!TIERS.has(tier)) throw new TypeError(`Backup domain ${domain} has an unsupported tier.`);
  if (!ownershipPolicy || typeof ownershipPolicy.type !== 'string') throw new TypeError(`Backup domain ${domain} requires an ownership policy.`);
  if (ownershipPolicy.type === 'principal-field' && !ownershipPolicy.field) throw new TypeError(`Backup domain ${domain} requires the ownership field name.`);
  if (!['principal-field', 'all-local'].includes(ownershipPolicy.type)) throw new TypeError(`Backup domain ${domain} has an unsupported ownership policy.`);
  if (!RESTORE_POLICIES.has(restorePolicy)) throw new TypeError(`Backup domain ${domain} has an unsupported restore policy.`);
  if (restorePolicy === 'repository' && typeof descriptor.restoreAdapter !== 'function') throw new TypeError(`Backup domain ${domain} requires a repository restore adapter.`);
  if (!Number.isInteger(descriptorVersion) || descriptorVersion < 1) throw new TypeError(`Backup domain ${domain} has an invalid descriptor version.`);
  const existing = domains.get(domain);
  if (existing) {
    if (JSON.stringify(existing) === JSON.stringify({ ...descriptor, descriptorVersion })) return existing;
    throw new Error(`Backup domain ${domain} is already registered.`);
  }
  const occupiedTable = [...domains.values()].find((registered) => registered.tables.some((table) => tables.includes(table)));
  if (occupiedTable) throw new Error(`A table may be registered only once (${tables.find((table) => occupiedTable.tables.includes(table))}).`);
  const registered = Object.freeze({ ...descriptor, domain, tables: Object.freeze([...tables]), descriptorVersion });
  domains.set(domain, registered);
  return registered;
};

export const getBackupRegistry = ({ includeTier3 = false, attachmentMode = 'metadata-only' } = {}) => [...domains.values()]
  .filter((descriptor) => descriptor.defaultIncluded !== false || descriptor.backupMode === 'include-attachments' && attachmentMode === 'include-attachments')
  .filter((descriptor) => descriptor.tier !== 'tier3-sync-foundation' || includeTier3)
  .filter((descriptor) => descriptor.backupMode !== 'include-attachments' || attachmentMode === 'include-attachments')
  .sort((left, right) => left.domain.localeCompare(right.domain));

export const getBackupDescriptorForTable = (tableName) => [...domains.values()].find((descriptor) => descriptor.tables.includes(tableName)) || null;
export const getAllBackupDescriptors = () => [...domains.values()].sort((left, right) => left.domain.localeCompare(right.domain));

export const validateBackupRegistry = (knownTables) => {
  const errors = [];
  const tables = new Set(knownTables);
  const registeredTables = new Set();
  for (const descriptor of domains.values()) {
    for (const tableName of descriptor.tables) {
      if (!tables.has(tableName)) errors.push(`Backup domain ${descriptor.domain} references unknown table ${tableName}.`);
      if (registeredTables.has(tableName)) errors.push(`Backup table ${tableName} is registered more than once.`);
      registeredTables.add(tableName);
    }
  }
  for (const tableName of tables) {
    if (!registeredTables.has(tableName)) errors.push(`Database table ${tableName} has no backup registration or explicit exclusion.`);
  }
  return { valid: errors.length === 0, errors, registeredTables };
};
