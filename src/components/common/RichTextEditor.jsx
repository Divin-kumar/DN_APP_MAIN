import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { Bold, Code2, Eye, Heading2, Italic, List, ListOrdered, Pencil, Quote, Strikethrough } from 'lucide-react';
import RichText from './RichText';
import { applyTextFormat } from '../../utils/richText';

const tools = [
  ['bold', 'Bold', Bold], ['italic', 'Italic', Italic], ['heading', 'Heading', Heading2],
  ['bullet', 'Bullet list', List], ['ordered', 'Numbered list', ListOrdered],
  ['quote', 'Quote', Quote], ['strike', 'Strikethrough', Strikethrough], ['code', 'Code', Code2],
];

export default function RichTextEditor({ label = 'Notes', value = '', onChange, id, name, placeholder, rows = 4,
  required = false, disabled = false, autoFocus = false, maxLength, className = '' }) {
  const generatedId = useId();
  const inputId = id || `dn-rich-editor-${generatedId}`;
  const inputRef = useRef(null);
  const selectionRef = useRef(null);
  const [preview, setPreview] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const resize = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.max(112, input.scrollHeight)}px`;
  }, []);
  useLayoutEffect(() => {
    if (preview && required && !String(value).trim()) setPreview(false);
    resize();
    if (selectionRef.current && inputRef.current) {
      inputRef.current.focus({ preventScroll: true });
      inputRef.current.setSelectionRange(selectionRef.current.start, selectionRef.current.end);
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

  const format = (command) => {
    const input = inputRef.current;
    if (!input || disabled) return;
    const result = applyTextFormat(value, input.selectionStart, input.selectionEnd, command);
    if (maxLength && result.value.length > maxLength) { setAnnouncement(`Keep this text within ${maxLength} characters.`); return; }
    if (result.value === value) {
      input.focus({ preventScroll: true });
      input.setSelectionRange(result.start, result.end);
      return;
    }
    selectionRef.current = result;
    onChange(result.value);
    setAnnouncement(`${tools.find(([key]) => key === command)?.[1] || 'Format'} applied`);
  };
  return (
    <div className={`dn-rich-editor ${className}${disabled ? ' is-disabled' : ''}`}>
      <label className="dn-rich-editor-label" htmlFor={inputId}>{label}</label>
      <div className="dn-rich-editor-surface">
        <div className="dn-rich-editor-toolbar" role="group" aria-label={`${label} formatting`}>
          <div className="dn-rich-editor-tools">
            {tools.map(([command, title, Icon]) => <button key={command} type="button" title={title} aria-label={title}
              disabled={disabled || preview} onMouseDown={(event) => event.preventDefault()} onClick={() => format(command)}><Icon size={16} aria-hidden="true" /></button>)}
          </div>
          <button className="dn-rich-editor-preview-toggle" type="button" disabled={disabled || (!preview && required && !String(value).trim())} aria-pressed={preview}
            onClick={() => setPreview((current) => !current)}>{preview ? <Pencil size={15} /> : <Eye size={15} />}<span>{preview ? 'Write' : 'Preview'}</span></button>
        </div>
        {preview ? <div className="dn-rich-editor-preview" tabIndex={0} role="region" aria-label={`${label} preview`}>
          {value ? <RichText value={value} /> : <span className="dn-rich-editor-empty">Your formatted text will appear here.</span>}
        </div> : null}
        <textarea ref={inputRef} id={inputId} name={name} value={value} onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && !event.altKey && ['b', 'i'].includes(event.key.toLowerCase())) { event.preventDefault(); format(event.key.toLowerCase() === 'b' ? 'bold' : 'italic'); } }}
          placeholder={placeholder} rows={rows} required={required} disabled={disabled} autoFocus={autoFocus} maxLength={maxLength}
          aria-describedby={`${inputId}-hint`} style={preview ? { display: 'none' } : undefined} />
        <div id={`${inputId}-hint`} className="dn-rich-editor-hint">Select text to format · Ctrl/⌘ B or I{maxLength ? ` · ${value.length}/${maxLength}` : ''}</div>
      </div>
      <span className="dn-rich-editor-announcement" role="status" aria-live="polite">{announcement}</span>
    </div>
  );
}
