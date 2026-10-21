// This file creates reusable popup dialogs and confirmation windows.
// It keeps the app's modal behavior consistent and helps prevent focus or page-scroll issues during form flows.
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

export default function ModalDialog({ title, onClose, children, variant = 'dialog', className = '' }) {
  const closeButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('dn-modal-open');
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])]
        .filter((element) => element.getAttribute('aria-hidden') !== 'true');
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
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove('dn-modal-open');
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return createPortal(
    <motion.div
      className={`dn-modal-backdrop${variant === 'drawer' ? ' dn-modal-backdrop-drawer' : ''}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16 }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <motion.section ref={dialogRef} className={`dn-modal${variant === 'drawer' ? ' dn-modal-drawer' : ''}${className ? ` ${className}` : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
        <div style={styles.header}>
          <h3 id={titleId} style={{ margin: 0 }}>{title}</h3>
          <button ref={closeButtonRef} type="button" className="modal-close-button" onClick={onClose} aria-label="Close dialog">×</button>
        </div>
        {children}
      </motion.section>
    </motion.div>,
    document.body,
  );
}

export function ConfirmDialog({ title, message, onCancel, onConfirm, confirmLabel = 'Delete' }) {
  return (
    <ModalDialog title={title} onClose={onCancel}>
      <p style={styles.message}>{message}</p>
      <div className="modal-confirm-actions" style={styles.actions}>
        <button type="button" className="secondaryButton modal-action-button" onClick={onCancel}>Cancel</button>
        <button type="button" className="modal-danger-button modal-action-button" onClick={onConfirm}>{confirmLabel}</button>
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
