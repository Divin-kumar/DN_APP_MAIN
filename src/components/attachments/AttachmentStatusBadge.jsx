import { AlertTriangle, CheckCircle2, HardDrive, Link2 } from 'lucide-react';
import { getAttachmentStatus } from '../../utils/attachmentStatus.js';

const iconMap = {
  available: CheckCircle2,
  'on-device': HardDrive,
  'reference-only': Link2,
  unavailable: AlertTriangle,
};

export default function AttachmentStatusBadge({ attachment, status, className = '', small = false }) {
  const resolved = getAttachmentStatus(attachment || { availability: status });
  const Icon = iconMap[resolved.value] || CheckCircle2;

  return (
    <span
      className={className || 'attachment-status-badge'}
      data-tone={resolved.value}
      data-size={small ? 'small' : 'regular'}
      aria-label={`Attachment status: ${resolved.label}`}
    >
      <Icon size={small ? 12 : 14} />
      <span>{resolved.label}</span>
    </span>
  );
}
