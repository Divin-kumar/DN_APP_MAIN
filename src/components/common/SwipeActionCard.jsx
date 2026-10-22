import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { resolveSwipeGesture } from '../../utils/swipeGestures';
import { getVisibleViewport } from '../../utils/overlayPosition';
import { computeSwipeMenuPlacement } from '../../utils/swipeMenuPlacement';

// A swipe in EITHER direction opens the same compact glass action menu.
// The card never slides, and Delete is only an explicit, confirmation-gated item.
export default function SwipeActionCard({
  as: Root = 'article', className = '', mainClassName = '',
  label = 'Card', role = 'group', otherActions = [], onDelete, openOnTap = false, children,
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const rootRef = useRef(null);
  const popupRef = useRef(null);
  const gesture = useRef(null);
  const suppressClick = useRef(0);
  const focusOnOpen = useRef(false);
  const menuId = useId();
  const actions = [
    ...otherActions.filter((action) => typeof action?.onClick === 'function'),
    ...(onDelete ? [{ label: 'Delete', icon: Trash2, onClick: onDelete, danger: true }] : []),
  ];

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) rootRef.current?.focus();
  };
  const showMenu = (isTouch = false, fromKeyboard = false) => {
    if (!actions.length || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const viewport = getVisibleViewport(window);
    setPosition(computeSwipeMenuPlacement({
      anchor: rect, viewport, count: actions.length,
      bottomReserve: viewport.width < 768 ? 80 : 12,
    }));
    focusOnOpen.current = fromKeyboard;
    if (!open && isTouch) {
      try { navigator.vibrate?.(8); } catch { /* Optional device capability */ }
    }
    setOpen(true);
  };
  const finishGesture = (x, y, isTouch) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start) return;
    // The axis-dominant threshold rejects vertical scrolls and small taps.
    if (!resolveSwipeGesture(start, { x, y }).action) return;
    suppressClick.current = Date.now();
    showMenu(isTouch);
  };
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => {
      if (rootRef.current?.contains(event.target) || popupRef.current?.contains(event.target)) return;
      close();
    };
    const onScroll = (event) => {
      if (popupRef.current?.contains(event.target)) return;
      close();
    };
    const onResize = () => close();
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    if (focusOnOpen.current) {
      popupRef.current?.querySelector('button:not([disabled])')?.focus();
      focusOnOpen.current = false;
    }
    return () => {
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
    };
  }, [open]);

  const handleCardKey = (event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (['Enter', ' ', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      if (open) close(true);
      else showMenu(false, true);
    }
  };
  const handleMenuKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const items = [...popupRef.current.querySelectorAll('button:not([disabled])')];
      const index = items.indexOf(document.activeElement);
      const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }
  };
  const perform = (callback) => {
    close();
    callback?.();
  };
  return (
    <>
      <Root ref={rootRef} tabIndex={0} role={role} aria-label={`${label}. Swipe either direction for actions.`}
        aria-expanded={open} aria-controls={menuId}
        className={`dn-swipe-surface ${className}`}
        onKeyDown={handleCardKey}
        onPointerDownCapture={(event) => {
          if (event.pointerType === 'touch') return;
          gesture.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUpCapture={(event) => {
          if (event.pointerType !== 'touch') finishGesture(event.clientX, event.clientY, false);
        }}
        onPointerCancelCapture={() => { gesture.current = null; }}
        onTouchStartCapture={(event) => {
          if (event.touches.length !== 1) { gesture.current = null; return; }
          gesture.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }}
        onTouchEndCapture={(event) => {
          const touch = event.changedTouches[0];
          if (touch) finishGesture(touch.clientX, touch.clientY, true);
        }}
        onTouchCancelCapture={() => { gesture.current = null; }}
        onClickCapture={(event) => {
          // Suppress the synthetic click after a real swipe, not later legitimate taps.
          if (!suppressClick.current || Date.now() - suppressClick.current > 650) {
            suppressClick.current = 0;
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = 0;
        }}
        onClick={(event) => {
          if (!openOnTap || event.defaultPrevented || event.target.closest('.dn-swipe-popup')) return;
          if (event.target.closest('button, a, input, select, textarea') &&
              !event.target.closest('.code-list-row')) return;
          if (open) close();
          else showMenu();
        }}>
        <div className={`dn-swipe-main ${mainClassName}`} style={{ touchAction: 'pan-y' }}>
          {children}
        </div>
      </Root>
      {open && position && createPortal(
        <div id={menuId} ref={popupRef} role="menu"
          className="dn-swipe-popup" aria-label={`Actions for ${label}`}
          style={{
            position: 'fixed', top: position.top, left: position.left,
            width: position.width, maxHeight: position.maxHeight,
          }}
          onKeyDown={handleMenuKey}>
          {actions.map(({ label: actionLabel, icon: Icon, onClick, danger }, i) => (
            <button key={`${actionLabel}-${i}`} role="menuitem" type="button"
              className={`dn-swipe-popup-item${danger ? ' is-danger' : ''}`}
              onClick={() => perform(onClick)}>
              {Icon ? <Icon size={17} strokeWidth={1.9} aria-hidden="true" /> : null}
              <span>{actionLabel}</span>
            </button>
          ))}
        </div>, document.body)}
    </>
  );
}
