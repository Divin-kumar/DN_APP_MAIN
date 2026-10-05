export const ATTACHMENT_STATUS_OPTIONS = [
  { value: 'available', label: 'Available', tone: 'success', icon: 'check' },
  { value: 'on-device', label: 'On This Device', tone: 'info', icon: 'device' },
  { value: 'reference-only', label: 'Reference Only', tone: 'warning', icon: 'link' },
  { value: 'unavailable', label: 'Unavailable', tone: 'danger', icon: 'warning' },
];

const statusMap = Object.fromEntries(ATTACHMENT_STATUS_OPTIONS.map((option) => [option.value, option]));

const hasUsableReference = (attachment = {}) => {
  const candidates = [attachment?.fileReference, attachment?.url, attachment?.previewReference];
  return candidates.some((candidate) => {
    if (typeof candidate !== 'string' || !candidate.trim()) return false;
    try {
      const parsed = new URL(candidate.trim());
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  });
};

export const normalizeAttachmentStatusValue = (attachment = {}) => {
  const raw = String(attachment?.availability ?? attachment?.status ?? '').trim().toLowerCase();
  const hasLocalBlob = attachment?.hasLocalCopy === true
    || (typeof Blob !== 'undefined' && attachment?.blob instanceof Blob)
    || (typeof Blob !== 'undefined' && attachment?.localCopy instanceof Blob);
  const hasReference = hasUsableReference(attachment);

  if (hasLocalBlob) return 'on-device';
  if (raw === 'unavailable') return 'unavailable';
  if ((raw === 'available' || attachment?.contentAccessible === true || attachment?.isContentAccessible === true) && hasReference) return 'available';
  if (hasReference) return 'reference-only';

  // Stored labels are hints; without a local blob or usable reference, content is unavailable.
  if (raw === 'local-copy' || raw === 'on-device' || raw === 'on this device' || raw === 'reference' || raw === 'reference-only' || raw === 'reference only' || raw === 'available') return 'unavailable';

  return 'unavailable';
};

export const getAttachmentStatus = (attachment = {}) => {
  const value = normalizeAttachmentStatusValue(attachment);
  const config = statusMap[value] || statusMap.unavailable;
  return { ...config, value, description: config.label };
};

export const getAttachmentTypeBucket = (attachment = {}) => {
  const mimeType = String(attachment?.mimeType || attachment?.type || '').toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.startsWith('text/') || mimeType.includes('word') || mimeType.includes('sheet') || mimeType.includes('excel') || mimeType.includes('document') || mimeType.includes('officedocument')) return 'document';
  return 'document';
};

export const getAttachmentTypeLabel = (attachment = {}) => {
  const bucket = getAttachmentTypeBucket(attachment);
  if (bucket === 'image') return 'Image';
  if (bucket === 'pdf') return 'PDF';
  return 'Document';
};

export const getAttachmentLinkLabel = (links = []) => {
  const linkValues = Array.isArray(links) ? links : [];
  const types = new Set(linkValues
    .map((entry) => (typeof entry === 'string' ? entry : entry?.parentType || entry?.type || ''))
    .map((value) => String(value).trim().toLowerCase())
    .filter(Boolean));

  if (!types.size) return 'Not linked';
  const hasMoment = types.has('moment');
  const hasActivity = types.has('activity');
  if (hasMoment && hasActivity) return 'Moment + Activity';
  if (hasMoment) return 'Moment';
  if (hasActivity) return 'Activity';
  return 'Linked';
};

export const getAttachmentHealthSummary = (attachments = []) => {
  const summary = {
    available: 0,
    onDevice: 0,
    referenceOnly: 0,
    unavailable: 0,
    total: 0,
  };

  for (const attachment of attachments) {
    const status = getAttachmentStatus(attachment);
    if (status.value === 'available') summary.available += 1;
    if (status.value === 'on-device') summary.onDevice += 1;
    if (status.value === 'reference-only') summary.referenceOnly += 1;
    if (status.value === 'unavailable') summary.unavailable += 1;
    summary.total += 1;
  }

  return summary;
};

export const sortAttachmentsForGallery = (attachments = [], mode = 'recent') => {
  const items = [...attachments];
  const getDate = (attachment) => new Date(attachment?.createdAt || attachment?.updatedAt || 0).getTime();

  if (mode === 'oldest') {
    return items.sort((left, right) => getDate(left) - getDate(right));
  }

  if (mode === 'name') {
    return items.sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')));
  }

  if (mode === 'type') {
    return items.sort((left, right) => getAttachmentTypeLabel(left).localeCompare(getAttachmentTypeLabel(right)) || String(left?.name || '').localeCompare(String(right?.name || '')));
  }

  if (mode === 'status') {
    const order = { 'on-device': 0, available: 1, 'reference-only': 2, unavailable: 3 };
    return items.sort((left, right) => (order[getAttachmentStatus(left).value] ?? 99) - (order[getAttachmentStatus(right).value] ?? 99));
  }

  return items.sort((left, right) => getDate(right) - getDate(left));
};
