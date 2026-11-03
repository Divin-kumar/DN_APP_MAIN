/*
 * DN searchable PDF text layer.
 *
 * The existing JPEG page remains the full visual source. These PDF glyphs are
 * invisible (text rendering mode 3), with a ToUnicode mapping for exact copy
 * and search of source text, including Tamil and emojis. No OCR, network fonts,
 * PDF.js dependency or mutation of Moment/Activity records is involved.
 *
 * This is NOT true vector typography, PDF/A or 300 dpi print output.
 */
const MAX_CODES_PER_FONT = 223; // Printable 8-bit PDF character codes 0x20..0xFE.
const MAX_RUNS_PER_PAGE = 8000;
const MAX_CHARS_PER_PAGE = 160000;

const utf16Hex = (string) => {
  const codes = [];
  for (let i = 0; i < string.length; i += 1) {
    const code = string.charCodeAt(i);
    codes.push(code.toString(16).padStart(4, '0').toUpperCase());
  }
  return codes.join('');
};
const hexByte = (value) => value.toString(16).padStart(2, '0').toUpperCase();
const pdfNumber = (value) => Math.round(value * 1000) / 1000;

const cmapFor = (mapping, index) => {
  const entries = [...mapping.entries()];
  const lines = [
    '/CIDInit /ProcSet findresource begin', '12 dict begin', 'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /DNUnicode' + index + ' def', '/CMapType 2 def',
    '1 begincodespacerange', '<00> <FF>', 'endcodespacerange',
  ];
  for (let start = 0; start < entries.length; start += 100) {
    const group = entries.slice(start, start + 100);
    lines.push(group.length + ' beginbfchar');
    for (const [symbol, code] of group) {
      lines.push('<' + hexByte(code) + '> <' + utf16Hex(symbol) + '>');
    }
    lines.push('endbfchar');
  }
  lines.push(
    'endcmap', 'CMapName currentdict /CMap defineresource pop',
    'end', 'end',
  );
  return lines.join('\n') + '\n';
};

/**
 * Accepts text actually drawn by MomentPdfPainter, in page draw order.
 * Each run: { text, x, y, size, width }. Coordinates are A4 PDF points
 * measured from the top-left. Never derive search text from unrelated records.
 */
export function buildSearchableOverlay(textRuns = [], pageHeight = 842) {
  if (!Array.isArray(textRuns) || textRuns.length > MAX_RUNS_PER_PAGE) {
    throw new Error('Too much PDF text for the searchable preview.');
  }
  const fonts = [];
  const symbols = new Map();
  let total = 0;
  const lines = [];

  const mapSymbol = (symbol) => {
    if (symbols.has(symbol)) return symbols.get(symbol);
    let mapping = fonts[fonts.length - 1];
    if (!mapping || mapping.size >= MAX_CODES_PER_FONT) {
      mapping = new Map();
      fonts.push(mapping);
    }
    const item = { font: fonts.length - 1, code: mapping.size + 32 };
    mapping.set(symbol, item.code);
    symbols.set(symbol, item);
    return item;
  };

  for (const run of textRuns) {
    const text = String(run?.text ?? '');
    if (!text) continue;
    const glyphs = Array.from(text);
    total += glyphs.length;
    if (total > MAX_CHARS_PER_PAGE) {
      throw new Error('Too much PDF text for the searchable preview.');
    }
    const x = Number(run.x), y = Number(run.y), size = Number(run.size);
    if (![x, y, size].every(Number.isFinite) || size <= 0) continue;
    // Text is encoded as hexadecimal and can never be interpreted as PDF ops.
    // A rare >223-character Unicode alphabet may require more than one font.
    const annotated = glyphs.map((glyph) => ({ glyph, ...mapSymbol(glyph) }));
    let start = 0;
    while (start < annotated.length) {
      const font = annotated[start].font;
      let end = start + 1;
      while (end < annotated.length && annotated[end].font === font) end += 1;
      const chunk = annotated.slice(start, end);
      const bytes = chunk.map(({ code }) => hexByte(code)).join('');
      const width = Number.isFinite(Number(run.width)) ? Number(run.width)
        : glyphs.length * size * .5;
      // This only affects selection hit boxes, never the visible page.
      const offset = width * start / glyphs.length;
      const positionX = pdfNumber(x + offset);
      const positionY = pdfNumber(pageHeight - y - size);
      lines.push(
        'BT /F' + font + ' ' + pdfNumber(size)
        + ' Tf 3 Tr 1 0 0 1 ' + positionX + ' ' + positionY
        + ' Tm <' + bytes + '> Tj ET',
      );
      start = end;
    }
  }
  return {
    cmaps: fonts.map((font, index) => cmapFor(font, index)),
    drawing: lines.join('\n') + (lines.length ? '\n' : ''),
    textRuns: lines.length,
  };
}
