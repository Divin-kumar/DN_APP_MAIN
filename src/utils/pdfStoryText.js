import { plainRichText } from './richText.js';

// Some older Moments contain editor-produced HTML fragments even though DN's
// current rich-text editor uses Markdown. For PDFs only, normalize a small,
// explicitly allowed set of formatting tags as *text*, never as executable HTML.
// Other markup remains literal, as in DN's existing safe text rendering.
const FORMAT_TAG = /<\/?(?:p|div|ul|ol|li|b|strong|i|em|h[1-6])\b[^>]*>/gi;
const HAS_LEGACY_HTML = /<\/?(?:p|div|br|ul|ol|li|b|strong|i|em|h[1-6])\b/i;
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodeEntity = (_match, named, hex, decimal) => {
  if (named) return ENTITIES[named.toLowerCase()] ?? _match;
  const number = Number.parseInt(hex || decimal, hex ? 16 : 10);
  return Number.isInteger(number) && number > 0 && number <= 0x10FFFF
    && !(number >= 0xD800 && number <= 0xDFFF) ? String.fromCodePoint(number) : _match;
};
export const pdfStoryText = (value) => {
  const source = String(value ?? '');
  if (!HAS_LEGACY_HTML.test(source)) return plainRichText(source);
  const normalized = source
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '\n- ')
    .replace(/<\/\s*(?:p|div|ul|ol|li|h[1-6])\s*>/gi, '\n')
    .replace(FORMAT_TAG, '')
    .replace(/&(?:(amp|lt|gt|quot|apos|nbsp)|#x([0-9a-f]+)|#([0-9]+));/gi, decodeEntity)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return plainRichText(normalized);
};
