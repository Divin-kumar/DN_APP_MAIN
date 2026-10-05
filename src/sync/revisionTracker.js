export const createRevisionEnvelope = ({
  revision = 0,
  principalId,
  originDeviceId,
  changeSource = 'user',
} = {}) => ({
  revision: Number.isFinite(Number(revision)) ? Number(revision) || 1 : 1,
  provenance: {
    principalId: principalId || 'guest',
    originDeviceId: originDeviceId || 'unknown-device',
    changeSource,
    createdAt: new Date().toISOString(),
  },
});

export const normalizeRevision = (value = 0) => {
  const next = Number(value) || 0;
  return next >= 1 ? next : 1;
};
