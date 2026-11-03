import { buildSearchableOverlay } from './pdfSearchableText.js';
// Minimal binary PDF assembler for A4 JPEG-rendered summary pages.
// Unlike HTML/text downloads, this produces a genuine application/pdf file.
// Keep byte offsets binary-safe: a PDF image is NOT a string or base64 document.
const encoder = new TextEncoder();
export const PDF_PAGE_WIDTH = 595;
export const PDF_PAGE_HEIGHT = 842;

export function pdfFromJpegPages(pages, { searchableText = false } = {}) {
  if (!Array.isArray(pages) || !pages.length) throw new Error('There are no summary pages to export.');
  if (searchableText) return searchablePdfFromJpegPages(pages);
  const parts = [];
  let length = 0;
  const offsets = [0];
  const append = (part) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    parts.push(bytes);
    length += bytes.byteLength;
  };
  append(encoder.encode('%PDF-1.4\n'));
  append(new Uint8Array([37, 0xD0, 0xD1, 0xD2, 0xD3, 10]));
  const writeObject = (id, body) => {
    offsets[id] = length;
    append(`${id} 0 obj\n`);
    for (const part of body) append(part);
    append('\nendobj\n');
  };
  const refs = pages.map((_, index) => `${3 + 3 * index} 0 R`).join(' ');
  writeObject(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  writeObject(2, [`<< /Type /Pages /Kids [${refs}] /Count ${pages.length} >>`]);
  pages.forEach((page, index) => {
    const id = 3 + 3 * index;
    const jpeg = page.bytes instanceof Uint8Array ? page.bytes : new Uint8Array(page.bytes);
    if (jpeg.length < 4 || jpeg[0] !== 0xFF || jpeg[1] !== 0xD8 || jpeg.at(-2) !== 0xFF || jpeg.at(-1) !== 0xD9) {
      throw new Error('A rendered summary page is not a valid JPEG.');
    }
    const width = Math.round(page.width), height = Math.round(page.height);
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
      throw new Error('Invalid PDF page dimensions.');
    }
    writeObject(id, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`]);
    writeObject(id + 1, [`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.byteLength} >>\nstream\n`, jpeg, '\nendstream']);
    const drawing = encoder.encode(`q\n${PDF_PAGE_WIDTH} 0 0 ${PDF_PAGE_HEIGHT} 0 0 cm\n/Im0 Do\nQ\n`);
    writeObject(id + 2, [`<< /Length ${drawing.byteLength} >>\nstream\n`, drawing, '\nendstream']);
  });
  const xrefStart = length;
  append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let id = 1; id < offsets.length; id += 1) {
    append(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }
  append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

export function momentPdfFilename(name) {
  const root = String(name || 'moment').normalize('NFKC').replace(/[\\/<>:"|?*]/g, '-').replace(/\p{Cc}/gu, '-')
    .replace(/\s+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);
  return `${root || 'moment'}-summary.pdf`;
}

/*
 * Experimental Unicode-searchable hybrid: exact same JPEG visual pages,
 * plus an invisible text layer with a per-page ToUnicode CMap. The standard
 * legacy path above stays byte-for-byte unchanged.
 */
function searchablePdfFromJpegPages(pages) {
  const blocks = [];
  let length = 0;
  const offsets = [0];
  const append = (value) => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    blocks.push(bytes);
    length += bytes.byteLength;
  };
  const writeObject = (id, contents) => {
    offsets[id] = length;
    append(`${id} 0 obj\n`);
    for (const piece of contents) append(piece);
    append('\nendobj\n');
  };
  const pagesWithRefs = [];
  let nextId = 3;
  for (const page of pages) {
    const jpeg = page.bytes instanceof Uint8Array ? page.bytes : new Uint8Array(page.bytes);
    if (jpeg.length < 4 || jpeg[0] !== 0xFF || jpeg[1] !== 0xD8
      || jpeg.at(-2) !== 0xFF || jpeg.at(-1) !== 0xD9) {
      throw new Error('A rendered summary page is not a valid JPEG.');
    }
    const width = Math.round(page.width), height = Math.round(page.height);
    if (![width, height].every((dimension) => Number.isSafeInteger(dimension) && dimension > 0)) {
      throw new Error('Invalid PDF page dimensions.');
    }
    const overlay = buildSearchableOverlay(page.textRuns || [], PDF_PAGE_HEIGHT);
    const pageId = nextId++, imageId = nextId++, contentId = nextId++;
    const fonts = overlay.cmaps.map((cmap) => ({ cmap, fontId: nextId++, cmapId: nextId++ }));
    pagesWithRefs.push({ pageId, imageId, contentId, fonts, overlay, jpeg, width, height });
  }
  append(encoder.encode('%PDF-1.4\n'));
  append(new Uint8Array([37, 0xD0, 0xD1, 0xD2, 0xD3, 10]));
  writeObject(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  writeObject(2, ['<< /Type /Pages /Kids ['
    + pagesWithRefs.map((page) => page.pageId + ' 0 R').join(' ')
    + '] /Count ' + pagesWithRefs.length + ' >>']);
  for (const page of pagesWithRefs) {
    const fontRefs = page.fonts.map(({ fontId }, index) => '/F' + index + ' ' + fontId + ' 0 R').join(' ');
    writeObject(page.pageId, [
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '
      + PDF_PAGE_WIDTH + ' ' + PDF_PAGE_HEIGHT
      + '] /Resources << /XObject << /Im0 ' + page.imageId
      + ' 0 R >> ' + (page.fonts.length ? '/Font << ' + fontRefs + ' >> ' : '')
      + '>> /Contents ' + page.contentId + ' 0 R >>',
    ]);
    writeObject(page.imageId, [
      '<< /Type /XObject /Subtype /Image /Width ' + page.width
      + ' /Height ' + page.height
      + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '
      + page.jpeg.byteLength + ' >>\nstream\n',
      page.jpeg, '\nendstream',
    ]);
    const drawing = encoder.encode(
      'q\n' + PDF_PAGE_WIDTH + ' 0 0 ' + PDF_PAGE_HEIGHT
      + ' 0 0 cm\n/Im0 Do\nQ\n' + page.overlay.drawing,
    );
    writeObject(page.contentId, [
      '<< /Length ' + drawing.byteLength + ' >>\nstream\n',
      drawing, '\nendstream',
    ]);
    for (const font of page.fonts) {
      writeObject(font.fontId, [
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica '
        + '/Encoding /WinAnsiEncoding /ToUnicode ' + font.cmapId + ' 0 R >>',
      ]);
      const bytes = encoder.encode(font.cmap);
      writeObject(font.cmapId, [
        '<< /Length ' + bytes.byteLength + ' >>\nstream\n',
        bytes, '\nendstream',
      ]);
    }
  }
  const xrefStart = length;
  append('xref\n0 ' + nextId + '\n0000000000 65535 f \n');
  for (let id = 1; id < nextId; id += 1) {
    append(String(offsets[id]).padStart(10, '0') + ' 00000 n \n');
  }
  append('trailer\n<< /Size ' + nextId + ' /Root 1 0 R >>\n'
    + 'startxref\n' + xrefStart + '\n%%EOF\n');
  return new Blob(blocks, { type: 'application/pdf' });
}
