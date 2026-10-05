// Importing module catalogs executes their self-registration before backup operations.
import './domains/userData.js';
import './domains/attachments.js';
import './domains/systemMetadata.js';
import './domains/syncFoundation.js';
import './domains/migrationMetadata.js';

export { getAllBackupDescriptors, getBackupDescriptorForTable, getBackupRegistry, registerBackupDomain, validateBackupRegistry } from './registry.js';
