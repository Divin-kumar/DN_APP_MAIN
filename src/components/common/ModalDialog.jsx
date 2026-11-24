// This file creates reusable popup dialogs and confirmation windows.
// It keeps the app's modal behavior consistent and helps prevent focus or page-scroll issues during form flows.
import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useDragControls, usePresence, usePresenceData, useReducedMotion } from 'framer-motion';
import { ChevronLeft, X } from 'lucide-react';
import { focusedDialogScrollDelta, observeDialogViewport } from '../../utils/dialogViewport';
import { lockDialogScroll } from '../../utils/dialogScrollLock';
import './ModalDialog.css';

const enterEase = [0.22, 1, 0.36, 1];
const exitEase = [0.4, 0, 0.7, 1];

const activeDialogSelector = '[role="dialog"][aria-modal="true"]:not([inert])';

const FormFooterContext = createContext(null);
const DialogCloseContext = createContext(null);
const mobileMedia = '(max-width: 760px), (orientation: landscape) and (max-height: 500px) and (pointer: coarse)';

export function useDialogFormFooter() {
  return useContext(FormFooterContext);
}

export function useDialogClose(onCancel, { protectDraft = false } = {}) {
  const requestDialogClose = useContext(DialogCloseContext);
  return requestDialogClose ? () => requestDialogClose(onCancel, protectDraft) : onCancel;
}

export function DialogFormActions({ children }) {
  const footer = useDialogFormFooter();
  return footer ? createPortal(children, footer) : children;
}

export default function ModalDialog({ title, onClose, onDismissed, children, footer, variant = 'dialog', className = '', swipeDismiss = true,
  closeDisabled = false, viewKey, onViewChange, onBack, backLabel = 'Back', formFooter = false }) {
  // Create the portal target before first paint so mobile Save/Cancel controls
  // never jump from the scrolling body to the pinned footer after mount.
  const [formActions] = useState(() => {
    if (typeof document === 'undefined') return null;
    const node = document.createElement('div');
    node.className = 'dn-modal-form-footer-content';
    return node;
  });
  const dismissedCallback = useRef(onDismissed);
  useLayoutEffect(() => { dismissedCallback.current = onDismissed; }, [onDismissed]);
  useEffect(() => () => dismissedCallback.current?.(), []);

  const formActionsHost = useRef(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [isMobileSheet, setMobileSheet] = useState(() => window.matchMedia(mobileMedia).matches);
  const pinFormActions = formFooter && (isMobileSheet || keyboardOpen);
  useLayoutEffect(() => {
    // Attach the stable portal before the sheet paints or measures its height.
    if (pinFormActions && formActions && formActionsHost.current) {
      formActionsHost.current.appendChild(formActions);
    }
  }, [pinFormActions, formActions]);
  const reducedMotion = useReducedMotion();
  const [isPresent, safeToRemove] = usePresence();
  const handingOff = usePresenceData() === true && !isPresent;
  const [swipeClosing, setSwipeClosing] = useState(false);
  // A ref tracks form edits without re-rendering the dialog or its children.
  const dirtyRef = useRef(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const keepEditingRef = useRef(null);
  const closeAfterDiscard = useRef(null);
  useEffect(() => { if (confirmDiscard) keepEditingRef.current?.focus({ preventScroll: true }); }, [confirmDiscard]);
  const dismissRequested = useRef(false);
  const pulledToClose = useRef(false);
  const dragControls = useDragControls();
  const bodySwipe = useRef(null);
  const isSlidingSheet = isMobileSheet;
  const allowsSwipe = isSlidingSheet && swipeDismiss && !closeDisabled;
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
    if (event.target.closest?.('button,a,input,textarea,select,label,[contenteditable="true"],[role="button"],[role="textbox"],[role="slider"],[role="listbox"],summary,[data-swipe-ignore]')) return;
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
    if (dy >= 118 && dy > Math.abs(dx) * 1.6) {
      if (dirtyRef.current) { requestClose(); return; }
      pulledToClose.current = true;
      setSwipeClosing(true);
    }
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
      if (dirtyRef.current) { requestClose(); return; }
      pulledToClose.current = true;
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
        pulledToClose.current = false;
      }
    }, 750);
    return () => window.clearTimeout(id);
  }, [swipeClosing, isPresent]);
  const closeButtonRef = useRef(null);
  const titleRef = useRef(null);
  const dialogRef = useRef(null);
  const backdropRef = useRef(null);
  const bodyRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  // Close actions use the same reverse sheet animation as a downward swipe.
  // Re-evaluate the media query for the Escape listener installed on mount.
  const requestClose = (onCancel, protectDraft = false) => {
    if (closeDisabledRef.current) return;
    const customClose = typeof onCancel === 'function' ? onCancel : null;
    // Explicit Cancel and Back actions preserve the existing discard/return behavior.
    if (customClose && !protectDraft) { customClose(); return; }
    if (dirtyRef.current) {
      closeAfterDiscard.current = customClose || onCloseRef.current;
      setConfirmDiscard(true);
      return;
    }
    if (customClose) { customClose(); return; }
    if (swipeDismiss && window.matchMedia(mobileMedia).matches) setSwipeClosing(true);
    else onCloseRef.current();
  };
  const keepEditing = () => {
    setConfirmDiscard(false);
    closeAfterDiscard.current = null;
    window.requestAnimationFrame(() => closeButtonRef.current?.focus({ preventScroll: true }));
  };
  const discardChanges = () => {
    const dismiss = closeAfterDiscard.current || onCloseRef.current;
    closeAfterDiscard.current = null;
    dirtyRef.current = false;
    dismiss();
  };
  // Capture before portal children mount: React autoFocus can run before this
  // component's effect and would otherwise remember a disappearing input.
  const previousFocusRef = useRef(typeof document === 'undefined' ? null : document.activeElement);
  const titleId = useId();

  useLayoutEffect(() => {
    if (handingOff) return undefined;
    const backdrop = backdropRef.current;
    const body = bodyRef.current;
    const revealFocusedField = () => {
      const active = document.activeElement;
      if (backdrop.dataset.keyboardOpen !== 'true' || !body.contains(active) ||
          !active.matches('input, textarea, [contenteditable="true"]')) return;
      const field = active.getBoundingClientRect();
      const visible = body.getBoundingClientRect();
      const footer = body.querySelector('.event-form-actions, .event-greeting-editor-actions, .form-actions, .dialog-actions, .settings-actions, .modal-confirm-actions');
      const footerTop = footer && getComputedStyle(footer).position === 'sticky' ? footer.getBoundingClientRect().top : visible.bottom;
      // A partly visible long editor keeps its caret position. Reveal the start
      // only when it is completely below the usable region.
      const delta = focusedDialogScrollDelta(field, visible, footerTop);
      if (delta) body.scrollTo({ top: body.scrollTop + delta, behavior: 'instant' });
    };
    const stopObserving = observeDialogViewport(window, (viewport, layout) => {
      backdrop.style.setProperty('--dn-dialog-viewport-height', `${viewport.height}px`);
      backdrop.style.setProperty('--dn-dialog-viewport-width', `${viewport.width}px`);
      backdrop.style.setProperty('--dn-dialog-viewport-top', `${viewport.top}px`);
      backdrop.style.setProperty('--dn-dialog-viewport-left', `${viewport.left}px`);
      backdrop.style.setProperty('--dn-dialog-layout-height', `${layout.height}px`);
      backdrop.style.setProperty('--dn-dialog-layout-width', `${layout.width}px`);
      backdrop.style.setProperty('--dn-dialog-inset-bottom', `${Math.max(0, layout.height - viewport.top - viewport.height)}px`);
      backdrop.style.setProperty('--dn-dialog-inset-right', `${Math.max(0, layout.width - viewport.left - viewport.width)}px`);
      backdrop.dataset.keyboardOpen = String(viewport.keyboardOpen);
      if (formFooter) setKeyboardOpen(viewport.keyboardOpen);
      revealFocusedField();
    });
    body.addEventListener('dn:disclosure-settled', revealFocusedField);
    return () => {
      stopObserving();
      body.removeEventListener('dn:disclosure-settled', revealFocusedField);
    };
  }, [formFooter, handingOff]);

  useEffect(() => {
    onCloseRef.current = onClose;
    closeDisabledRef.current = closeDisabled;
  }, [onClose, closeDisabled]);
  useEffect(() => {
    const dialog = dialogRef.current;
    const markCustomField = () => { if (formFooter) dirtyRef.current = true; };
    dialog?.addEventListener('dn:form-field-change', markCustomField);
    return () => dialog?.removeEventListener('dn:form-field-change', markCustomField);
  }, [formFooter]);

  const previousView = useRef(viewKey);
  useLayoutEffect(() => {
    if (!viewKey) return;
    const changed = previousView.current !== viewKey;
    previousView.current = viewKey;
    if (changed) dirtyRef.current = false;
    bodyRef.current.scrollTop = 0;
    titleRef.current?.focus({ preventScroll: true });
    onViewChange?.(bodyRef.current);
    if (!changed || reducedMotion) return;
    const entrance = bodyRef.current.animate?.([{ opacity: .45 }, { opacity: 1 }], {
      duration: 120, easing: 'ease-out',
    });
    return () => entrance?.cancel();
  }, [viewKey, reducedMotion]);

  useEffect(() => {
    const previousFocus = previousFocusRef.current;
    const unlockScroll = lockDialogScroll(window);
    if (!viewKey) closeButtonRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event) => {
      // A nested original preview owns focus/Escape until it closes.
      const activeDialogs = document.querySelectorAll(activeDialogSelector);
      if (activeDialogs[activeDialogs.length - 1] !== dialogRef.current) return;
      if (dialogRef.current.dataset.closing) {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Tab' || event.key === 'Escape') event.preventDefault();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }

      // Portalled dropdowns manage their own search and option keyboard flow.
      if (event.defaultPrevented || event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])') || [])]
        .filter((element) => element.getAttribute('aria-hidden') !== 'true' && !element.closest('[inert]') && element.getClientRects().length > 0);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!focusable.includes(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
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
      const activeDialogs = document.querySelectorAll(activeDialogSelector);
      const remainingDialog = activeDialogs[activeDialogs.length - 1];
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected &&
          (!remainingDialog || remainingDialog.contains(previousFocus))) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  const resting = { y: 0, scale: 1, opacity: 1 };
  const entrance = { y: isSlidingSheet ? 26 : 10, scale: isSlidingSheet ? 1 : .99, opacity: isSlidingSheet ? 1 : .4 };
  const exitDuration = reducedMotion ? 0 : handingOff ? .07 : .14;
  useEffect(() => {
    if (isPresent) return undefined;
    // Release the scroll lock even if an interrupted variant skips its completion callback.
    if (exitDuration === 0) {
      safeToRemove?.();
      return undefined;
    }
    const cleanup = window.setTimeout(() => safeToRemove?.(), exitDuration * 1000 + 160);
    return () => window.clearTimeout(cleanup);
  }, [exitDuration, isPresent, safeToRemove]);
  const moving = !isPresent || swipeClosing ? 'close' : 'open';
  const sheetVariants = {
    enter: entrance,
    open: { ...resting, transition: { duration: reducedMotion ? 0 : .17, ease: enterEase } },
    close: {
      y: handingOff ? 0 : isSlidingSheet ? (pulledToClose.current ? '100%' : 34) : 9,
      scale: isSlidingSheet ? 1 : .99,
      opacity: 0,
      transition: { duration: exitDuration, ease: exitEase },
    },
  };
  const scrimVariants = {
    enter: { opacity: 0 },
    open: { opacity: 1, transition: { duration: reducedMotion ? 0 : .14, ease: enterEase } },
    close: { opacity: 0, transition: { duration: exitDuration, ease: exitEase } },
  };

  return createPortal(
    <motion.div
      ref={backdropRef}
      className={`dn-modal-backdrop dn-modal-viewport${variant === 'drawer' ? ' dn-modal-backdrop-drawer' : ''}${isSlidingSheet ? ' dn-modal-slide-scrim' : ''}`}
      data-handoff={handingOff ? 'true' : undefined}
      initial={reducedMotion ? false : 'enter'}
      animate={moving}
      variants={scrimVariants}
      onAnimationComplete={(phase) => {
        if (phase === 'close' && !isPresent) safeToRemove?.();
      }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}
    >
      <motion.section ref={dialogRef} className={`dn-modal${variant === 'drawer' ? ' dn-modal-drawer' : ''}${className ? ` ${className}` : ''}${allowsSwipe ? ' dn-modal-swipeable' : ''}`}
        role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        inert={handingOff ? '' : undefined}
        data-closing={!isPresent || swipeClosing ? 'true' : undefined}
        drag={allowsSwipe ? 'y' : false} dragListener={false} dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: .72 }} dragMomentum={false}
        onPointerDown={startSheetDrag} onDragEnd={endSheetDrag}
        variants={sheetVariants}
        onAnimationComplete={(phase) => {
          if (phase !== 'close' || !swipeClosing || dismissRequested.current || !isPresent) return;
          dismissRequested.current = true;
          onCloseRef.current();
        }}>
        <div className="dn-modal-header" style={styles.header}>
          {onBack ? <button type="button" className="modal-back-button" disabled={closeDisabled} onClick={onBack} aria-label={backLabel}>
            <ChevronLeft size={22} aria-hidden="true" />
          </button> : null}
          <h3 id={titleId} ref={titleRef} tabIndex={viewKey ? -1 : undefined} style={{ margin: 0 }}>{title}</h3>
          <button ref={closeButtonRef} type="button" className="modal-close-button" disabled={closeDisabled} onClick={requestClose} aria-label="Close dialog"><X size={20} strokeWidth={1.9} aria-hidden="true" /></button>
        </div>
        <div key="dn-modal-body" className="dn-modal-body" ref={bodyRef}
          inert={confirmDiscard ? '' : undefined} onInputCapture={() => { if (formFooter) dirtyRef.current = true; }}
          onChangeCapture={() => { if (formFooter) dirtyRef.current = true; }}
          onTouchStartCapture={startBodySwipe} onTouchEndCapture={endBodySwipe}
          onTouchCancelCapture={() => { bodySwipe.current = null; }}>
          <DialogCloseContext.Provider value={requestClose}>
            <FormFooterContext.Provider value={pinFormActions ? formActions : null}>{children}</FormFooterContext.Provider>
          </DialogCloseContext.Provider>
        </div>
        {pinFormActions ? <div key="dn-form-footer" ref={formActionsHost} className="dn-modal-fixed-actions dn-modal-form-footer"
          inert={confirmDiscard ? '' : undefined} /> : null}
        {footer}
        {confirmDiscard ? <section className="dn-unsaved-confirm" role="alert" aria-live="assertive">
          <h4>Discard unsaved changes?</h4>
          <p>Your edits have not been saved.</p>
          <div className="dn-unsaved-actions">
            <button ref={keepEditingRef} type="button" className="secondaryButton" onClick={keepEditing}>Keep editing</button>
            <button type="button" className="modal-danger-button" onClick={discardChanges}>Discard changes</button>
          </div>
        </section> : null}
      </motion.section>
    </motion.div>,
    document.body,
  );
}

export function ConfirmButtons({ onCancel, onConfirm, confirmLabel = 'Delete', busy = false,
  destructive = true, confirmDisabled = false }) {
  return <div className="modal-confirm-actions" style={styles.actions}>
    <button type="button" className="secondaryButton modal-action-button" disabled={busy} onClick={onCancel}>Cancel</button>
    <button type="button" className={`${destructive ? 'modal-danger-button' : 'primaryButton'} modal-action-button`} disabled={busy || confirmDisabled} onClick={onConfirm}>{busy ? 'Saving…' : confirmLabel}</button>
  </div>;
}

export function ConfirmDialog({ title, message, children, error, ...actions }) {
  return (
    <ModalDialog title={title} onClose={actions.onCancel} swipeDismiss={false} closeDisabled={actions.busy}
      footer={<div className="dn-modal-fixed-actions"><ConfirmButtons {...actions} /></div>}>
      {message ? <p style={styles.message}>{message}</p> : null}
      {children}
      {error ? <p className="quick-create-error" role="alert">{error}</p> : null}
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
