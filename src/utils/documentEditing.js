import { Fragment, Slice } from '@tiptap/pm/model';

// One transaction makes a paste fully undoable and lets compatibility/length
// guards accept or reject the whole paste, never only some of its lines.
export function pastePlainNoteText(state, text) {
  const value = String(text).replace(/\r\n|\r/g, '\n');
  if (!value.includes('\n')) return state.tr.insertText(value).scrollIntoView();
  const { $from } = state.selection;
  const marks = state.storedMarks || $from.marks();
  const paragraphs = value.split('\n').map((line) => state.schema.nodes.paragraph.create(null,
    line ? state.schema.text(line, marks) : null));
  const inList = $from.depth > 1 && $from.node($from.depth - 1).type.name === 'listItem';
  const blocks = inList ? paragraphs.map((paragraph) => state.schema.nodes.listItem.create(null, paragraph)) : paragraphs;
  const depth = inList ? 2 : 1;
  return state.tr.replaceSelection(new Slice(Fragment.from(blocks), depth, depth)).scrollIntoView();
}

export function hasNoteText(doc) {
  return Boolean(doc?.textContent?.trim());
}
