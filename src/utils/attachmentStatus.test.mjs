import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTACHMENT_STATUS_OPTIONS,
  getAttachmentLinkLabel,
  getAttachmentStatus,
  getAttachmentHealthSummary,
  getAttachmentTypeLabel,
  sortAttachmentsForGallery,
} from './attachmentStatus.js';

test('attachment status labels are stable and cover the expected states', () => {
  assert.deepEqual(ATTACHMENT_STATUS_OPTIONS.map((entry) => entry.value), ['available', 'on-device', 'reference-only', 'unavailable']);
  assert.equal(getAttachmentStatus({ availability: 'local-copy' }).value, 'unavailable');
  assert.equal(getAttachmentStatus({ availability: 'local-copy', hasLocalCopy: true }).value, 'on-device');
  assert.equal(getAttachmentStatus({ availability: 'local-copy', hasLocalCopy: false, fileReference: 'https://example.test/file.pdf' }).value, 'reference-only');
  assert.equal(getAttachmentStatus({ availability: 'reference', fileReference: 'https://example.test/file.pdf' }).value, 'reference-only');
  assert.equal(getAttachmentStatus({ availability: 'unavailable', fileReference: '' }).value, 'unavailable');
  assert.equal(getAttachmentStatus({ availability: 'available', fileReference: 'https://example.test/file.pdf' }).value, 'available');
  assert.equal(getAttachmentStatus({ availability: 'available' }).value, 'unavailable');
  assert.equal(getAttachmentStatus({ availability: 'reference', fileReference: 'not a URL' }).value, 'unavailable');
  assert.equal(getAttachmentStatus({ availability: 'local-copy', hasLocalCopy: false }).value, 'unavailable');
  assert.equal(getAttachmentStatus({ availability: 'reference', hasLocalCopy: true }).value, 'on-device');
});

test('attachment links report the correct relationship wording', () => {
  assert.equal(getAttachmentLinkLabel([]), 'Not linked');
  assert.equal(getAttachmentLinkLabel(['moment']), 'Moment');
  assert.equal(getAttachmentLinkLabel(['activity']), 'Activity');
  assert.equal(getAttachmentLinkLabel(['moment', 'activity']), 'Moment + Activity');
});

test('attachment health summary counts each status accurately', () => {
  const summary = getAttachmentHealthSummary([
    { availability: 'local-copy', hasLocalCopy: true },
    { availability: 'reference', fileReference: 'https://example.test/receipt.pdf' },
    { availability: 'unavailable' },
    { availability: 'local-copy', hasLocalCopy: true },
  ]);

  assert.deepEqual(summary, {
    available: 0,
    onDevice: 2,
    referenceOnly: 1,
    unavailable: 1,
    total: 4,
  });
});

test('gallery type labels and type sorting are stable', () => {
  assert.equal(getAttachmentTypeLabel({ mimeType: 'image/jpeg' }), 'Image');
  assert.equal(getAttachmentTypeLabel({ mimeType: 'application/pdf' }), 'PDF');
  const sorted = sortAttachmentsForGallery([
    { name: 'Notes.txt', mimeType: 'text/plain' },
    { name: 'Photo.jpg', mimeType: 'image/jpeg' },
    { name: 'Receipt.pdf', mimeType: 'application/pdf' },
  ], 'type');
  assert.deepEqual(sorted.map((attachment) => attachment.name), ['Notes.txt', 'Photo.jpg', 'Receipt.pdf']);
});
