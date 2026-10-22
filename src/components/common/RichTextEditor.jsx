import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { Bold, Code2, Eye, Heading2, Italic, List, ListOrdered, MoreHorizontal, Pencil, Quote, Strikethrough } from 'lucide-react';
import RichText from './RichText';
import { applyTextFormat } from '../../utils/richText';

const tools = [
  ['bold', 'Bold', Bold], ['italic', 'Italic', Italic], ['bullet', 'Bullet list', List],
  ['heading', 'Heading', Heading2], ['ordered', 'Numbered list', ListOrdered],
  ['quote', 'Quote', Quote], ['strike', 'Strikethrough', Strikethrough], ['code', 'Code', Code2],
];

export default function RichTextEditor({ label = 'Notes', value = '', onChange, id, name, placeholder, rows = 4,
  required = false, disabled = false, autoFocus = false, maxLength, className = '' }) {
  const generatedId = useId();
  const inputId = id || `dn-rich-editor-${generatedId}`;
  const inputRef = useRef(null);
  const selectionRef = useRef(null);
  const savedSelectionRef = useRef(null);
  const [preview, setPreview] = useState(false);
  const [moreTools, setMoreTools] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const resize = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    // Reset to the CSS minimum before measuring, so deleting text also shrinks it.
    input.style.height = '0px';
    const minimum = parseFloat(input.ownerDocument?.defaultView?.getComputedStyle(input).minHeight) || 96;
    input.style.height = `${Math.max(minimum, input.scrollHeight)}px`;
  }, []);
  useLayoutEffect(() => {
    if (preview && required && !String(value).trim()) setPreview(false);
    resize();
    if (selectionRef.current && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
      inputRef.current.setSelectionRange(selectionRef.current.start, selectionRef.current.end);
      savedSelectionRef.current = selectionRef.current;
      selectionRef.current = null;
    }
  }, [value, preview, required, resize]);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || typeof ResizeObserver === 'undefined') return undefined;
    let width = input.getBoundingClientRect().width;
    const observer = new ResizeObserver(([entry]) => {
      if (Math.abs(entry.contentRect.width - width) > 1) { width = entry.contentRect.width; resize(); }
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, [preview, resize]);

  const rememberSelection = () => {
    const input = inputRef.current;
    if (input) savedSelectionRef.current = { start: input.selectionStart, end: input.selectionEnd };
  };
  const keepSelection = (event) => {
    rememberSelection();
    // A toolbar tap must not move focus to a button and dismiss the phone keyboard.
    if (inputRef.current?.ownerDocument?.activeElement === inputRef.current) event.preventDefault();
  };
  const format = (command) => {
    const input = inputRef.current;
    if (!input || disabled) return;
    const selection = input.ownerDocument?.activeElement === input || !savedSelectionRef.current
      ? { start: input.selectionStart, end: input.selectionEnd } : savedSelectionRef.current;
    const result = applyTextFormat(value, selection.start, selection.end, command);
    if (maxLength && result.value.length > maxLength) { setAnnouncement(`Keep this text within ${maxLength} characters.`); return; }
    if (result.value === value) {
      input.focus({ preventScroll: true });
      input.setSelectionRange(result.start, result.end);
      savedSelectionRef.current = result;
      return;
    }
    selectionRef.current = result;
    onChange(result.value);
    setAnnouncement(`${tools.find(([key]) => key === command)?.[1] || 'Format'} applied`);
  };
  const toolButton = ([command, title, Icon]) => <button key={command} type="button" title={title} aria-label={title}
    disabled={disabled || preview} onPointerDown={keepSelection} onMouseDown={keepSelection}
    onClick={() => format(command)}><Icon size={17} aria-hidden="true" /></button>;
  const togglePreview = () => {
    rememberSelection();
    if (preview) selectionRef.current = savedSelectionRef.current;
    setPreview((current) => !current);
  };
  return (
    <div className={`dn-rich-editor ${className}${disabled ? ' is-disabled' : ''}`}>
      <label className="dn-rich-editor-label" htmlFor={inputId}>{label}</label>
      <div className="dn-rich-editor-surface">
        <div className="dn-rich-editor-toolbar" role="group" aria-label={`${label} formatting`}>
          <div className="dn-rich-editor-primary">
            <div className="dn-rich-editor-tools">{tools.slice(0, 3).map(toolButton)}</div>
            <button className="dn-rich-editor-more-toggle" type="button" title={moreTools ? 'Less formatting' : 'More formatting'}
              aria-label={moreTools ? 'Less formatting' : 'More formatting'} aria-expanded={moreTools} aria-controls={`${inputId}-more`}
              disabled={disabled || preview} onPointerDown={keepSelection} onMouseDown={keepSelection} onClick={() => setMoreTools((current) => !current)}>
              <MoreHorizontal size={17} aria-hidden="true" /><span>{moreTools ? 'Less' : 'More'}</span>
            </button>
          </div>
          <div id={`${inputId}-more`} className={`dn-rich-editor-secondary${moreTools ? ' is-expanded' : ''}`} role="group" aria-label="More formatting tools">
            {tools.slice(3).map(toolButton)}
          </div>
          <button className="dn-rich-editor-preview-toggle" type="button" title={preview ? 'Write' : 'Preview'} aria-label={preview ? 'Write' : 'Preview'}
            disabled={disabled || (!preview && required && !String(value).trim())} aria-pressed={preview}
            onClick={togglePreview}>{preview ? <Pencil size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}<span>{preview ? 'Write' : 'Preview'}</span></button>
        </div>
        {preview ? <div className="dn-rich-editor-preview" tabIndex={0} role="region" aria-label={`${label} preview`}>
          {value ? <RichText value={value} /> : <span className="dn-rich-editor-empty">Your formatted text will appear here.</span>}
        </div> : null}
        <textarea ref={inputRef} id={inputId} name={name} value={value} onChange={(event) => { rememberSelection(); onChange(event.target.value); }}
          onSelect={rememberSelection} onBlur={rememberSelection}
          onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && !event.altKey && ['b', 'i'].includes(event.key.toLowerCase())) { event.preventDefault(); format(event.key.toLowerCase() === 'b' ? 'bold' : 'italic'); } }}
          placeholder={placeholder} rows={rows} required={required} disabled={disabled} autoFocus={autoFocus} maxLength={maxLength}
          aria-describedby={`${inputId}-hint`} style={preview ? { display: 'none' } : undefined} />
        <div id={`${inputId}-hint`} className="dn-rich-editor-hint"><span>Select text to format<span className="dn-rich-editor-shortcuts"> · Ctrl/⌘ B or I</span></span>{maxLength ? <span>{value.length}/{maxLength}</span> : null}</div>
      </div>
      <span className="dn-rich-editor-announcement" role="status" aria-live="polite">{announcement}</span>
    </div>
  );
}
