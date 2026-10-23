import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { EditorContent, Extension, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { ListItem } from '@tiptap/extension-list';
import Code from '@tiptap/extension-code';
import { Plugin } from '@tiptap/pm/state';
import { Bold, Code2, Heading2, Italic, List, ListOrdered, MoreHorizontal, Quote, RemoveFormatting, Strikethrough } from 'lucide-react';
import { editorDocumentToNote, noteToEditorDocument } from '../../utils/richTextDocument';
import { hasNoteText, pastePlainNoteText } from '../../utils/documentEditing';
import './DocumentTextEditor.css';

const FlatListItem = ListItem.extend({
  addKeyboardShortcuts() {
    return { ...this.parent?.(), Tab: () => false, 'Shift-Tab': () => false };
  },
});

export default function DocumentTextEditor({ label = 'Notes', value = '', onChange, id, name, placeholder,
  required = false, disabled = false, autoFocus = false, maxLength, className = '' }) {
  const generatedId = useId();
  const inputId = id || `dn-document-${generatedId}`;
  const latest = useRef({ value, onChange, maxLength });
  latest.current = { value, onChange, maxLength };
  const initial = useRef(null);
  if (!initial.current) initial.current = noteToEditorDocument(value);
  const lastValue = useRef(value);
  const validation = useRef(null);
  const surface = useRef(null);
  const selectionTools = useRef(null);
  const [moreStyles, setMoreStyles] = useState(false);
  const [notice, setNotice] = useState('');
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [3, 4, 5] }, code: false, hardBreak: false,
      codeBlock: false, horizontalRule: false, link: false, underline: false,
      listItem: false, listKeymap: false, trailingNode: false }), FlatListItem, Code.extend({ excludes: '' }),
    Extension.create({
      name: 'dnNoteCompatibility',
      addKeyboardShortcuts() { return { 'Shift-Enter': () => this.editor.commands.enter(), 'Mod-Enter': () => this.editor.commands.enter() }; },
      addProseMirrorPlugins: () => [new Plugin({ filterTransaction(transaction) {
        if (!transaction.docChanged) return true;
        try {
          const note = editorDocumentToNote(transaction.doc.toJSON(), latest.current.value);
          if (latest.current.maxLength && note.length > latest.current.maxLength && note.length >= latest.current.value.length) {
            setNotice(`Keep this text within ${latest.current.maxLength} characters.`);
            return false;
          }
          return true;
        } catch {
          setNotice('This layout is not supported. Use simple paragraphs and one level of lists.');
          return false;
        }
      } })],
    })],
    content: initial.current,
    editable: !disabled,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    enableInputRules: false,
    enablePasteRules: false,
    injectCSS: false,
    editorProps: {
      attributes: { id: inputId, role: 'textbox', 'aria-label': label, 'aria-multiline': 'true',
        'aria-required': String(required), 'aria-describedby': `${inputId}-hint`,
        'data-placeholder': placeholder || 'Start writing…', spellcheck: 'true' },
      handleKeyDown(view, event) {
        // Keyboard users reach the same contextual tools as touch selection.
        if (event.altKey && event.key === 'F10' && !view.state.selection.empty) {
          event.preventDefault();
          // Selection updates are briefly debounced for touch handles. Explicit
          // keyboard access must not try to focus a still-hidden menu.
          view.dispatch(view.state.tr.setMeta('dnNoteSelection', 'show'));
          view.dispatch(view.state.tr.setMeta('dnNoteSelection', 'updatePosition'));
          selectionTools.current?.querySelector('button')?.focus({ preventScroll: true });
          return true;
        }
        return false;
      },
      // Pasting cannot introduce unsupported nesting, images or executable HTML.
      handlePaste(view, event) {
        const text = event.clipboardData?.getData('text/plain');
        if (text === undefined) return false;
        event.preventDefault();
        view.dispatch(pastePlainNoteText(view.state, text));
        return true;
      },
    },
    onCreate: ({ editor: instance }) => { if (autoFocus) instance.commands.focus('end'); },
    onUpdate: ({ editor: instance }) => {
      const next = editorDocumentToNote(instance.getJSON(), latest.current.value);
      lastValue.current = next;
      setNotice('');
      latest.current.onChange(next);
    },
  }, []);

  useEffect(() => {
    if (!editor || value === lastValue.current) return;
    lastValue.current = value;
    editor.commands.setContent(noteToEditorDocument(value), { emitUpdate: false });
  }, [editor, value]);
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  useEffect(() => {
    validation.current?.setCustomValidity(required && editor && !hasNoteText(editor.state.doc) ? 'Please enter some text.' : '');
  }, [editor, value, required]);

  const menuOptions = useMemo(() => ({
    placement: 'bottom', offset: 8, flip: { padding: 8 }, shift: { padding: 8 },
    hide: { strategy: 'referenceHidden' },
    scrollTarget: editor?.view.dom.closest('.dn-modal-body') || undefined,
    onHide: () => setMoreStyles(false),
  }), [editor]);
  const appendMenu = useCallback(() => surface.current, []);
  const showSelectionTools = useCallback(({ editor: instance, element, state, from, to, view }) =>
    !disabled && instance.isEditable && !state.selection.empty
      && Boolean(state.doc.textBetween(from, to).trim())
      && (view.hasFocus() || element.contains(element.ownerDocument.activeElement)), [disabled]);
  useEffect(() => {
    if (!editor) return undefined;
    const reposition = () => {
      if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta('dnNoteSelection', 'updatePosition'));
    };
    // Keep controls attached during body scrolling, editor scrolling or keyboard pan.
    document.addEventListener('scroll', reposition, true);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    return () => {
      document.removeEventListener('scroll', reposition, true);
      window.visualViewport?.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('scroll', reposition);
    };
  }, [editor]);
  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta('dnNoteSelection', 'updatePosition'));
  }, [editor, moreStyles]);

  const tool = (title, Icon, command, active = false) => <button type="button" key={title}
    title={title} aria-label={title} aria-pressed={active} disabled={disabled || !editor}
    onPointerDown={(event) => event.preventDefault()} onMouseDown={(event) => event.preventDefault()}
    onClick={() => command(editor.chain().focus(undefined, { scrollIntoView: false })).run()}>
    <Icon size={16} aria-hidden="true" /></button>;

  return <div className={`dn-document-editor ${className}${disabled ? ' is-disabled' : ''}`}>
    <label id={`${inputId}-label`} htmlFor={inputId} className="dn-document-label" onClick={() => editor?.commands.focus()}>{label}</label>
    <div ref={surface} className="dn-document-surface">
      <div className="dn-document-writing"><EditorContent editor={editor} /></div>
      {editor ? <BubbleMenu ref={selectionTools} editor={editor} pluginKey="dnNoteSelection" updateDelay={100}
        className="dn-document-selection-tools" role="toolbar" aria-label={`${label} selection formatting`}
        appendTo={appendMenu} shouldShow={showSelectionTools} options={menuOptions}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          setMoreStyles(false);
          editor.chain().setTextSelection(editor.state.selection.to).focus(undefined, { scrollIntoView: false }).run();
        }}>
        <div className="dn-document-selection-primary">
          {tool('Bold', Bold, (chain) => chain.toggleBold(), editor.isActive('bold'))}
          {tool('Italic', Italic, (chain) => chain.toggleItalic(), editor.isActive('italic'))}
          {tool('Bullet list', List, (chain) => chain.unsetBlockquote().toggleBulletList(), editor.isActive('bulletList'))}
          <button type="button" title="More styles" aria-label="More styles" aria-expanded={moreStyles} aria-controls={`${inputId}-styles`}
            disabled={disabled} onPointerDown={(event) => event.preventDefault()} onMouseDown={(event) => event.preventDefault()}
            onClick={() => setMoreStyles((current) => !current)}><MoreHorizontal size={16} aria-hidden="true" /></button>
        </div>
        {moreStyles ? <div id={`${inputId}-styles`} className="dn-document-selection-more">
          {tool('Heading', Heading2, (chain) => editor.isActive('heading', { level: 3 }) ? chain.setParagraph() : chain.clearNodes().setHeading({ level: 3 }), editor.isActive('heading', { level: 3 }))}
          {tool('Subheading', Heading2, (chain) => editor.isActive('heading', { level: 4 }) ? chain.setParagraph() : chain.clearNodes().setHeading({ level: 4 }), editor.isActive('heading', { level: 4 }))}
          {tool('Small heading', Heading2, (chain) => editor.isActive('heading', { level: 5 }) ? chain.setParagraph() : chain.clearNodes().setHeading({ level: 5 }), editor.isActive('heading', { level: 5 }))}
          {tool('Numbered list', ListOrdered, (chain) => chain.unsetBlockquote().toggleOrderedList(), editor.isActive('orderedList'))}
          {tool('Quote', Quote, (chain) => editor.isActive('blockquote') ? chain.unsetBlockquote() : chain.clearNodes().setBlockquote(), editor.isActive('blockquote'))}
          {tool('Strikethrough', Strikethrough, (chain) => chain.toggleStrike(), editor.isActive('strike'))}
          {tool('Code', Code2, (chain) => chain.toggleCode(), editor.isActive('code'))}
          {tool('Normal text', RemoveFormatting, (chain) => chain.clearNodes().unsetAllMarks())}
        </div> : null}
      </BubbleMenu> : null}
      <div id={`${inputId}-hint`} className="dn-document-footer"><span>Select text for styles<span className="dn-document-keyboard-hint"> · Ctrl/⌘ B or I · Alt+F10 for tools</span></span>
        {maxLength ? <span>{value.length}/{maxLength}</span> : null}</div>
    </div>
    <textarea ref={validation} className="dn-document-form-value" name={name} value={value} required={required} disabled={disabled}
      tabIndex={-1} aria-hidden="true" onChange={() => {}} onInvalid={(event) => { event.preventDefault(); editor?.commands.focus(); setNotice('Please enter some text.'); }} />
    <span className="dn-document-notice" role="status" aria-live="polite">{notice}</span>
  </div>;
}
