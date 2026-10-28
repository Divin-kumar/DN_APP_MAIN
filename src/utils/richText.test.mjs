import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTextFormat, parseInlineRichText, parseRichText, plainRichText, renderRichTextHtml } from './richText.js';
import { normalizeFinancialRecord } from './financialRecords.js';
import { filterTransactions, transactionPayload } from './transactionFilters.js';
import { normalizeActivityExpense } from './transactionRelations.js';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createBackupDocument, parseBackupDocument, buildEventGroupsFromBackup } from '../services/backupService.js';
import { DEFAULT_CODE_LISTS } from './codeLists.js';

test('ordinary notes keep whitespace, dates, punctuation and literal HTML as text', () => {
  const original = '  5:30 Today’s test ❤️\n\n9AM  –  24/Sept/2026\n<script>alert(1)</script>  ';
  assert.equal(plainRichText(original), original);
  assert.equal(parseRichText(original).length, 4);
  const html = renderRichTextHtml(original);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.deepEqual(parseInlineRichText('ordinary **unclosed'), [{ type: 'text', text: 'ordinary **unclosed' }]);
});

test('supported formatting produces only the restricted escaped HTML vocabulary', () => {
  const note = '## Clinic\n- **Blood test**\n- *Tablets*\n1. Ask doctor\n2. `5:30`\n> Keep ~~old~~ notes\n<img src=x onerror=alert(1)>\n[bad](javascript:alert(1))';
  const html = renderRichTextHtml(note);
  assert.match(html, /<h4>Clinic<\/h4>/);
  assert.match(html, /<ul><li><strong>Blood test<\/strong><\/li><li><em>Tablets<\/em><\/li><\/ul>/);
  assert.match(html, /<ol start="1"><li>Ask doctor<\/li><li><code>5:30<\/code><\/li><\/ol>/);
  assert.match(html, /<blockquote>Keep <del>old<\/del> notes<\/blockquote>/);
  assert.ok(!html.includes('<img') && !html.includes('<a '));
  assert.ok(plainRichText(note).includes('• Blood test\n• Tablets\n1. Ask doctor\n2. 5:30'));
});

test('transaction search matches the visible phrase across note formatting markers', () => {
  const record = { id: 'expense', transactionKind: 'expense', notes: '**Blood** test at *5:30*', amount: 20 };
  assert.deepEqual(filterTransactions([record], { search: 'blood test' }), [record]);
  assert.equal(record.notes, '**Blood** test at *5:30*');
});

test('bold and italic combine without exposing delimiters or interpreting literal HTML', () => {
  const original = '***5:30 <b>Visit</b>*** and **bold** *italic* `code`';
  assert.deepEqual(parseInlineRichText('***Visit***'), [{ type: 'strong', children: [{ type: 'em', children: [{ type: 'text', text: 'Visit' }] }] }]);
  assert.equal(plainRichText(original), '5:30 <b>Visit</b> and bold italic code');
  assert.match(renderRichTextHtml(original), /<strong><em>5:30 &lt;b&gt;Visit&lt;\/b&gt;<\/em><\/strong>/);
  assert.equal(renderRichTextHtml('ordinary *unclosed <img src=x>'), '<div style="white-space:pre-wrap;min-height:1em">ordinary *unclosed &lt;img src=x&gt;</div>');
});

test('formatting selected text is reversible and preserves all surrounding authored content', () => {
  const original = '  5:30 test\nkeep this  ';
  const formatted = applyTextFormat(original, 7, 11, 'bold');
  assert.equal(formatted.value, '  5:30 **test**\nkeep this  ');
  assert.equal(formatted.value.slice(formatted.start, formatted.end), 'test');
  assert.equal(applyTextFormat(formatted.value, formatted.start, formatted.end, 'bold').value, original);
  assert.equal(applyTextFormat(original, 0, 0, 'unknown').value, original);
});

test('list actions cover selected complete lines and toggle without losing original text', () => {
  const original = 'Blood test\nTablets\nUntouched';
  const formatted = applyTextFormat(original, 0, 17, 'bullet');
  assert.equal(formatted.value, '- Blood test\n- Tablets\nUntouched');
  assert.equal(applyTextFormat(formatted.value, formatted.start, formatted.end, 'bullet').value, original);
  assert.equal(applyTextFormat('\nline', 0, 0, 'heading').value, '## \nline');
});

test('inline formatting spans selected lines without swallowing bullets or line breaks', () => {
  for (const command of ['bold', 'italic', 'strike', 'code']) {
    const original = '- Blood test\n- Tablets\n\n5:30';
    const formatted = applyTextFormat(original, 0, original.length, command);
    const html = renderRichTextHtml(formatted.value);
    const tag = { bold: 'strong', italic: 'em', strike: 'del', code: 'code' }[command];
    assert.ok(html.includes(`<ul><li><${tag}>Blood test</${tag}></li><li><${tag}>Tablets</${tag}></li></ul>`));
    assert.equal(plainRichText(formatted.value), '• Blood test\n• Tablets\n\n5:30');
    assert.equal(applyTextFormat(formatted.value, formatted.start, formatted.end, command).value, original);
  }
});

test('financial note normalization keeps the original multiline string', () => {
  const notes = '\n  **Tablets**\n- 5:30\n\n';
  const record = normalizeFinancialRecord({ id: 'note-record', name: 'Test', notes, description: notes });
  assert.equal(record.notes, notes);
  assert.equal(record.description, notes);
  const payload = transactionPayload({ title: 'Test', amount: 20, notes, transactionKind: 'expense', paymentMethod: 'Cash' });
  assert.equal(payload.notes, notes);
  assert.equal(payload.description, notes);
  const mirror = normalizeActivityExpense({ ...payload, id: 'note-record' });
  assert.equal(mirror.notes, notes);
  assert.equal(mirror.description, notes);
});

test('backup and restore retain authored Markdown and whitespace for every note domain', () => {
  const notes = '\n  **Blood test** at 5:30\n- Tablets\n\n';
  const backup = createBackupDocument({ moments: [{ id: 'moment', name: 'Moment', date: '2026-10-22', notes,
    greetingCard: { title: 'Greeting', body: notes }, activities: [{ id: 'activity', title: 'Test', description: notes, date: '2026-10-22' }],
    memories: [{ id: 'memory', title: 'Memory', body: notes }] }],
    expenses: [normalizeFinancialRecord({ id: 'expense', name: 'Test', amount: 20, date: '2026-10-22', notes,
      eventId: 'moment', activityId: 'activity' })], codeLists: DEFAULT_CODE_LISTS });
  const parsed = parseBackupDocument(JSON.parse(JSON.stringify(backup)));
  const [moment] = buildEventGroupsFromBackup(parsed);
  assert.equal(moment.notes, notes);
  assert.equal(moment.greetingCard.body, notes);
  assert.equal(moment.activities[0].description, notes);
  assert.equal(moment.memories[0].body, notes);
  assert.equal(parsed.expenses[0].notes, notes);
  assert.equal(moment.activities[0].expenses[0].notes, notes);
});

test('the actual React note renderer styles lists and never interprets user HTML', async (t) => {
  const server = await createServer({ configFile: false, envFile: false, esbuild: { jsx: 'automatic' },
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } } });
  t.after(() => server.close());
  const { default: RichText } = await server.ssrLoadModule('/src/components/common/RichText.jsx');
  const html = renderToStaticMarkup(createElement(RichText, { value: '## Notes\n- **Blood test**\n- <img src=x onerror=alert(1)>\n5:30' }));
  assert.match(html, /<h4>Notes<\/h4>/);
  assert.match(html, /<ul><li><strong>Blood test<\/strong><\/li><li>&lt;img/);
  assert.ok(!html.includes('<img '));
  assert.match(html, /dn-rich-text-line">5:30/);
});
