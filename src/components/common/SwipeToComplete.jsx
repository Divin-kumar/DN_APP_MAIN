import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import './SwipeToComplete.css';

// Activity cards reuse this deliberate gesture for Complete and Reopen. A
// context menu always supplies the non-gesture equivalent.
export default function SwipeToComplete({ children, label = 'Activity', onComplete, disabled = false,
  actionLabel = 'Complete', actionIcon: ActionIcon = Check, direction = 'both' }) {
  const root = useRef(null);
  const gesture = useRef(null);
  const suppressClickUntil = useRef(0);
  const saving = useRef(false);
  const mounted = useRef(true);
  const [drag, setDrag] = useState({ x: 0, ready: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    mounted.current = true;
    const otherSwipe = (event) => { if (event.detail !== root.current) { gesture.current = null; setDrag({ x: 0, ready: false }); } };
    const scroll = () => { gesture.current = null; setDrag({ x: 0, ready: false }); };
    window.addEventListener('dn:activity-swipe', otherSwipe);
    window.addEventListener('scroll', scroll, true);
    return () => { mounted.current = false; gesture.current = null;
      window.removeEventListener('dn:activity-swipe', otherSwipe); window.removeEventListener('scroll', scroll, true); };
  }, []);
  useEffect(() => { if (disabled) { gesture.current = null; setDrag({ x: 0, ready: false }); } }, [disabled]);
  const blocked = () => !mounted.current || disabled || saving.current || typeof onComplete !== 'function';
  const reset = () => { if (mounted.current) setDrag({ x: 0, ready: false }); };
  const complete = () => {
    if (blocked()) { reset(); return; }
    saving.current = true;
    setBusy(true);
    let result;
    try { result = onComplete(); }
    catch { result = Promise.reject(new Error('Completion failed')); }
    // The caller owns persistence and error feedback; never leave an unhandled rejection.
    Promise.resolve(result).catch(() => {}).finally(() => {
      saving.current = false;
      if (mounted.current) { setBusy(false); reset(); }
    });
  };
  const start = (x, y, pointerId) => {
    if (blocked()) return;
    suppressClickUntil.current = 0;
    window.dispatchEvent(new CustomEvent('dn:activity-swipe', { detail: root.current }));
    window.dispatchEvent(new CustomEvent('dn:record-menu', { detail: root.current }));
    const width = root.current?.getBoundingClientRect().width || 300;
    gesture.current = { x, y, pointerId, startedAt: Date.now(), threshold: Math.max(72, Math.min(120, Math.round(width * .28))), moved: false, horizontal: false };
  };
  const move = (x, y, event) => {
    const current = gesture.current;
    if (!current || blocked()) return;
    const dx = x - current.x, dy = y - current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 12) current.moved = true;
    if (!current.horizontal && Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx) * 1.15) {
      suppressClickUntil.current = Date.now() + 650;
      gesture.current = null;
      reset();
      return;
    }
    if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    current.horizontal = true;
    // Capture only after a drag starts, so an ordinary tap still reaches the row button.
    if (event?.pointerType && event.currentTarget.hasPointerCapture?.(event.pointerId) === false) {
      try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* Optional on older browsers. */ }
    }
    const allowed = direction !== 'left' || dx < 0;
    setDrag({ x: allowed ? Math.max(-128, Math.min(128, dx)) : 0, ready: allowed && Math.abs(dx) >= current.threshold });
  };
  const finish = (x, y, pointerId) => {
    const current = gesture.current;
    if (!current || (current.pointerId != null && current.pointerId !== pointerId)) return;
    gesture.current = null;
    const dx = x - current.x, dy = y - current.y;
    if (current.moved || Math.max(Math.abs(dx), Math.abs(dy)) > 12) suppressClickUntil.current = Date.now() + 650;
    const elapsed = Math.max(1, Date.now() - current.startedAt);
    const fast = elapsed >= 25 && elapsed <= 180 && Math.abs(dx) >= 56 && Math.abs(dx) / elapsed >= .65;
    if (blocked() || (direction === 'left' && dx >= 0) || !current.horizontal
      || (Math.abs(dx) < current.threshold && !fast) || Math.abs(dx) < Math.abs(dy) * 1.5) { reset(); return; }
    complete();
  };
  const cancel = () => { gesture.current = null; reset(); };
  return <div ref={root} className={`dn-swipe-complete${drag.x ? ' is-dragging' : ''}${drag.ready ? ' is-ready' : ''}`}
    role="group" aria-label={`${label}. Swipe ${direction === 'left' ? 'left' : 'left or right'} to ${actionLabel.toLowerCase()}, or press Control or Command Enter. Activity options also provides this action.`}
    aria-busy={busy} aria-keyshortcuts="Control+Enter Meta+Enter"
    onDragStartCapture={(event) => event.preventDefault()}
    onKeyDownCapture={(event) => {
      if (event.target?.closest?.('[data-swipe-ignore]')) return;
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault(); event.stopPropagation(); complete();
      } else if (event.key === 'Enter' || event.key === ' ') suppressClickUntil.current = 0;
    }}
    onPointerDownCapture={(event) => {
      if (event.pointerType === 'touch' || event.button !== 0 || event.isPrimary === false
        || event.target?.closest?.('[data-swipe-ignore], a, input, select, textarea, details, .dn-attachment-tile, .event-activity-expense-disclosure')) return;
      start(event.clientX, event.clientY, event.pointerId);
    }}
    onPointerMoveCapture={(event) => {
      if (event.pointerType !== 'touch' && gesture.current?.pointerId === event.pointerId) move(event.clientX, event.clientY, event);
    }}
    onPointerUpCapture={(event) => { if (event.pointerType !== 'touch') finish(event.clientX, event.clientY, event.pointerId); }}
    onPointerCancelCapture={(event) => {
      if (event.pointerType !== 'touch' && gesture.current?.pointerId === event.pointerId) cancel();
    }}
    onTouchStartCapture={(event) => {
      if (event.touches.length !== 1 || event.target?.closest?.('[data-swipe-ignore], a, input, select, textarea, details, .dn-attachment-tile, .event-activity-expense-disclosure')) { cancel(); return; }
      const touch = event.touches[0]; start(touch.clientX, touch.clientY, touch.identifier);
    }}
    onTouchMoveCapture={(event) => {
      if (event.touches.length !== 1) { cancel(); return; }
      const touch = event.touches[0];
      if (gesture.current?.pointerId === touch.identifier) move(touch.clientX, touch.clientY);
    }}
    onTouchEndCapture={(event) => {
      const touch = [...event.changedTouches].find((item) => item.identifier === gesture.current?.pointerId);
      if (touch) finish(touch.clientX, touch.clientY, touch.identifier);
    }}
    onTouchCancelCapture={cancel}
    onClickCapture={(event) => {
      if (event.target?.closest?.('[data-swipe-ignore], .dn-attachment-tile, .event-activity-expense-disclosure')) return;
      if (blocked() || (event.detail !== 0 && Date.now() < suppressClickUntil.current)) {
        event.preventDefault(); event.stopPropagation(); suppressClickUntil.current = 0;
      }
    }}>
    <div className="dn-swipe-complete-feedback" aria-hidden="true" style={{ justifyContent: drag.x < 0 ? 'flex-end' : 'flex-start' }}>
      <ActionIcon size={16} /><span>{busy ? 'Saving…' : drag.ready ? `Release to ${actionLabel.toLowerCase()}` : actionLabel}</span>
    </div>
    <div className="dn-swipe-complete-content" style={{ transform: `translateX(${drag.x}px)` }}>{children}</div>
  </div>;
}
