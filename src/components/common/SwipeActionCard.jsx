import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { resolveSwipeGesture } from '../../utils/swipeGestures';

// The entire card is the gesture surface, including main buttons/links.
// Touch uses native Touch Events for iOS Safari; mouse/pen use Pointer Events.
// Neither gesture ever runs an action: it only reveals a full-size action tray.
export default function SwipeActionCard({
  as: Root = 'article', className = '', mainClassName = '', label = 'Card',
  role = 'group', otherActions = [], onDelete, openOnTap = false, children,
}) {
  const [open, setOpen] = useState(null);
  const rootRef = useRef(null);
  const gesture = useRef(null);
  const suppressClick = useRef(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(null);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const reveal = (next, isTouch = false) => {
    if (next && next !== open && isTouch) {
      try { navigator.vibrate?.(8); } catch { /* Native haptics are optional */ }
    }
    setOpen(next);
  };
  const finishGesture = (x, y, isTouch) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start) return;
    const result = resolveSwipeGesture(start, { x, y });
    if (!result.action || (result.action === 'delete' && !onDelete) ||
        (result.action === 'other' && !otherActions.length)) return;
    suppressClick.current = true;
    reveal(result.action, isTouch);
  };
  const startGesture = (x, y) => { gesture.current = { x, y }; };
  const perform = (callback) => {
    setOpen(null);
    callback?.();
  };
  const handleKeyDown = (event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape') { event.preventDefault(); reveal(null); }
    else if (event.key === 'ArrowLeft' && otherActions.length) { event.preventDefault(); reveal('other'); }
    else if (event.key === 'ArrowRight' && onDelete) { event.preventDefault(); reveal('delete'); }
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); reveal(open === 'other' ? null : 'other');
    }
  };
  return (
    <Root ref={rootRef} role={role} tabIndex={0}
      className={`dn-swipe-surface ${className}${open ? ` dn-swipe-open-${open}` : ''}`}
      aria-label={`${label}. Swipe left for actions, right for Delete. Arrow keys reveal actions.`}
      aria-expanded={Boolean(open)}
      onKeyDown={handleKeyDown}
      onPointerDownCapture={(event) => {
        if (event.pointerType === 'touch' || event.target.closest('.dn-swipe-tray')) return;
        suppressClick.current = false;
        startGesture(event.clientX, event.clientY);
      }}
      onPointerUpCapture={(event) => {
        if (event.pointerType !== 'touch') finishGesture(event.clientX, event.clientY, false);
      }}
      onPointerCancelCapture={() => { gesture.current = null; }}
      onTouchStartCapture={(event) => {
        if (event.touches.length !== 1 || event.target.closest('.dn-swipe-tray')) return;
        suppressClick.current = false;
        startGesture(event.touches[0].clientX, event.touches[0].clientY);
      }}
      onTouchEndCapture={(event) => {
        const touch = event.changedTouches[0];
        if (touch) finishGesture(touch.clientX, touch.clientY, true);
      }}
      onTouchCancelCapture={() => { gesture.current = null; }}
      onClickCapture={(event) => {
        if (!suppressClick.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClick.current = false;
      }}
      onClick={(event) => {
        if (!openOnTap || event.defaultPrevented || event.target.closest('.dn-swipe-tray')) return;
        // Nested links/buttons keep their own behavior; Code List row is the
        // deliberate tap-to-reveal exception.
        if (event.target.closest('button, a, input, select, textarea') &&
            !event.target.closest('.code-list-row')) return;
        setOpen((current) => current === 'other' ? null : 'other');
      }}>
      <div className="dn-swipe-tray dn-swipe-tray-other" aria-hidden={open !== 'other'}>
        <div className="dn-swipe-tray-inner">
          {otherActions.map(({ label: actionLabel, icon: Icon, onClick }) => (
            <button key={actionLabel} type="button" className="dn-swipe-action"
              tabIndex={open === 'other' ? 0 : -1}
              aria-label={`${actionLabel} ${label}`}
              onClick={() => perform(onClick)}>
              {Icon ? <Icon size={21} strokeWidth={1.9} aria-hidden="true" /> : null}
              <span>{actionLabel}</span>
            </button>
          ))}
        </div>
      </div>
      {onDelete ? (
        <div className="dn-swipe-tray dn-swipe-tray-delete" aria-hidden={open !== 'delete'}>
          <div className="dn-swipe-tray-inner">
            <button type="button" className="dn-swipe-action is-danger"
              tabIndex={open === 'delete' ? 0 : -1}
              aria-label={`Delete ${label}`}
              onClick={() => perform(onDelete)}>
              <Trash2 size={21} strokeWidth={1.9} aria-hidden="true" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      ) : null}
      <motion.div className={`dn-swipe-main ${mainClassName}`}
        style={{ touchAction: 'pan-y' }}
        animate={open ? { scale: 0.995 } : { scale: 1 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 440, damping: 37, mass: 0.8 }}>
        {children}
      </motion.div>
    </Root>
  );
}
