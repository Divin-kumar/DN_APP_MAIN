import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSearchableOverlay } from './pdfSearchableText.js';
import { pdfFromJpegPages } from './pdfDocument.js';
import { normalizePdfStudioOptions } from './pdfStudioOptions.js';

const jpeg = new Uint8Array([255, 216, 255, 224, 5, 6, 255, 217]);
const txt = (buf) => Buffer.from(buf).toString('latin1');
const page = (text = 'Mini-oda Special Checkup ❤️ வணக்கம்') => ({
  width: 981, height: 1389, bytes: jpeg,
  textRuns: [{ text, x: 43, y: 130, size: 13, width: 400 }],
});

const xrefOffsets = (source) => {
  const pos = Number(source.match(/startxref\n(\d+)\n%%EOF/)[1]);
  const table = source.slice(pos);
  assert.ok(table.startsWith('xref\n0 '), 'xref must begin at its byte offset');
  const lines = table.split('\n');
  const count = Number(lines[1].slice(2));
  const objectCount = [...source.matchAll(/(?:^|\n)(\d+) 0 obj\n/g)].length;
  assert.equal(count - 1, objectCount);
  for (let id = 1; id < count; id += 1) {
    const offset = Number(lines[2 + id].slice(0, 10));
    assert.equal(source.slice(offset, offset + String(id).length), String(id),
      'PDF object ' + id + ' must start at its indexed offset');
  }
};

test('experimental searchable layer supports English, Tamil and emoji in ToUnicode', () => {
  const original = 'Mini-oda Special Checkup ❤️ வணக்கம்';
  const result = buildSearchableOverlay([{ text: original, x: 43, y: 120, size: 14, width: 380 }]);
  assert.equal(result.cmaps.length, 1);
  assert.match(result.drawing, /3 Tr/);
  assert.match(result.cmaps[0], /<2764>/); // Heart
  assert.match(result.cmaps[0], /<0B9[0-9A-F]>/); // Tamil
  assert.match(result.cmaps[0], /<FE0F>/); // Emoji variation selector
  assert.match(result.cmaps[0], /\/ToUnicode|begincmap/);
  assert.ok(result.drawing.includes('Tm <'));
});

test('searchable PDF retains exact page JPEG bytes, Unicode maps and valid xref', async () => {
  const pages = [page(), page('Chapter two · இனிய நாள்')];
  const pdf = pdfFromJpegPages(pages, { searchableText: true });
  assert.equal(pdf.type, 'application/pdf');
  const bytes = new Uint8Array(await pdf.arrayBuffer());
  const source = txt(bytes);
  assert.match(source, /^%PDF-1\.4\n/);
  assert.match(source, /\/Count 2/);
  assert.equal(source.split('/Subtype /Image').length - 1, 2);
  assert.equal(source.split('/ToUnicode').length - 1, 2);
  assert.equal(source.split('3 Tr').length - 1, 2);
  assert.ok(Buffer.from(bytes).includes(Buffer.from(jpeg)), 'Original preview JPEG must be embedded without alteration');
  xrefOffsets(source);
});

test('standard PDF ignores optional textRuns and retains original binary output', async () => {
  const withRuns = new Uint8Array(await pdfFromJpegPages([page()], { searchableText: false }).arrayBuffer());
  const withoutRuns = new Uint8Array(await pdfFromJpegPages([{
    width: 981, height: 1389, bytes: jpeg,
  }]).arrayBuffer());
  assert.deepEqual(withRuns, withoutRuns);
  assert.doesNotMatch(txt(withRuns), /\/ToUnicode|3 Tr/);
  xrefOffsets(txt(withRuns));
});

test('large Unicode alphabets create multiple bounded mapping fonts', () => {
  const chars = Array.from({ length: 270 }, (_, i) => String.fromCodePoint(0x3400 + i)).join('');
  const overlay = buildSearchableOverlay([{ text: chars, x: 43, y: 60, size: 11, width: 450 }]);
  assert.equal(overlay.cmaps.length, 2);
  assert.equal(overlay.textRuns, 2);
  assert.match(overlay.drawing, /\/F0 .*\/F1 /s);
  assert.ok(overlay.cmaps.every(cmap => [...cmap.matchAll(/ beginbfchar/g)].length >= 1));
});

test('invalid searchable input fails safely instead of creating broken PDFs', () => {
  assert.throws(() => buildSearchableOverlay('invalid'), /Too much/);
  assert.throws(() => buildSearchableOverlay(Array.from({ length: 8001 }, () => ({ text:'x' }))), /Too much/);
  assert.throws(() => pdfFromJpegPages([{ width: 200, height: 200,
    bytes: new Uint8Array([1,2,3,4]), textRuns: [{ text: 'x', x: 4, y: 10, size: 12 }] }], {
    searchableText: true,
  }), /valid JPEG/);
});

test('PDF Studio defaults to standard compatibility; searchable choice is opt-in', () => {
  assert.equal(normalizePdfStudioOptions().searchableText, false);
  assert.equal(normalizePdfStudioOptions({ searchableText: true }).searchableText, true);
  assert.equal(normalizePdfStudioOptions({ searchableText: 'true' }).searchableText, false);
});
