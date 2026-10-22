// A small, deliberately restricted Markdown vocabulary. Stored values remain strings;
// HTML, links, images and executable markup are always treated as ordinary text.
export function parseInlineRichText(value, depth = 0) {
  const text = String(value ?? '');
  if (depth > 4) return [{ type: 'text', text }];
  const expression = /\*\*\*([^\n]+?)\*\*\*|\*\*([^\n]+?)\*\*|~~([^\n]+?)~~|`([^`\n]+)`|\*([^*\n]+)\*/g;
  const nodes = [];
  let cursor = 0;
  for (const match of text.matchAll(expression)) {
    if (match.index > cursor) nodes.push({ type: 'text', text: text.slice(cursor, match.index) });
    if (match[1] !== undefined) {
      nodes.push({ type: 'strong', children: [{ type: 'em', children: parseInlineRichText(match[1], depth + 1) }] });
    } else {
      const index = match.slice(2).findIndex((part) => part !== undefined);
      const type = ['strong', 'del', 'code', 'em'][index];
      const content = match[index + 2];
      nodes.push(type === 'code' ? { type, text: content } : { type, children: parseInlineRichText(content, depth + 1) });
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length || !nodes.length) nodes.push({ type: 'text', text: text.slice(cursor) });
  return nodes;
}

export function parseRichText(value) {
  const lines = String(value ?? '').split(/\r\n|\r|\n/);
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const list = /^\s*(?:([-+])\s+|(\d+)\.\s+)(.*)$/.exec(line);
    const quote = /^>\s?(.*)$/.exec(line);
    if (heading) blocks.push({ type: 'heading', level: heading[1].length, children: parseInlineRichText(heading[2]) });
    else if (list) {
      const ordered = Boolean(list[2]);
      const previous = blocks.at(-1);
      const item = parseInlineRichText(list[3]);
      if (previous?.type === 'list' && previous.ordered === ordered) previous.items.push(item);
      else blocks.push({ type: 'list', ordered, start: ordered ? Number(list[2]) : undefined, items: [item] });
    } else if (quote) blocks.push({ type: 'quote', children: parseInlineRichText(quote[1]) });
    else blocks.push({ type: 'line', children: parseInlineRichText(line) });
  }
  return blocks;
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const inlineHtml = (nodes) => nodes.map((node) => node.type === 'text' ? escapeHtml(node.text)
  : `<${node.type}>${node.type === 'code' ? escapeHtml(node.text) : inlineHtml(node.children)}</${node.type}>`).join('');

// Suitable for explicitly downloaded greeting HTML; no user HTML is accepted.
export function renderRichTextHtml(value) {
  return parseRichText(value).map((block) => {
    if (block.type === 'heading') return `<h${block.level + 2}>${inlineHtml(block.children)}</h${block.level + 2}>`;
    if (block.type === 'quote') return `<blockquote>${inlineHtml(block.children)}</blockquote>`;
    if (block.type === 'list') {
      const tag = block.ordered ? 'ol' : 'ul';
      return `<${tag}${block.ordered ? ` start="${Math.min(999999, block.start)}"` : ''}>${block.items.map((item) => `<li>${inlineHtml(item)}</li>`).join('')}</${tag}>`;
    }
    return `<div style="white-space:pre-wrap;min-height:1em">${inlineHtml(block.children) || '<br>'}</div>`;
  }).join('');
}

const inlineText = (nodes) => nodes.map((node) => node.text ?? inlineText(node.children)).join('');
export function plainRichText(value) {
  return parseRichText(value).map((block) => block.type === 'list'
    ? block.items.map((item, index) => `${block.ordered ? `${block.start + index}.` : '•'} ${inlineText(item)}`).join('\n')
    : inlineText(block.children)).join('\n');
}

export function applyTextFormat(value, selectionStart, selectionEnd, command) {
  const text = String(value ?? '');
  const start = Math.max(0, Math.min(text.length, selectionStart ?? 0));
  const end = Math.max(start, Math.min(text.length, selectionEnd ?? start));
  const markers = { bold: '**', italic: '*', strike: '~~', code: '`' };
  const marker = markers[command];
  if (marker) {
    const selected = text.slice(start, end);
    if (selected.includes('\n')) {
      // Inline marks cannot span Markdown blocks. Apply them to each selected
      // line, keeping list/heading prefixes and empty separator lines intact.
      const parts = selected.split('\n').map((line) => {
        const match = /^(\s*(?:[-+]\s+|\d+\.\s+|#{1,3}\s+|>\s?))(.*)$/.exec(line);
        return { prefix: match?.[1] || '', content: match?.[2] ?? line };
      });
      const nonempty = parts.filter(({ content }) => content.trim());
      const remove = nonempty.length > 0 && nonempty.every(({ content }) => content.length >= marker.length * 2 && content.startsWith(marker) && content.endsWith(marker));
      const replacement = parts.map(({ prefix, content }) => prefix + (!content.trim() ? content
        : remove ? content.slice(marker.length, -marker.length) : marker + content + marker)).join('\n');
      return { value: text.slice(0, start) + replacement + text.slice(end), start, end: start + replacement.length };
    }
    if (start >= marker.length && text.slice(start - marker.length, start) === marker && text.slice(end, end + marker.length) === marker) {
      return { value: text.slice(0, start - marker.length) + selected + text.slice(end + marker.length), start: start - marker.length, end: end - marker.length };
    }
    if (selected.length >= marker.length * 2 && selected.startsWith(marker) && selected.endsWith(marker)) {
      const inner = selected.slice(marker.length, -marker.length);
      return { value: text.slice(0, start) + inner + text.slice(end), start, end: start + inner.length };
    }
    const content = selected || 'text';
    return { value: text.slice(0, start) + marker + content + marker + text.slice(end), start: start + marker.length, end: start + marker.length + content.length };
  }
  if (!['bullet', 'ordered', 'heading', 'quote'].includes(command)) return { value: text, start, end };
  const from = start === 0 ? 0 : text.lastIndexOf('\n', start - 1) + 1;
  const searchEnd = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const nextNewline = text.indexOf('\n', searchEnd);
  const to = nextNewline < 0 ? text.length : nextNewline;
  const lines = text.slice(from, to).split('\n');
  const prefixPattern = { bullet: /^[-+]\s+/, ordered: /^\d+\.\s+/, heading: /^#{1,3}\s+/, quote: /^>\s?/ }[command];
  const remove = lines.every((line) => prefixPattern.test(line));
  const prefix = (index) => ({ bullet: '- ', ordered: `${index + 1}. `, heading: '## ', quote: '> ' })[command];
  const replacement = lines.map((line, index) => remove ? line.replace(prefixPattern, '') : prefix(index) + line).join('\n');
  return { value: text.slice(0, from) + replacement + text.slice(to), start: from, end: from + replacement.length };
}
