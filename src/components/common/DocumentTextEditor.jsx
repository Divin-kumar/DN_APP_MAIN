import { useEffect, useId, useRef, useState } from 'react';
import { EditorContent, Extension, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ListItem } from '@tiptap/extension-list';
import Code from '@tiptap/extension-code';
import { Plugin } from '@tiptap/pm/state';
import { Bold, Code2, Eye, Italic, List, ListOrdered, Pencil, Quote, Redo2, Strikethrough, Undo2 } from 'lucide-react';
import { editorDocumentToNote, noteToEditorDocument } from '../../utils/richTextDocument';
import { hasNoteText, pastePlainNoteText } from '../../utils/documentEditing';
import RichText from './RichText';
import DropdownSelect from './DropdownSelect';
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
  const selection = useRef(null);
  const [preview, setPreview] = useState(false);
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
      // Pasting text cannot introduce unsupported nesting, images or executable HTML.
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
  useEffect(() => {
    editor?.setEditable(!disabled && !preview, false);
    if (editor && !disabled && !preview && selection.current) {
      editor.commands.focus();
      editor.commands.setTextSelection(selection.current);
      selection.current = null;
    }
  }, [editor, disabled, preview]);
  useEffect(() => {
    validation.current?.setCustomValidity(required && editor && !hasNoteText(editor.state.doc) ? 'Please enter some text.' : '');
  }, [editor, value, required]);

  const changeMode = (next) => {
    if (next === preview) return;
    if (next) selection.current = editor ? { from: editor.state.selection.from, to: editor.state.selection.to } : null;
    setPreview(next);
  };
  const tool = (title, Icon, command, active = false, unavailable = false) => <button type="button" key={title}
    title={title} aria-label={title} aria-pressed={active} disabled={disabled || !editor || unavailable}
    onMouseDown={(event) => event.preventDefault()} onClick={() => command(editor.chain().focus()).run()}>
    <Icon size={17} aria-hidden="true" /></button>;
  const heading = editor?.isActive('heading') ? String(editor.getAttributes('heading').level) : 'paragraph';
  const words = editor?.getText().match(/\S+/gu)?.length || 0;

  return <div className={`dn-document-editor ${className}${disabled ? ' is-disabled' : ''}`}>
    <label id={`${inputId}-label`} className="dn-document-label" onClick={() => { changeMode(false); editor?.commands.focus(); }}>{label}</label>
    <div className="dn-document-surface">
      <div className="dn-document-heading">
        <span className="dn-document-state"><span aria-hidden="true" />{preview ? 'Reading view' : 'Write naturally. Make it yours.'}</span>
        <div className="dn-document-modes" role="group" aria-label={`${label} view`}>
          <button type="button" aria-pressed={!preview} onClick={() => changeMode(false)} disabled={disabled}><Pencil size={14} aria-hidden="true" />Edit</button>
          <button type="button" aria-pressed={preview} onClick={() => changeMode(true)} disabled={disabled}><Eye size={14} aria-hidden="true" />Preview</button>
        </div>
      </div>
      {!preview ? <div className="dn-document-toolbar" role="group" aria-label={`${label} formatting`}>
        <DropdownSelect id={`${inputId}-style`} aria-label="Text style" value={heading} disabled={disabled || !editor}
          onChange={(event) => {
            const chain = editor.chain().focus().clearNodes();
            if (event.target.value === 'paragraph') chain.setParagraph().run();
            else chain.setHeading({ level: Number(event.target.value) }).run();
          }}>
          <option value="paragraph">Normal text</option><option value="3">Heading</option><option value="4">Subheading</option><option value="5">Small heading</option>
        </DropdownSelect>
        <div className="dn-document-tool-group">
          {tool('Bold', Bold, (chain) => chain.toggleBold(), editor?.isActive('bold'))}
          {tool('Italic', Italic, (chain) => chain.toggleItalic(), editor?.isActive('italic'))}
          {tool('Strikethrough', Strikethrough, (chain) => chain.toggleStrike(), editor?.isActive('strike'))}
        </div>
        <div className="dn-document-tool-group">
          {tool('Bullet list', List, (chain) => chain.unsetBlockquote().toggleBulletList(), editor?.isActive('bulletList'))}
          {tool('Numbered list', ListOrdered, (chain) => chain.unsetBlockquote().toggleOrderedList(), editor?.isActive('orderedList'))}
          {tool('Quote', Quote, (chain) => editor.isActive('blockquote') ? chain.unsetBlockquote() : chain.clearNodes().setBlockquote(), editor?.isActive('blockquote'))}
          {tool('Code', Code2, (chain) => chain.toggleCode(), editor?.isActive('code'))}
        </div>
        <div className="dn-document-tool-group dn-document-history">
          {tool('Undo', Undo2, (chain) => chain.undo(), false, !editor?.can().undo())}
          {tool('Redo', Redo2, (chain) => chain.redo(), false, !editor?.can().redo())}
        </div>
      </div> : null}
      <div className="dn-document-writing" hidden={preview}><EditorContent editor={editor} /></div>
      {preview ? <div className="dn-document-preview" role="region" aria-label={`${label} preview`} tabIndex={0}>
        {value ? <RichText value={value} /> : <span className="dn-document-empty">Your words will appear here.</span>}
      </div> : null}
      <div id={`${inputId}-hint`} className="dn-document-footer"><span>{preview ? 'Choose Edit to keep writing' : 'Select text to format · Ctrl/⌘ B or I'}</span>
        <span>{words} {words === 1 ? 'word' : 'words'}{maxLength ? ` · ${value.length}/${maxLength}` : ''}</span></div>
    </div>
    <textarea ref={validation} className="dn-document-form-value" name={name} value={value} required={required} disabled={disabled}
      tabIndex={-1} aria-hidden="true" onChange={() => {}} onInvalid={(event) => { event.preventDefault(); changeMode(false); editor?.commands.focus(); setNotice('Please enter some text.'); }} />
    <span className="dn-document-notice" role="status" aria-live="polite">{notice}</span>
  </div>;
}
