import { plainRichText, renderRichTextHtml } from './richText.js';

// A small, controlled vocabulary keeps preview and exported HTML in sync.
export const greetingToneFromType = (momentType = '') => {
  const type = String(momentType || '').toLowerCase();
  if (/wedding|marriage|anniversary|engagement|love/.test(type)) return 'romance';
  if (/birthday|celebration|party|festival/.test(type)) return 'celebration';
  if (/travel|vacation|trip|journey/.test(type)) return 'journey';
  return 'classic';
};

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

// Styles are bundled application CSS, never user input. User content is escaped
// and its restricted formatting goes through the same renderer as the app.
export const createGreetingCardHtml = ({ title, body, momentName = '', momentType = '', dateLabel = '' }, styles = '') => {
  const plainTitle = plainRichText(title) || 'Your greeting title';
  const tone = greetingToneFromType(momentType);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(plainTitle)}</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#0c1422;font-family:Inter,system-ui,sans-serif}.dn-greeting-card{max-width:680px}${styles}</style></head><body><article class="dn-greeting-card dn-greeting-card--${tone}" aria-label="Greeting card"><div class="dn-greeting-card-frame"><span class="dn-greeting-card-kicker">✧ A moment to celebrate</span><div class="dn-greeting-card-message"><h2>${escapeHtml(plainTitle)}</h2><div class="dn-rich-text dn-greeting-card-body">${renderRichTextHtml(body || 'Your message will appear here.')}</div></div><footer class="dn-greeting-card-footer"><div><strong>${escapeHtml(momentName || 'A special moment')}</strong><span>${escapeHtml([momentType, dateLabel].filter(Boolean).join(' · '))}</span></div><span class="dn-greeting-card-signature">DN</span></footer></div></article></body></html>`;
};
