import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ellipsis, Trash2 } from 'lucide-react';
import { resolveSwipeGesture } from '../../utils/swipeGestures';
import { getVisibleViewport } from '../../utils/overlayPosition';
import { computeSwipeMenuPlacement, getSwipeDockReserve } from '../../utils/swipeMenuPlacement';

// A swipe in EITHER direction opens the same compact glass action menu.
// The card never slides, and Delete is only an explicit, confirmation-gated item.
export default function SwipeActionCard({
  as: Root = 'article', className = '', mainClassName = '',
  label = 'Card', role = 'group', otherActions = [], onDelete, openOnTap = false, children,
  onOpen, menuButton = false, menuLabel = 'Activity options', swipeEnabled = true, disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
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
    if (restoreFocus) (triggerRef.current || rootRef.current)?.focus({ preventScroll: true });
  };
  const positionMenu = () => {
    const anchor = (triggerRef.current || rootRef.current)?.getBoundingClientRect();
    if (!anchor) return;
    const viewport = getVisibleViewport(window);
    if (anchor.bottom <= viewport.top || anchor.top >= viewport.top + viewport.height) { close(); return; }
    const dock = document.querySelector('.mobile-tabbar');
    const visibleDock = dock && getComputedStyle(dock).display !== 'none';
    const bottomReserve = getSwipeDockReserve({
      viewport,
      dockRect: visibleDock ? dock.getBoundingClientRect() : null,
      dockVisible: Boolean(visibleDock),
    });
    setPosition(computeSwipeMenuPlacement({
      anchor, viewport, count: actions.length, bottomReserve,
    }));
  };
  const showMenu = (isTouch = false, fromKeyboard = false) => {
    if (disabled || !actions.length || !rootRef.current) return;
    positionMenu();
    focusOnOpen.current = fromKeyboard;
    window.dispatchEvent(new CustomEvent('dn:record-menu', { detail: menuId }));
    window.dispatchEvent(new CustomEvent('dn:activity-swipe', { detail: rootRef.current }));
    if (!open && isTouch) {
      try { navigator.vibrate?.(8); } catch { /* Optional device capability */ }
    }
    setOpen(true);
  };
  // The same click can collapse a filter panel before this menu mounts. Measure
  // its final anchor after that layout commit, before the browser paints it.
  useLayoutEffect(() => { if (open) positionMenu(); }, [open]);
  const finishGesture = (x, y, isTouch) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start) return;
    // Suppress a ghost click after any real drag, even when too short or
    // vertical to open actions. Ordinary taps remain navigational.
    if (Math.hypot(x - start.x, y - start.y) > 12) suppressClick.current = Date.now();
    if (!resolveSwipeGesture(start, { x, y }).action) return;
    suppressClick.current = Date.now();
    showMenu(isTouch);
  };
  useEffect(() => {
    if (!open) return undefined;
    let frame;
    const outside = (event) => {
      if (rootRef.current?.contains(event.target) || popupRef.current?.contains(event.target)) return;
      close();
    };
    const onScroll = (event) => {
      if (popupRef.current?.contains(event.target)) return;
      // Follow a still-visible record during layout/viewport changes. A queued
      // focus scroll must not dismiss the action the user has just opened.
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(positionMenu);
    };
    const onResize = () => onScroll();
    const onOtherMenu = (event) => { if (event.detail !== menuId) close(); };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('dn:record-menu', onOtherMenu);
    window.visualViewport?.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('scroll', onResize);
    if (focusOnOpen.current) {
      popupRef.current?.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
      focusOnOpen.current = false;
    }
    return () => {
      if (frame) cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', outside);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('dn:record-menu', onOtherMenu);
      window.visualViewport?.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('scroll', onResize);
    };
  }, [open]);

  const handleCardKey = (event) => {
    if (event.target !== event.currentTarget) return;
    if (onOpen && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      if (!disabled) onOpen();
      return;
    }
    if (!actions.length) return;
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
    } else if (event.key === 'Tab') {
      close();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const items = popupRef.current.querySelectorAll('button:not([disabled])');
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus({ preventScroll: true });
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const items = [...popupRef.current.querySelectorAll('button:not([disabled])')];
      const index = items.indexOf(document.activeElement);
      const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus({ preventScroll: true });
    }
  };
  const perform = (callback) => {
    close(true);
    // Callers retain their draft/error treatment. A rejected menu action must
    // never become an unhandled rejection or bypass their recovery UI.
    try { Promise.resolve(callback?.()).catch(() => {}); } catch { /* Caller reports the failure. */ }
  };
  return (
    <>
      <Root ref={rootRef} tabIndex={menuButton && !onOpen ? -1 : 0} role={role} aria-label={onOpen ? `Open ${label}` : swipeEnabled ? `${label}. Swipe either direction for actions.` : `${label} actions`}
        aria-description={swipeEnabled && actions.length ? 'Swipe left or right to open actions. Use the left or right arrow key for keyboard access.' : undefined}
        aria-expanded={!menuButton && actions.length ? open : undefined} aria-controls={!menuButton && actions.length && open ? menuId : undefined}
        className={`dn-swipe-surface ${className}`}
        onKeyDown={handleCardKey}
        onPointerDownCapture={(event) => {
          if (!swipeEnabled || disabled || event.pointerType === 'touch' || event.target.closest?.('[data-swipe-ignore]')) return;
          // A new intentional press must not inherit the previous swipe's click guard.
          suppressClick.current = 0;
          gesture.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUpCapture={(event) => {
          if (swipeEnabled && !disabled && event.pointerType !== 'touch') finishGesture(event.clientX, event.clientY, false);
        }}
        onPointerCancelCapture={() => { gesture.current = null; }}
        onTouchStartCapture={(event) => {
          if (!swipeEnabled || disabled || event.target.closest?.('[data-swipe-ignore]') || event.touches.length !== 1) { gesture.current = null; return; }
          suppressClick.current = 0;
          gesture.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }}
        onTouchEndCapture={(event) => {
          const touch = event.changedTouches[0];
          if (swipeEnabled && !disabled && touch) finishGesture(touch.clientX, touch.clientY, true);
        }}
        onTouchCancelCapture={() => { gesture.current = null; }}
        onClickCapture={(event) => {
          if (event.target.closest?.('[data-swipe-ignore], .dn-swipe-popup')) return;
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
          if (disabled || event.defaultPrevented || event.target.closest('.dn-swipe-popup, [data-swipe-ignore], details, summary')) return;
          if (event.target.closest('button, a, input, select, textarea') &&
              !event.target.closest('.code-list-row')) return;
          if (onOpen) { onOpen(); return; }
          if (!openOnTap) return;
          if (open) close();
          else showMenu();
        }}>
        <div className={`dn-swipe-main ${mainClassName}`} style={{ touchAction: 'pan-y' }}>
          {children}
          {menuButton ? <button ref={triggerRef} type="button" data-swipe-ignore className="dn-record-menu-trigger"
            aria-label={menuLabel} aria-haspopup="menu" aria-controls={open ? menuId : undefined} aria-expanded={open} disabled={disabled}
            onClick={(event) => { event.stopPropagation(); if (open) close(true); else showMenu(false, true); }}>
            <Ellipsis size={19} aria-hidden="true" />
          </button> : null}
        </div>
      </Root>
      {open && position && createPortal(
        <div id={menuId} ref={popupRef} role="menu" data-swipe-ignore
          className="dn-swipe-popup" aria-label={`Actions for ${label}`}
          style={{
            position: 'fixed', top: position.top, left: position.left,
            width: position.width, maxHeight: position.maxHeight,
          }}
          onKeyDown={handleMenuKey}>
          {actions.map(({ label: actionLabel, icon: Icon, onClick, danger, disabled: actionDisabled }, i) => (
            <button key={`${actionLabel}-${i}`} role="menuitem" type="button"
              disabled={disabled || actionDisabled}
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
