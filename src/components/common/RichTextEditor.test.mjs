import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes)
  : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];

// Exercise the real editor handlers with isolated React hook slots and a small
// textarea fixture. This is not a browser/iPhone keyboard or layout test.
const openEditor = async (t, initial = 'Original 5:30 notes', extra = {}) => {
  const key = `__dnEditor${Date.now()}${Math.random().toString(36).slice(2)}`;
  const slots = [];
  const effects = [];
  const changes = [];
  let cursor = 0;
  let value = initial;
  const document = { activeElement: null, defaultView: { getComputedStyle: () => ({ minHeight: '96px' }) } };
  const input = { style: {}, selectionStart: 0, selectionEnd: 0, scrollHeight: 96, ownerDocument: document,
    focus() { document.activeElement = input; },
    setSelectionRange(start, end) { input.selectionStart = start; input.selectionEnd = end; } };
  const fixture = {
    state(initialState) { const index = cursor++; if (!(index in slots)) slots[index] = initialState;
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    ref(initialRef) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initialRef }; return slots[index]; },
    effect(fn) { effects.push(fn); },
  };
  globalThis[key] = fixture;
  const server = await createServer({ configFile: false, envFile: false, esbuild: { jsx: 'automatic' }, ssr: { noExternal: ['react', 'lucide-react'] },
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
    plugins: [{ name: 'isolated-rich-editor', enforce: 'pre',
      resolveId(source, importer) {
        if (source === 'react') return '\0rich-editor-react';
        if (['react/jsx-runtime', 'react/jsx-dev-runtime'].includes(source)) return '\0rich-editor-jsx';
        if (!importer?.replaceAll('\\', '/').endsWith('/src/components/common/RichTextEditor.jsx')) return null;
        if (source === 'lucide-react') return '\0rich-editor-icons';
        if (source === './RichText') return '\0rich-editor-display';
        return null;
      },
      load(id) {
        const api = `globalThis[${JSON.stringify(key)}]`;
        if (id === '\0rich-editor-react') return `export const useId=()=>"test-editor", useState=${api}.state, useRef=${api}.ref, useLayoutEffect=${api}.effect, useCallback=(fn)=>fn;`;
        if (id === '\0rich-editor-jsx') return 'export const jsx=(type,props)=>({type,props}); export const jsxs=jsx, jsxDEV=jsx;';
        if (id === '\0rich-editor-icons') return 'export const Bold="icon",Code2="icon",Eye="icon",Heading2="icon",Italic="icon",List="icon",ListOrdered="icon",MoreHorizontal="icon",Pencil="icon",Quote="icon",Strikethrough="icon";';
        if (id === '\0rich-editor-display') return 'export default "RichText";';
        return null;
      },
    }],
  });
  t.after(async () => { await server.close(); delete globalThis[key]; });
  const { default: Editor } = await server.ssrLoadModule('/src/components/common/RichTextEditor.jsx');
  let tree;
  const render = () => {
    cursor = 0;
    tree = Editor({ label: 'Notes', value, onChange: (next) => { changes.push(next); value = next; }, ...extra });
    nodes(tree).find((node) => node.type === 'textarea').props.ref.current = input;
    for (const effect of effects.splice(0)) effect();
    return tree;
  };
  const button = (label) => nodes(tree).find((node) => node.type === 'button' && node.props['aria-label'] === label);
  const textarea = () => nodes(tree).find((node) => node.type === 'textarea');
  render();
  return { render, button, textarea, input, document, changes, value: () => value,
    select(start, end) { input.setSelectionRange(start, end); input.focus(); textarea().props.onSelect(); } };
};

test('More explicitly reveals the secondary tools without editing the note or losing focus', async (t) => {
  const editor = await openEditor(t);
  editor.select(9, 13);
  const more = editor.button('More formatting');
  assert.equal(more.props['aria-expanded'], false);
  let prevented = 0;
  more.props.onPointerDown({ preventDefault: () => { prevented += 1; } });
  more.props.onClick();
  const tree = editor.render();
  assert.equal(editor.button('Less formatting').props['aria-expanded'], true);
  assert.ok(nodes(tree).find((node) => node.props?.className === 'dn-rich-editor-secondary is-expanded'));
  assert.equal(prevented, 1);
  assert.equal(editor.document.activeElement, editor.input);
  assert.deepEqual(editor.changes, [], 'showing tools does not rewrite personal notes');
  for (const label of ['Bold', 'Italic', 'Bullet list', 'Heading', 'Numbered list', 'Quote', 'Strikethrough', 'Code']) assert.ok(editor.button(label));
});

test('formatting after a toolbar focus change preserves the selected text and restores the caret', async (t) => {
  const editor = await openEditor(t);
  editor.select(9, 13);
  editor.textarea().props.onBlur();
  editor.document.activeElement = {};
  editor.input.setSelectionRange(0, 0);
  editor.button('Bold').props.onClick();
  editor.render();
  assert.equal(editor.value(), 'Original **5:30** notes');
  assert.equal(editor.document.activeElement, editor.input);
  assert.equal(editor.input.selectionStart, 11);
  assert.equal(editor.input.selectionEnd, 15);
});

test('Preview and Write preserve the original string and return to the selected range', async (t) => {
  const editor = await openEditor(t, 'First line\n\n  unchanged 5:30');
  editor.select(0, 5);
  editor.button('Preview').props.onClick();
  editor.render();
  assert.equal(editor.button('Write').props['aria-pressed'], true);
  assert.equal(editor.textarea().props.style.display, 'none');
  assert.equal(editor.button('Bold').props.disabled, true);
  editor.button('Write').props.onClick();
  editor.render();
  assert.equal(editor.textarea().props.style, undefined);
  assert.equal(editor.input.selectionStart, 0);
  assert.equal(editor.input.selectionEnd, 5);
  assert.equal(editor.value(), 'First line\n\n  unchanged 5:30');
  assert.deepEqual(editor.changes, []);
});

test('the editor grows and shrinks to its CSS minimum and still enforces the note length', async (t) => {
  const editor = await openEditor(t, 'test', { maxLength: 5 });
  editor.input.scrollHeight = 640;
  editor.render();
  assert.equal(editor.input.style.height, '640px');
  editor.input.scrollHeight = 50;
  editor.render();
  assert.equal(editor.input.style.height, '96px');
  editor.select(0, 4);
  editor.button('Bold').props.onClick();
  assert.deepEqual(editor.changes, [], 'formatting cannot exceed the existing field limit');
  assert.equal(editor.value(), 'test');
});
