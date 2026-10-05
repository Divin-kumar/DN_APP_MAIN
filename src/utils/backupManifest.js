export const normalizeManifest = (manifest = {}) => ({
  manifestVersion: manifest.manifestVersion ?? 1,
  backupId: manifest.backupId || `backup-${Date.now()}`,
  createdAt: manifest.createdAt || new Date().toISOString(),
  schemaVersion: manifest.schemaVersion ?? 2,
  appVersion: manifest.appVersion || 'LifeHub-local-backup',
  principalScope: manifest.principalScope || 'all',
  environment: manifest.environment || 'local',
  fileFormat: manifest.fileFormat || 'lifehub-backup-v1',
  domainSummary: Array.isArray(manifest.domainSummary) ? manifest.domainSummary : [],
  recordCounts: manifest.recordCounts || {},
  reason: manifest.reason || 'manual-local-backup',
  checksum: manifest.checksum || null,
});

export const normalizeBackupArtifact = (artifact = {}) => ({
  artifactVersion: artifact.artifactVersion ?? 1,
  artifactId: artifact.artifactId || `artifact-${Date.now()}`,
  appName: artifact.appName || 'LifeHub',
  createdAt: artifact.createdAt || new Date().toISOString(),
  databaseSchemaVersion: artifact.databaseSchemaVersion ?? 2,
  environment: artifact.environment || 'local',
  principalScope: artifact.principalScope || 'all',
  exportType: artifact.exportType || 'local-backup',
  manifest: normalizeManifest(artifact.manifest),
  payload: artifact.payload || {},
  checksum: artifact.checksum || null,
});
