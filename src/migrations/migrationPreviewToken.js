import { canonicalFingerprint } from './migrationIdentity.js';

export const createPreviewToken = async ({ runId, principalId, sourceFingerprint, counts, validation }) => canonicalFingerprint({
  runId, principalId, sourceFingerprint, counts, findings: validation.findings,
});
