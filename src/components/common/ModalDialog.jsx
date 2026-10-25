// This file creates reusable popup dialogs and confirmation windows.
// It keeps the app's modal behavior consistent and helps prevent focus or page-scroll issues during form flows.
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { observeDialogViewport } from '../../utils/dialogViewport';
import { lockDialogScroll } from '../../utils/dialogScrollLock';
import './ModalDialog.css';

export default function ModalDialog({ title, onClose, children, variant = 'dialog', className = '' }) {
  const reducedMotion = useReducedMotion();
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const backdropRef = useRef(null);
  const bodyRef = useRef(null);
  const onCloseRef = useRef(onClose);
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
        onCloseRef.current();
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
      className={`dn-modal-backdrop dn-modal-viewport${variant === 'drawer' ? ' dn-modal-backdrop-drawer' : ''}`}
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.16 }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.section ref={dialogRef} className={`dn-modal${variant === 'drawer' ? ' dn-modal-drawer' : ''}${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} initial={reducedMotion ? false : { opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}>
        <div className="dn-modal-header" style={styles.header}>
          <h3 id={titleId} style={{ margin: 0 }}>{title}</h3>
          <button ref={closeButtonRef} type="button" className="modal-close-button" onClick={onClose} aria-label="Close dialog"><X size={20} strokeWidth={1.9} aria-hidden="true" /></button>
        </div>
        <div className="dn-modal-body" ref={bodyRef}>{children}</div>
      </motion.section>
    </motion.div>,
    document.body,
  );
}

export function ConfirmDialog({ title, message, onCancel, onConfirm, confirmLabel = 'Delete', busy = false, error = '' }) {
  return (
    <ModalDialog title={title} onClose={onCancel}>
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
