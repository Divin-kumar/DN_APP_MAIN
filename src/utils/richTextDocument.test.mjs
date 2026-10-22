import test from 'node:test';
import assert from 'node:assert/strict';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ListItem } from '@tiptap/extension-list';
import Code from '@tiptap/extension-code';
import { noteToEditorDocument, editorDocumentToNote } from './richTextDocument.js';

const text = (value, marks = []) => ({ type: 'text', text: value, ...(marks.length ? { marks: marks.map((type) => ({ type })) } : {}) });
const paragraph = (...content) => ({ type: 'paragraph', ...(content.length ? { content } : {}) });
const document = (...content) => ({ type: 'doc', content });

test('unchanged notes retain exact whitespace, line endings, blank lines and literal HTML', () => {
  for (const original of ['', '  ', '\n\n', '\r\n  5:30 Today’s test ❤️\r\n\r\n9AM – 24/Sept/2026  \r\n',
    '<script>alert(1)</script>\n<img src=x>\n[example](https://example.com)\n![image](x)',
    '+  odd list marker\r\n- second\rquote\n', '# Heading\n## Smaller\n### Smallest\n>quote\n7. first\n42. second']) {
    const doc = noteToEditorDocument(original);
    assert.equal(editorDocumentToNote(JSON.parse(JSON.stringify(doc)), original), original);
  }
  assert.deepEqual(noteToEditorDocument(' <img src=x>  '), document(paragraph(text(' <img src=x>  '))));
});

test('supported marks, headings, quotes and list start decode to the allowed document shape', () => {
  const doc = noteToEditorDocument('**bold** *italic* ~~old~~ `5:30`\n## Visit\n> Keep this\n+ One\n- Two\n7. First\n8. Next');
  assert.deepEqual(doc, document(
    paragraph(text('bold', ['bold']), text(' '), text('italic', ['italic']), text(' '), text('old', ['strike']), text(' '), text('5:30', ['code'])),
    { type: 'heading', attrs: { level: 4 }, content: [text('Visit')] },
    { type: 'blockquote', content: [paragraph(text('Keep this'))] },
    { type: 'bulletList', content: ['One', 'Two'].map((value) => ({ type: 'listItem', content: [paragraph(text(value))] })) },
    { type: 'orderedList', attrs: { start: 7 }, content: ['First', 'Next'].map((value) => ({ type: 'listItem', content: [paragraph(text(value))] })) },
  ));
  const serialized = editorDocumentToNote(doc);
  assert.equal(serialized, '**bold** *italic* ~~old~~ `5:30`\n## Visit\n> Keep this\n- One\n- Two\n7. First\n8. Next');
  assert.deepEqual(noteToEditorDocument(serialized), doc);
});

test('editing one block retains exact source syntax of all untouched blocks and CRLF', () => {
  const original = '#   Heading\r\n+  First\r\n- Second  \r\n\r\n>quote\r\n  5:30  ';
  const doc = noteToEditorDocument(original);
  doc.content.at(-1).content[0].text = '  9:30  ';
  assert.equal(editorDocumentToNote(doc, original), original.replace('5:30', '9:30'));
  doc.content.splice(2, 0, paragraph(text('Inserted')));
  assert.equal(editorDocumentToNote(doc, original), '#   Heading\r\n+  First\r\n- Second  \r\nInserted\r\n\r\n>quote\r\n  9:30  ');
});

test('duplicate blocks keep source syntax when their neighboring copy is changed', () => {
  const original = '>same\n> same';
  const doc = noteToEditorDocument(original);
  doc.content[0].content[0].content[0].text = 'changed';
  assert.equal(editorDocumentToNote(doc, original), '> changed\n> same');
});

test('equivalent text runs, mark ordering and default ordered-list attributes preserve original', () => {
  const original = '**bold word**\n3.  item';
  const doc = noteToEditorDocument(original);
  doc.content[0].content = [text('bold', ['bold']), text(' word', ['bold'])];
  doc.content[1].attrs.type = null;
  assert.equal(editorDocumentToNote(doc, original), original);
  const nested = noteToEditorDocument('**bold ~~old~~ text**');
  nested.content[0].content[1].marks.reverse();
  assert.equal(editorDocumentToNote(nested, '**bold ~~old~~ text**'), '**bold ~~old~~ text**');
});

test('changed blocks use current syntax, retain literal characters and do not add blank lines', () => {
  assert.equal(editorDocumentToNote(document(paragraph(text('# literal * unclosed ` 5:30 <b>text</b>')))), '# literal * unclosed ` 5:30 <b>text</b>');
  assert.equal(editorDocumentToNote(document(
    { type: 'heading', attrs: { level: 3 }, content: [text('Heading')] },
    { type: 'blockquote', content: [paragraph(text('first')), paragraph(text('second'))] },
    paragraph(), paragraph(text('End', ['bold'])),
  )), '# Heading\n> first\n> second\n\n**End**');
  const original = 'First\rSecond';
  const doc = noteToEditorDocument(original);
  doc.content.push(paragraph(text('Third')));
  assert.equal(editorDocumentToNote(doc, original), 'First\rSecond\rThird');
});

test('bold and italic round-trip together with overlapping marked text runs', () => {
  const doc = document(paragraph(text('Visit', ['bold', 'italic']), text(' at '), text('5:30', ['code'])));
  const note = editorDocumentToNote(doc);
  assert.equal(note, '***Visit*** at `5:30`');
  assert.deepEqual(noteToEditorDocument(note), doc);
  const overlapping = document(paragraph(text('Before ', ['bold']), text('inside', ['bold', 'italic']), text(' after', ['bold'])));
  assert.deepEqual(noteToEditorDocument(editorDocumentToNote(overlapping)), overlapping);
});

test('unsupported structures, nesting, attributes and marks fail explicitly', () => {
  const invalid = [
    { type: 'image', attrs: { src: 'x' } }, { type: 'codeBlock' }, { type: 'hardBreak' },
    { type: 'heading', attrs: { level: 1 }, content: [text('Title')] },
    { type: 'paragraph', attrs: { align: 'center' }, content: [text('Text')] },
    { type: 'paragraph', text: 'Invalid container text' }, { type: 'paragraph', marks: { type: 'bold' } },
    paragraph(text('Link', ['link'])), paragraph({ type: 'hardBreak' }),
    { type: 'blockquote', content: [{ type: 'blockquote', content: [paragraph(text('Nested'))] }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph(text('First')), paragraph(text('Second'))] }] },
    { type: 'orderedList', attrs: { start: -1 }, content: [{ type: 'listItem', content: [paragraph(text('Item'))] }] },
  ];
  for (const block of invalid) assert.throws(() => editorDocumentToNote(document(block)), /Unsupported note document/);
  assert.throws(() => editorDocumentToNote(paragraph(text('Wrong root'))), /Unsupported note document/);
});

test('real Tiptap schema defaults and mark ordering preserve all supported note content', () => {
  const schema = getSchema([
    StarterKit.configure({ heading: { levels: [3, 4, 5] }, code: false, hardBreak: false,
      codeBlock: false, horizontalRule: false, link: false, underline: false,
      listItem: false, listKeymap: false, trailingNode: false }),
    ListItem, Code.extend({ excludes: '' }),
  ]);
  const original = '  5:30 <img src=x>  \r\n\r\n#   Heading\r\n## Smaller\r\n### Smallest\r\n***both*** **`code`** ~~old~~ *italic*\r\n>quote\r\n+  Item\r\n- Next\r\n7.  Start\r\n8. End\r\n';
  const actual = schema.nodeFromJSON(noteToEditorDocument(original));
  assert.doesNotThrow(() => actual.check());
  const json = actual.toJSON();
  assert.equal(json.content.find((node) => node.type === 'orderedList').attrs.type, null);
  assert.equal(editorDocumentToNote(json, original), original);
  json.content[0].content[0].text += 'added';
  const changed = schema.nodeFromJSON(json);
  assert.doesNotThrow(() => changed.check());
  assert.equal(editorDocumentToNote(changed.toJSON(), original), original.replace('  5:30 <img src=x>  ', '  5:30 <img src=x>  added'));
});
