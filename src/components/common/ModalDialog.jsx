import { useEffect, useRef } from 'react';

export default function ModalDialog({ title, onClose, children }) {
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="lifehub-modal-backdrop" style={styles.backdrop} onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="lifehub-dialog-title" style={styles.dialog} onMouseDown={(event) => event.stopPropagation()}>
        <div style={styles.header}>
          <h3 id="lifehub-dialog-title" style={{ margin: 0 }}>{title}</h3>
          <button ref={closeButtonRef} type="button" onClick={onClose} style={styles.closeButton} aria-label="Close dialog">×</button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function ConfirmDialog({ title, message, onCancel, onConfirm, confirmLabel = 'Delete' }) {
  return (
    <ModalDialog title={title} onClose={onCancel}>
      <p style={styles.message}>{message}</p>
      <div style={styles.actions}>
        <button type="button" onClick={onCancel} style={styles.cancelButton}>Cancel</button>
        <button type="button" onClick={onConfirm} style={styles.confirmButton}>{confirmLabel}</button>
      </div>
    </ModalDialog>
  );
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 40,
    display: 'grid',
    placeItems: 'center',
    padding: '20px',
    background: 'rgba(20, 39, 32, 0.32)',
  },
  dialog: {
    width: 'min(520px, 100%)',
    maxHeight: 'calc(100vh - 40px)',
    overflowY: 'auto',
    padding: '20px',
    borderRadius: '16px',
    background: 'var(--surface)',
    color: 'var(--ink)',
    boxShadow: '0 20px 60px rgba(21, 57, 45, 0.2)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '18px',
  },
  closeButton: {
    width: '32px',
    height: '32px',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    background: 'var(--surface-soft)',
    color: 'var(--ink)',
    cursor: 'pointer',
    fontSize: '1.2rem',
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
  cancelButton: {
    border: '1px solid var(--border)',
    borderRadius: '9px',
    background: 'var(--surface)',
    color: 'var(--ink)',
    padding: '10px 14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmButton: {
    border: '1px solid #b84b4b',
    borderRadius: '9px',
    background: '#b84b4b',
    color: '#ffffff',
    padding: '10px 14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
