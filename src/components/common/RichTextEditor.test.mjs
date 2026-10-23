import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';
import { getSchema } from '@tiptap/core';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { history, undo } from '@tiptap/pm/history';
import { editorDocumentToNote, noteToEditorDocument } from '../../utils/richTextDocument.js';

const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes)
  : node && typeof node === 'object' ? [node, ...nodes(node.props?.children)] : [];
const same = (first, second) => Array.isArray(first) && Array.isArray(second)
  && first.length === second.length && first.every((value, index) => Object.is(value, second[index]));

// Real component handlers, note conversion, schema and transactions. React hooks,
// DOM focus and the BubbleMenu wrapper are isolated: this does not prove native
// iPhone selection-menu placement, keyboard panning or browser caret behaviour.
const openEditor = async (t, original = 'Original 5:30 notes', extra = {}) => {
  const key = `__dnVisualEditor${Date.now()}${Math.random().toString(36).slice(2)}`;
  const slots = [];
  const effects = [];
  const changes = [];
  const focused = [];
  let cursor = 0;
  let value = original;
  let options;
  let editor;
  let tree;
  let validity = '';
  const ownerDocument = new EventTarget();
  ownerDocument.activeElement = null;
  const windowTarget = { visualViewport: new EventTarget() };
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'window', { value: windowTarget, configurable: true });
  Object.defineProperty(globalThis, 'document', { value: ownerDocument, configurable: true });
  const surface = {};
  const menuElement = { ownerDocument, contains: (target) => target === menuElement,
    querySelector: () => ({ focus: (settings) => focused.push({ target: 'tools', settings }) }) };
  const fixture = {
    state(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }]; },
    ref(initial) { const index = cursor++; if (!(index in slots)) slots[index] = { current: initial }; return slots[index]; },
    memo(factory, dependencies) { const index = cursor++; if (!slots[index] || !same(slots[index].dependencies, dependencies)) slots[index] = { value: factory(), dependencies }; return slots[index].value; },
    callback(fn, dependencies) { return fixture.memo(() => fn, dependencies); },
    effect(fn, dependencies) { const index = cursor++; if (!slots[index] || !same(slots[index].dependencies, dependencies)) {
      const previous = slots[index]; slots[index] = { dependencies, cleanup: previous?.cleanup };
      effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = fn(); });
    } },
    useEditor(next) {
      if (editor) return editor;
      options = next;
      const schema = getSchema(next.extensions);
      const compatibility = next.extensions.find((extension) => extension.name === 'dnNoteCompatibility');
      const plugins = [history(), ...compatibility.config.addProseMirrorPlugins()];
      editor = { state: EditorState.create({ doc: schema.nodeFromJSON(next.content), plugins }),
        isEditable: next.editable, isDestroyed: false, isActive: () => false,
        getJSON: () => editor.state.doc.toJSON(), setEditable: (editable) => { editor.isEditable = editable; },
        commands: {
          focus: () => focused.push({ target: 'editor' }),
          setContent: (content) => { editor.state = EditorState.create({ doc: schema.nodeFromJSON(content), plugins }); },
        },
      };
      editor.view = { dom: { closest: () => null }, hasFocus: () => true,
        get state() { return editor.state; },
        dispatch: (transaction) => {
          const result = editor.state.applyTransaction(transaction);
          editor.state = result.state;
          if (result.transactions.some((item) => item.docChanged)) options.onUpdate({ editor });
        },
      };
      return editor;
    },
  };
  globalThis[key] = fixture;
  const server = await createServer({ configFile: false, envFile: false, esbuild: { jsx: 'automatic' },
    ssr: { noExternal: ['react', '@tiptap/react', 'lucide-react'] },
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
    plugins: [{ name: 'isolated-visual-editor', enforce: 'pre',
      resolveId(source, importer) {
        if (!importer?.replaceAll('\\', '/').endsWith('/src/components/common/DocumentTextEditor.jsx')) return null;
        if (source === 'react') return '\0visual-editor-react';
        if (['react/jsx-runtime', 'react/jsx-dev-runtime'].includes(source)) return '\0visual-editor-jsx';
        if (source === '@tiptap/react') return '\0visual-editor-tiptap';
        if (source === '@tiptap/react/menus') return '\0visual-editor-menu';
        if (source === 'lucide-react') return '\0visual-editor-icons';
        if (source.endsWith('.css')) return '\0visual-editor-css';
        return null;
      },
      load(id) {
        const api = `globalThis[${JSON.stringify(key)}]`;
        if (id === '\0visual-editor-react') return `export const useId=()=>"test-editor",useState=${api}.state,useRef=${api}.ref,useMemo=${api}.memo,useCallback=${api}.callback,useEffect=${api}.effect;`;
        if (id === '\0visual-editor-jsx') return 'export const jsx=(type,props)=>({type,props});export const jsxs=jsx,jsxDEV=jsx;';
        if (id === '\0visual-editor-tiptap') return `export { Extension } from '@tiptap/core';export const EditorContent="EditorContent",useEditor=${api}.useEditor;`;
        if (id === '\0visual-editor-menu') return 'export const BubbleMenu="BubbleMenu";';
        if (id === '\0visual-editor-icons') return 'export const Bold="icon",Code2="icon",Heading2="icon",Italic="icon",List="icon",ListOrdered="icon",MoreHorizontal="icon",Quote="icon",RemoveFormatting="icon",Strikethrough="icon";';
        if (id === '\0visual-editor-css') return '';
        return null;
      },
    }],
  });
  t.after(async () => {
    for (const slot of slots) slot?.cleanup?.();
    await server.close();
    delete globalThis[key];
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else delete globalThis.window;
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else delete globalThis.document;
  });
  const { default: Editor } = await server.ssrLoadModule('/src/components/common/DocumentTextEditor.jsx');
  const render = (props = {}) => {
    cursor = 0;
    tree = Editor({ label: 'Notes', value, onChange: (next) => { changes.push(next); value = next; }, ...extra, ...props });
    nodes(tree).find((node) => node.type === 'textarea').props.ref.current = { setCustomValidity: (next) => { validity = next; } };
    nodes(tree).find((node) => node.props?.className === 'dn-document-surface').props.ref.current = surface;
    nodes(tree).find((node) => node.type === 'BubbleMenu').props.ref.current = menuElement;
    for (const effect of effects.splice(0)) effect();
    return tree;
  };
  render();
  return { render, editor, options, changes, focused, value: () => value, validity: () => validity,
    tree: () => tree, menu: () => nodes(tree).find((node) => node.type === 'BubbleMenu'),
    select(from, to = from) { editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to))); },
    visibleMenu() {
      const { from, to } = editor.state.selection;
      return nodes(tree).find((node) => node.type === 'BubbleMenu').props.shouldShow({ editor, element: menuElement, state: editor.state, from, to, view: editor.view });
    },
    button: (label) => nodes(tree).find((node) => node.type === 'button' && node.props['aria-label'] === label),
    paste(text) {
      let prevented = false;
      options.editorProps.handlePaste(editor.view, { clipboardData: { getData: () => text }, preventDefault: () => { prevented = true; } });
      return prevented;
    },
  };
};

test('ordinary writing has no permanent formatting buttons; nonempty selection reveals contextual tools', async (t) => {
  const editor = await openEditor(t);
  assert.equal(editor.visibleMenu(), false);
  const outsideMenu = (node) => node?.type === 'BubbleMenu' ? [] : Array.isArray(node) ? node.flatMap(outsideMenu)
    : node && typeof node === 'object' ? [node, ...outsideMenu(node.props?.children)] : [];
  assert.equal(outsideMenu(editor.tree()).filter((node) => node.type === 'button').length, 0);
  editor.select(1, 9);
  assert.equal(editor.visibleMenu(), true);
  let prevented = 0;
  editor.button('More styles').props.onPointerDown({ preventDefault: () => { prevented += 1; } });
  editor.button('More styles').props.onClick();
  editor.render();
  assert.equal(editor.button('More styles').props['aria-expanded'], true);
  for (const label of ['Heading', 'Subheading', 'Small heading', 'Numbered list', 'Quote', 'Strikethrough', 'Code', 'Normal text']) assert.ok(editor.button(label));
  assert.equal(prevented, 1);
  assert.deepEqual(editor.changes, [], 'opening styles must not rewrite the stored note');
  editor.select(9);
  assert.equal(editor.visibleMenu(), false);
  editor.select(1, 9);
  editor.render({ disabled: true });
  assert.equal(editor.visibleMenu(), false);
});

test('opening and re-rendering visual notes preserves original source; external changes load without writes', async (t) => {
  const original = '#   Heading\r\n+  First\r\n- Second  \r\n\r\n>quote\r\n  5:30  ';
  const editor = await openEditor(t, original);
  editor.render();
  assert.equal(editorDocumentToNote(editor.editor.getJSON(), original), original);
  assert.deepEqual(editor.changes, []);
  const replacement = '**Replacement**\n\n  <img src=x>  ';
  editor.render({ value: replacement });
  assert.deepEqual(editor.editor.getJSON().content, editor.editor.state.schema.nodeFromJSON(noteToEditorDocument(replacement)).toJSON().content);
  assert.deepEqual(editor.changes, []);
});

test('the actual paste handler accepts safe literal text atomically and one undo restores the note', async (t) => {
  const editor = await openEditor(t, 'Before SELECT after');
  editor.select(8, 14);
  assert.equal(editor.paste('First\n<script>literal</script>\nLast'), true);
  assert.equal(editor.value(), 'Before First\n<script>literal</script>\nLast after');
  assert.equal(undo(editor.editor.state, (transaction) => editor.editor.view.dispatch(transaction)), true);
  assert.equal(editor.value(), 'Before SELECT after');
});

test('the installed compatibility guard blocks over-limit paste and unsupported nested lists', async (t) => {
  const editor = await openEditor(t, 'Original', { maxLength: 12 });
  editor.select(9);
  editor.paste('\nToo much text');
  assert.equal(editor.value(), 'Original');
  assert.deepEqual(editor.changes, []);
  editor.render();
  assert.match(nodes(editor.tree()).find((node) => node.props?.className === 'dn-document-notice').props.children, /12 characters/);
  const { schema } = editor.editor.state;
  const paragraph = (text) => schema.nodes.paragraph.create(null, schema.text(text));
  const nested = schema.nodes.bulletList.create(null, schema.nodes.listItem.create(null, [paragraph('outer'),
    schema.nodes.bulletList.create(null, schema.nodes.listItem.create(null, paragraph('inner')))]));
  editor.editor.view.dispatch(editor.editor.state.tr.replaceWith(0, editor.editor.state.doc.content.size, nested));
  assert.equal(editor.value(), 'Original');
  editor.render();
  assert.match(nodes(editor.tree()).find((node) => node.props?.className === 'dn-document-notice').props.children, /one level of lists/);
});

test('required notes validate visible text, and keyboard users can reach selection tools without a toolbar', async (t) => {
  const editor = await openEditor(t, '- ', { required: true });
  assert.equal(editor.validity(), 'Please enter some text.');
  editor.render({ value: '**Visit**' });
  assert.equal(editor.validity(), '');
  editor.select(1, 6);
  let prevented = false;
  const handled = editor.options.editorProps.handleKeyDown(editor.editor.view, { altKey: true, key: 'F10', preventDefault: () => { prevented = true; } });
  assert.equal(handled, true);
  assert.equal(prevented, true);
  assert.deepEqual(editor.focused.at(-1), { target: 'tools', settings: { preventScroll: true } });
  editor.select(6);
  assert.equal(editor.options.editorProps.handleKeyDown(editor.editor.view, { altKey: true, key: 'F10' }), false);
});
