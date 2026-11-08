// This file creates reusable popup dialogs and confirmation windows.
// It keeps the app's modal behavior consistent and helps prevent focus or page-scroll issues during form flows.
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useDragControls, usePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { observeDialogViewport } from '../../utils/dialogViewport';
import { lockDialogScroll } from '../../utils/dialogScrollLock';
import './ModalDialog.css';

export default function ModalDialog({ title, onClose, children, variant = 'dialog', className = '', swipeDismiss = true }) {
  const reducedMotion = useReducedMotion();
  const [isPresent, safeToRemove] = usePresence();
  // Every phone-bottom sheet uses one motion path, rather than old CSS entry
  // keyframes fighting Framer's exit. Desktop dialogs stay unchanged.
  const mobileMedia = '(max-width: 760px), (orientation: landscape) and (max-height: 500px) and (pointer: coarse)';
  const [isMobileSheet, setMobileSheet] = useState(() => window.matchMedia(mobileMedia).matches);
  const [swipeClosing, setSwipeClosing] = useState(false);
  const dismissRequested = useRef(false);
  const dragControls = useDragControls();
  const bodySwipe = useRef(null);
  const isSlidingSheet = isMobileSheet;
  const allowsSwipe = isSlidingSheet && swipeDismiss;
  useEffect(() => {
    const media = window.matchMedia(mobileMedia);
    const update = () => setMobileSheet(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  // The header remains directly draggable. From the rest of a phone sheet,
  // allow a deliberate downward pull on noninteractive content only when its
  // scrolling body is already at the top. Native vertical scrolling wins.
  const startBodySwipe = (event) => {
    bodySwipe.current = null;
    const body = bodyRef.current;
    if (!allowsSwipe || swipeClosing || event.touches.length !== 1 || !body || body.scrollTop > 1) return;
    if (event.target.closest?.('button,a,input,textarea,select,label,[contenteditable="true"],[role="button"],[role="textbox"],[role="slider"],[role="listbox"],[data-swipe-ignore]')) return;
    let node = event.target;
    while (node && node !== body) {
      if (node instanceof Element && node.scrollHeight > node.clientHeight + 3 &&
        /auto|scroll/.test(getComputedStyle(node).overflowY)) return;
      node = node.parentElement;
    }
    const touch = event.touches[0];
    bodySwipe.current = { x: touch.clientX, y: touch.clientY };
  };
  const endBodySwipe = (event) => {
    const start = bodySwipe.current;
    bodySwipe.current = null;
    const touch = event.changedTouches[0];
    if (!start || !touch || bodyRef.current?.scrollTop > 1 || swipeClosing) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (dy >= 118 && dy > Math.abs(dx) * 1.6) setSwipeClosing(true);
  };
  const startSheetDrag = (event) => {
    if (!allowsSwipe || swipeClosing || event.button !== 0 || !event.isPrimary) return;
    // Do not steal text selection, fields, footer actions or nested scroll.
    // On an iPhone, the sheet's grip and title header are the drag region.
    if (event.target.closest('button,a,input,textarea,select,label,[contenteditable="true"],[role="button"]')) return;
    if (event.target === dialogRef.current || event.target.closest('.dn-modal-header')) dragControls.start(event);
  };
  const endSheetDrag = (_, info) => {
    if (info.offset.y > 125 || (info.offset.y > 48 && info.velocity.y > 850)) {
      setSwipeClosing(true);
    }
    // Short pulls automatically spring to origin within the drag constraints.
  };
  // If an existing guarded onClose refuses to dismiss (for example during a
  // pending save), restore the sheet instead of leaving it below the viewport.
  useEffect(() => {
    if (!swipeClosing) return undefined;
    const id = window.setTimeout(() => {
      if (dialogRef.current && isPresent) {
        setSwipeClosing(false);
        dismissRequested.current = false;
      }
    }, 750);
    return () => window.clearTimeout(id);
  }, [swipeClosing, isPresent]);
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const backdropRef = useRef(null);
  const bodyRef = useRef(null);
  const onCloseRef = useRef(onClose);
  // Close actions use the same reverse sheet animation as a downward swipe.
  // Re-evaluate the media query for the Escape listener installed on mount.
  const requestClose = () => {
    if (swipeDismiss && window.matchMedia(mobileMedia).matches) setSwipeClosing(true);
    else onCloseRef.current();
  };
  // Capture before portal children mount: React autoFocus can run before this
  // component's effect and would otherwise remember a disappearing input.
  const previousFocusRef = useRef(typeof document === 'undefined' ? null : document.activeElement);
  const titleId = useId();

  useLayoutEffect(() => observeDialogViewport(window, (viewport, layout) => {
    const backdrop = backdropRef.current;
    if (!backdrop) return;
    backdrop.style.setProperty('--dn-dialog-viewport-height', `${viewport.height}px`);
    backdrop.style.setProperty('--dn-dialog-viewport-width', `${viewport.width}px`);
    backdrop.style.setProperty('--dn-dialog-viewport-top', `${viewport.top}px`);
    backdrop.style.setProperty('--dn-dialog-viewport-left', `${viewport.left}px`);
    backdrop.style.setProperty('--dn-dialog-layout-height', `${layout.height}px`);
    backdrop.style.setProperty('--dn-dialog-layout-width', `${layout.width}px`);
    backdrop.style.setProperty('--dn-dialog-inset-bottom', `${Math.max(0, layout.height - viewport.top - viewport.height)}px`);
    backdrop.style.setProperty('--dn-dialog-inset-right', `${Math.max(0, layout.width - viewport.left - viewport.width)}px`);
    backdrop.dataset.keyboardOpen = String(viewport.keyboardOpen);
    const active = document.activeElement;
    const body = bodyRef.current;
    if (!viewport.keyboardOpen || !body?.contains(active) || !active.matches('input, textarea, [contenteditable="true"]')) return;
    const field = active.getBoundingClientRect();
    const visible = body.getBoundingClientRect();
    const footer = body.querySelector('.event-form-actions, .event-greeting-editor-actions, .form-actions, .dialog-actions, .settings-actions, .modal-confirm-actions, .dn-list-controls-footer');
    const footerTop = footer && getComputedStyle(footer).position === 'sticky' ? footer.getBoundingClientRect().top : visible.bottom;
    const visibleBottom = Math.min(visible.bottom, Math.max(visible.top, footerTop));
    // Keyboard-only CSS bounds long textareas, leaving caret scrolling inside
    // the field. Never jump the entire body to the end of oversized content.
    if (field.height > visibleBottom - visible.top - 24) return;
    if (field.bottom > visibleBottom - 12) body.scrollTop += field.bottom - visibleBottom + 12;
    else if (field.top < visible.top + 12) body.scrollTop -= visible.top + 12 - field.top;
  }), []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = previousFocusRef.current;
    const unlockScroll = lockDialogScroll(window);
    closeButtonRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event) => {
      // A nested original preview owns focus/Escape until it closes.
      const activeDialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (activeDialogs[activeDialogs.length - 1] !== dialogRef.current) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])]
        .filter((element) => element.getAttribute('aria-hidden') !== 'true' && element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      unlockScroll();
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <motion.div
      ref={backdropRef}
      className={`dn-modal-backdrop dn-modal-viewport${variant === 'drawer' ? ' dn-modal-backdrop-drawer' : ''}${isSlidingSheet ? ' dn-modal-slide-scrim' : ''}`}
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: isPresent || isSlidingSheet ? 1 : 0 }}
      exit={{ opacity: 0, transition: reducedMotion ? { duration: 0 } : isSlidingSheet ? { delay: .37, duration: .14 } : { duration: .19 } }}
      transition={{ duration: reducedMotion ? 0 : 0.19 }}
      onAnimationComplete={() => { if (!isPresent) safeToRemove?.(); }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}
    >
      <motion.section ref={dialogRef} className={`dn-modal${variant === 'drawer' ? ' dn-modal-drawer' : ''}${className ? ` ${className}` : ''}${allowsSwipe ? ' dn-modal-swipeable' : ''}`}
        role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        drag={allowsSwipe ? 'y' : false} dragListener={false} dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: .72 }} dragMomentum={false}
        onPointerDown={startSheetDrag} onDragEnd={endSheetDrag}
        initial={reducedMotion ? false : isSlidingSheet ? { opacity: 1, scale: 1, y: '100%' } : { opacity: .8, scale: variant === 'drawer' ? 1 : .98, y: variant === 'drawer' ? 148 : 20 }}
        animate={{ opacity: isSlidingSheet ? 1 : (isPresent ? 1 : .85), scale: isSlidingSheet || isPresent ? 1 : .98, y: isPresent && !swipeClosing ? 0 : (isSlidingSheet ? '100%' : (variant === 'drawer' ? 148 : 20)) }}
        exit={{ opacity: isSlidingSheet ? 1 : .85, scale: isSlidingSheet ? 1 : .98, y: isSlidingSheet ? '100%' : (variant === 'drawer' ? 148 : 20) }}
        transition={reducedMotion ? { duration: 0 } : {
          duration: isSlidingSheet ? .37 : (variant === 'drawer' ? .45 : .32),
          ease: [0.22, 1, 0.36, 1],
          opacity: { duration: isSlidingSheet ? 0 : .28 },
        }}
        onAnimationComplete={() => {
          if (!swipeClosing || dismissRequested.current || !isPresent) return;
          dismissRequested.current = true;
          onCloseRef.current();
        }}>
        <div className="dn-modal-header" style={styles.header}>
          <h3 id={titleId} style={{ margin: 0 }}>{title}</h3>
          <button ref={closeButtonRef} type="button" className="modal-close-button" onClick={requestClose} aria-label="Close dialog"><X size={20} strokeWidth={1.9} aria-hidden="true" /></button>
        </div>
        <div className="dn-modal-body" ref={bodyRef} onTouchStartCapture={startBodySwipe}
          onTouchEndCapture={endBodySwipe} onTouchCancelCapture={() => { bodySwipe.current = null; }}>{children}</div>
      </motion.section>
    </motion.div>,
    document.body,
  );
}

export function ConfirmDialog({ title, message, onCancel, onConfirm, confirmLabel = 'Delete', busy = false, error = '' }) {
  return (
    <ModalDialog title={title} onClose={onCancel} swipeDismiss={false}>
      <p style={styles.message}>{message}</p>
      {error ? <p className="quick-create-error" role="alert">{error}</p> : null}
      <div className="modal-confirm-actions" style={styles.actions}>
        <button type="button" className="secondaryButton modal-action-button" disabled={busy} onClick={onCancel}>Cancel</button>
        <button type="button" className="modal-danger-button modal-action-button" disabled={busy} onClick={onConfirm}>{busy ? 'Saving…' : confirmLabel}</button>
      </div>
    </ModalDialog>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '18px',
  },
  message: {
    margin: '0 0 18px',
    color: 'var(--ink-soft)',
    lineHeight: 1.6,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px',
  },
};
