import test from 'node:test';
import assert from 'node:assert/strict';
import { pdfFromJpegPages, momentPdfFilename, PDF_PAGE_HEIGHT, PDF_PAGE_WIDTH } from './pdfDocument.js';

const jpeg = new Uint8Array([255, 216, 255, 224, 5, 6, 255, 217]);
const ascii = (bytes) => Buffer.from(bytes).toString('latin1');

test('Moment PDF export constructs a downloadable multi-page binary PDF with correct byte offsets', async () => {
  const result = pdfFromJpegPages([{ width: 981, height: 1389, bytes: jpeg }, { width: 981, height: 1389, bytes: jpeg }]);
  assert.equal(result.type, 'application/pdf');
  const bytes = new Uint8Array(await result.arrayBuffer());
  const source = ascii(bytes);
  assert.ok(source.startsWith('%PDF-1.4\n'));
  assert.match(source, /\/Count 2/);
  assert.equal(source.split('/Subtype /Image').length - 1, 2);
  assert.match(source, /\/MediaBox \[0 0 595 842\]/);
  assert.match(source, /startxref\n\d+\n%%EOF/);
  assert.ok(PDF_PAGE_WIDTH === 595 && PDF_PAGE_HEIGHT === 842);
  const xrefStart = Number(source.match(/startxref\n(\d+)\n%%EOF/)[1]);
  assert.equal(source.slice(xrefStart, xrefStart + 7), 'xref\n0 ');
  const objects = [...source.matchAll(/(?:^|\n)(\d+) 0 obj\n/g)];
  const xref = source.slice(xrefStart).split('\n');
  assert.equal(objects.length, 8);
  for (const object of objects) {
    const id = Number(object[1]);
    const offset = Number(xref[2 + id].slice(0, 10));
    assert.equal(bytes[offset], String(id).charCodeAt(0), `object ${id} must begin at its declared byte offset`);
  }
});

test('Moment PDF names remain usable across platforms without path injection', () => {
  assert.equal(momentPdfFilename('Weekend in Ooty'), 'Weekend-in-Ooty-summary.pdf');
  assert.equal(momentPdfFilename('..\\folder/x:y?z*'), '..-folder-x-y-z-summary.pdf');
  assert.equal(momentPdfFilename(''), 'moment-summary.pdf');
  assert.throws(() => pdfFromJpegPages([]), /no summary pages/);
  assert.throws(() => pdfFromJpegPages([{ width: 100, height: 100, bytes: new Uint8Array([1,2,3,4]) }]), /not a valid JPEG/);
});
