import test from 'node:test';
import assert from 'node:assert/strict';
import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { EditorState, Plugin, TextSelection } from '@tiptap/pm/state';
import { history, undo } from '@tiptap/pm/history';
import { editorDocumentToNote, noteToEditorDocument } from './richTextDocument.js';
import { hasNoteText, pastePlainNoteText } from './documentEditing.js';

const schema = getSchema([StarterKit]);
const open = (note, from, to = from, plugins = []) => {
  const doc = schema.nodeFromJSON(noteToEditorDocument(note));
  return EditorState.create({ doc, selection: TextSelection.create(doc, from, to), plugins });
};
test('multiline paste replaces selection once and preserves surrounding text and literal HTML', () => {
  const state = open('Before SELECT after', 8, 14);
  const transaction = pastePlainNoteText(state, 'First\r\n<script>literal</script>\nThird');
  const result = state.apply(transaction);
  assert.equal(editorDocumentToNote(result.doc.toJSON()), 'Before First\n<script>literal</script>\nThird after');
  assert.equal(transaction.docChanged, true);
});
test('pasting multiple lines inside a list produces compatible list items', () => {
  const state = open('- Before after', 10);
  const result = state.apply(pastePlainNoteText(state, 'First\nSecond'));
  assert.equal(editorDocumentToNote(result.doc.toJSON()), '- Before First\n- Secondafter');
});
test('a length rejection keeps the whole original document and an accepted paste undoes once', () => {
  const state = open('Original', 9, 9, [history()]);
  const paste = pastePlainNoteText(state, '\nOne\nTwo');
  const limit = 10;
  assert.ok(editorDocumentToNote(paste.doc.toJSON()).length > limit);
  const guarded = open('Original', 9, 9, [new Plugin({ filterTransaction: (transaction) => editorDocumentToNote(transaction.doc.toJSON()).length <= limit })]);
  const blocked = guarded.applyTransaction(pastePlainNoteText(guarded, '\nOne\nTwo'));
  assert.equal(blocked.transactions.length, 0);
  assert.equal(blocked.state.doc.textContent, 'Original');
  let result = state.apply(paste);
  assert.equal(undo(result, (transaction) => { result = result.apply(transaction); }), true);
  assert.equal(editorDocumentToNote(result.doc.toJSON()), 'Original');
});
test('required notes need visible text even when an empty heading or list has stored markers', () => {
  for (const note of ['', '- ', '> ', '   ']) assert.equal(hasNoteText(schema.nodeFromJSON(noteToEditorDocument(note))), false);
  assert.equal(hasNoteText(schema.nodes.doc.create(null, schema.nodes.heading.create({ level: 3 }))), false);
  assert.equal(hasNoteText(schema.nodeFromJSON(noteToEditorDocument('**Visit at 9:00AM**'))), true);
});
