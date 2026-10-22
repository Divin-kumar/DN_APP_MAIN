import { parseRichText } from './richText.js';

const markNames = { strong: 'bold', em: 'italic', del: 'strike', code: 'code' };
const delimiters = { bold: '**', strike: '~~', italic: '*', code: '`' };
const markOrder = Object.keys(delimiters);
const fail = (message) => { throw new TypeError(`Unsupported note document: ${message}`); };

function appendText(content, text, marks) {
  if (!text) return;
  const previous = content.at(-1);
  const normalized = markOrder.filter((name) => marks.includes(name)).map((type) => ({ type }));
  if (previous && JSON.stringify(previous.marks || []) === JSON.stringify(normalized)) previous.text += text;
  else content.push({ type: 'text', text, ...(normalized.length ? { marks: normalized } : {}) });
}

function inlineContent(nodes, marks = [], content = []) {
  for (const node of nodes) {
    const nextMarks = node.type === 'text' ? marks : [...marks, markNames[node.type]];
    if (node.children) inlineContent(node.children, nextMarks, content);
    else appendText(content, node.text, nextMarks);
  }
  return content;
}

const paragraph = (nodes) => {
  const content = inlineContent(nodes);
  return { type: 'paragraph', ...(content.length ? { content } : {}) };
};

/** Decode the existing restricted Markdown string; user HTML remains text. */
export function noteToEditorDocument(value) {
  return { type: 'doc', content: parseRichText(value).map((block) => {
    if (block.type === 'heading') return { ...paragraph(block.children), type: 'heading', attrs: { level: block.level + 2 } };
    if (block.type === 'quote') return { type: 'blockquote', content: [paragraph(block.children)] };
    if (block.type === 'list') return {
      type: block.ordered ? 'orderedList' : 'bulletList',
      ...(block.ordered ? { attrs: { start: block.start } } : {}),
      content: block.items.map((item) => ({ type: 'listItem', content: [paragraph(item)] })),
    };
    return paragraph(block.children);
  }) };
}

function checkAttributes(node, allowed = []) {
  if (node.attrs !== undefined && (!node.attrs || typeof node.attrs !== 'object' || Array.isArray(node.attrs))) fail('invalid attributes');
  if (Object.keys(node.attrs || {}).some((key) => !allowed.includes(key))) fail(`attributes on ${node.type}`);
}

function children(node) {
  if (node.content !== undefined && !Array.isArray(node.content)) fail(`invalid content on ${node.type}`);
  return node.content || [];
}

function normalizeInline(node) {
  const content = [];
  for (const child of children(node)) {
    if (!child || child.type !== 'text' || typeof child.text !== 'string' || child.content !== undefined) fail('only text is allowed inside a paragraph');
    checkAttributes(child);
    if (child.marks !== undefined && !Array.isArray(child.marks)) fail('invalid marks');
    const marks = (child.marks || []).map((mark) => {
      if (!mark || !Object.hasOwn(delimiters, mark.type)) fail(`mark ${mark?.type}`);
      checkAttributes(mark);
      return mark.type;
    });
    appendText(content, child.text, marks);
  }
  return content.length ? { content } : {};
}

function normalizeBlock(node) {
  if (!node || typeof node !== 'object' || node.text !== undefined || (node.marks !== undefined && (!Array.isArray(node.marks) || node.marks.length))) fail('invalid block');
  if (node.type === 'paragraph') {
    checkAttributes(node);
    return { type: node.type, ...normalizeInline(node) };
  }
  if (node.type === 'heading') {
    checkAttributes(node, ['level']);
    if (![3, 4, 5].includes(node.attrs?.level)) fail('heading level');
    return { type: node.type, attrs: { level: node.attrs.level }, ...normalizeInline(node) };
  }
  if (node.type === 'blockquote') {
    checkAttributes(node);
    if (!children(node).length || children(node).some((child) => child?.type !== 'paragraph')) fail('blockquote must contain paragraphs');
    return { type: node.type, content: children(node).map(normalizeBlock) };
  }
  if (node.type === 'bulletList' || node.type === 'orderedList') {
    checkAttributes(node, node.type === 'orderedList' ? ['start', 'type'] : []);
    const start = node.attrs?.start ?? 1;
    if (node.type === 'orderedList' && (!Number.isSafeInteger(start) || start < 0 || node.attrs?.type != null)) fail('ordered list attributes');
    if (!children(node).length) fail('empty list');
    return { type: node.type, ...(node.type === 'orderedList' ? { attrs: { start } } : {}), content: children(node).map((item) => {
      if (item?.type !== 'listItem' || item.text !== undefined || (item.marks !== undefined && (!Array.isArray(item.marks) || item.marks.length))) fail('list item');
      checkAttributes(item);
      if (children(item).length !== 1 || item.content[0]?.type !== 'paragraph') fail('list items must contain one paragraph');
      return { type: 'listItem', content: [normalizeBlock(item.content[0])] };
    }) };
  }
  return fail(`block ${node.type}`);
}

function normalizeDocument(doc) {
  if (!doc || doc.type !== 'doc' || doc.text !== undefined || (doc.marks !== undefined && (!Array.isArray(doc.marks) || doc.marks.length))) fail('document root');
  checkAttributes(doc);
  return { type: 'doc', content: children(doc).map(normalizeBlock) };
}

function serializeInline(node) {
  let output = '';
  let active = [];
  for (const child of node.content || []) {
    const next = (child.marks || []).map((mark) => mark.type);
    let shared = 0;
    while (shared < active.length && active[shared] === next[shared]) shared += 1;
    output += active.slice(shared).reverse().map((mark) => delimiters[mark]).join('');
    output += next.slice(shared).map((mark) => delimiters[mark]).join('') + child.text;
    active = next;
  }
  return output + active.reverse().map((mark) => delimiters[mark]).join('');
}

function serializeBlock(block, newline) {
  if (block.type === 'paragraph') return serializeInline(block);
  if (block.type === 'heading') return `${'#'.repeat(block.attrs.level - 2)} ${serializeInline(block)}`;
  if (block.type === 'blockquote') return block.content.map((item) => `> ${serializeInline(item)}`).join(newline);
  return block.content.map((item, index) => `${block.type === 'orderedList' ? `${block.attrs.start + index}.` : '-'} ${serializeInline(item.content[0])}`).join(newline);
}

/** Keep existing strings/source blocks verbatim whenever their document content is unchanged. */
export function editorDocumentToNote(doc, original = '') {
  const normalized = normalizeDocument(doc);
  const source = String(original ?? '');
  const baseline = normalizeDocument(noteToEditorDocument(source));
  if (JSON.stringify(normalized) === JSON.stringify(baseline)) return source;
  const newline = source.match(/\r\n|\r|\n/)?.[0] || '\n';
  const lines = source.split(/\r\n|\r|\n/);
  const endings = [...source.matchAll(/\r\n|\r|\n/g)].map((match) => match[0]);
  let cursor = 0;
  const originals = baseline.content.map((block) => {
    const length = block.type === 'bulletList' || block.type === 'orderedList' ? block.content.length : 1;
    const start = cursor;
    cursor += length;
    return { key: JSON.stringify(block), source: lines.slice(start, cursor).map((line, index) => line + (index < length - 1 ? endings[start + index] : '')).join('') };
  });
  const keys = normalized.content.map((block) => JSON.stringify(block));
  const matches = new Map();
  let prefix = 0;
  while (prefix < Math.min(keys.length, originals.length) && keys[prefix] === originals[prefix].key) {
    matches.set(prefix, prefix);
    prefix += 1;
  }
  let end = keys.length - 1;
  let originalEnd = originals.length - 1;
  while (end >= prefix && originalEnd >= prefix && keys[end] === originals[originalEnd].key) matches.set(end--, originalEnd--);
  const remaining = new Map();
  for (let index = prefix; index <= originalEnd; index += 1) {
    const key = originals[index].key;
    if (!remaining.has(key)) remaining.set(key, []);
    remaining.get(key).push(index);
  }
  return normalized.content.map((block, index) => {
    const oldIndex = matches.has(index) ? matches.get(index) : remaining.get(keys[index])?.shift();
    return oldIndex === undefined ? serializeBlock(block, newline) : originals[oldIndex].source;
  }).join(newline);
}
