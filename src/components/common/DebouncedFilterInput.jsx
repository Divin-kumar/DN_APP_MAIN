import { useEffect, useRef, useState } from 'react';

function SearchDraft({ value = '', onChange, delay = 160, onBlur, onKeyDown, onCompositionStart, onCompositionEnd, ...props }) {
  const [draft, setDraft] = useState(value);
  const [composing, setComposing] = useState(false);
  const notify = useRef(onChange); notify.current = onChange;
  const pending = useRef(null);
  const input = useRef(null);
  useEffect(() => setDraft(value), [value]);
  const commit = (next) => {
    clearTimeout(pending.current);
    if (next !== value) notify.current?.({ target: { value: next, name: props.name, id: props.id }, currentTarget: input.current });
  };
  useEffect(() => {
    if (draft === value || composing) return undefined;
    pending.current = setTimeout(() => commit(draft), delay);
    return () => clearTimeout(pending.current);
  }, [draft, value, delay, composing]);
  return <input {...props} ref={input} value={draft} onChange={(event) => setDraft(event.target.value)}
    onBlur={(event) => { if (!composing) commit(draft); onBlur?.(event); }}
    onKeyDown={(event) => { if (event.key === 'Enter' && !composing) commit(draft); onKeyDown?.(event); }}
    onCompositionStart={(event) => { setComposing(true); onCompositionStart?.(event); }}
    onCompositionEnd={(event) => { setComposing(false); onCompositionEnd?.(event); }} />;
}
// Remount the input draft when its Account/Guest/Moment/Sample identity changes.
export default function DebouncedFilterInput({ scopeKey, ...props }) {
  return <SearchDraft key={scopeKey} {...props} />;
}
