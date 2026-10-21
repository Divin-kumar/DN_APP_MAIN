import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { resolveSwipeGesture } from '../../utils/swipeGestures';

export default function SwipeActionCard({ as: Root = 'article', className = '', mainClassName = '', label = 'Card', otherActions = [], onDelete, children }) {
  const [open, setOpen] = useState(null);
  const rootRef = useRef(null);
  const pointer = useRef('mouse');
  const suppressClick = useRef(false);
  const pointerStart = useRef(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(null); };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);
  const reveal = (next, touch = false) => {
    if (next !== open && next && touch) { try { navigator.vibrate?.(8); } catch { /* not supported */ } }
    setOpen(next);
  };
  const perform = (cb) => { setOpen(null); cb?.(); };
  const otherWidth = otherActions.length ? Math.min(otherActions.length * 74, 222) : 0;
  const handlePointerDown = (e) => {
    if (e.target.closest('button, a, input, textarea, select')) return;
    pointerStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    pointer.current = e.pointerType;
  };
  const handlePointerUp = (e) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const result = resolveSwipeGesture(start, { x: e.clientX, y: e.clientY });
    if (!result.action) return;
    suppressClick.current = true;
    reveal(result.action, e.pointerType === 'touch');
  };
  return (
    <Root ref={rootRef} tabIndex={0} role="group" className={`dn-swipe-surface ${className}${open ? ` dn-swipe-open-${open}` : ''}`}
      aria-label={`${label}. Left swipe for actions, right swipe for Delete. Arrow keys reveal trays.`}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Escape') { e.preventDefault(); reveal(null); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); reveal('other'); }
        if (e.key === 'ArrowRight' && onDelete) { e.preventDefault(); reveal('delete'); }
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(open === 'other' ? null : 'other'); }
      }}>
      <div className="dn-swipe-tray dn-swipe-tray-other" aria-hidden={open !== 'other'}>
        {otherActions.map(({ label: name, icon: Icon, onClick }) => (
          <button key={name} type="button" className="dn-swipe-action" tabIndex={open === 'other' ? 0 : -1}
            onClick={() => perform(onClick)} aria-label={`${name} ${label}`}>
            {Icon ? <Icon size={17} aria-hidden="true" /> : null}<span>{name}</span>
          </button>
        ))}
      </div>
      <div className="dn-swipe-tray dn-swipe-tray-delete" aria-hidden={open !== 'delete'}>
        {onDelete ? <button type="button" className="dn-swipe-action is-danger" tabIndex={open === 'delete' ? 0 : -1}
          onClick={() => perform(onDelete)}><Trash2 size={17} aria-hidden="true" /><span>Delete</span></button> : null}
      </div>
      <motion.div className={`dn-swipe-main ${mainClassName}`}
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => { suppressClick.current = false; handlePointerDown(e); }}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { pointerStart.current = null; }}
        onClickCapture={(e) => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false; } }}
        animate={{ x: open === 'other' ? -otherWidth : open === 'delete' ? 76 : 0 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34, mass: .82 }}
>
        {children}
      </motion.div>
    </Root>
  );
}
