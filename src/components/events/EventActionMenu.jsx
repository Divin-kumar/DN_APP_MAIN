import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, ArchiveRestore, ClipboardList, Copy, Ellipsis, Pencil, Share2, Trash2 } from 'lucide-react';
import { computeOverlayPlacement, getVisibleViewport } from '../../utils/overlayPosition';

// One accessible viewport-aware action surface, reused by list cards and event hero.
export default function EventActionMenu({ event, onEdit, onDuplicate, onShare, onArchive, onDelete, onSummary, className = '' }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const anchor = useRef(null);
  const menu = useRef(null);
  const isArchived = Boolean(event.archived);
  const actions = [
    { label: 'Edit', icon: Pencil, run: onEdit },
    { label: 'Duplicate', icon: Copy, run: onDuplicate },
    { label: 'Share', icon: Share2, run: onShare },
    ...(onSummary ? [{ label: 'View Summary', icon: ClipboardList, run: onSummary }] : []),
    { label: isArchived ? 'Restore' : 'Archive', icon: isArchived ? ArchiveRestore : Archive, run: onArchive },
    { label: 'Delete', icon: Trash2, run: onDelete, danger: true },
  ];

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setPosition(null);
    if (restoreFocus) anchor.current?.focus({ preventScroll: true });
  }, []);
  const reposition = useCallback(() => {
    const el = anchor.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewport = getVisibleViewport(window);
    setPosition(computeOverlayPlacement({
      anchor: rect, viewport, preferredHeight: onSummary ? 300 : 250, minimumWidth: 190, gap: 6,
    }));
  }, [onSummary]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    reposition();
    const move = (event) => {
      if (event?.target && menu.current?.contains(event.target)) return;
      reposition();
    };
    window.addEventListener('resize', move);
    window.addEventListener('scroll', move, true);
    window.visualViewport?.addEventListener('resize', move);
    window.visualViewport?.addEventListener('scroll', move);
    return () => {
      window.removeEventListener('resize', move);
      window.removeEventListener('scroll', move, true);
      window.visualViewport?.removeEventListener('resize', move);
      window.visualViewport?.removeEventListener('scroll', move);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (open && position) menu.current?.querySelector('button')?.focus({ preventScroll: true });
  }, [open, Boolean(position)]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => {
      if (!menu.current?.contains(event.target) && !anchor.current?.contains(event.target)) close();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, close]);

  const onMenuKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') {
      close();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const options = [...menu.current.querySelectorAll('button:not(:disabled)')];
      const index = options.indexOf(document.activeElement);
      const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[next]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const options = menu.current.querySelectorAll('button:not(:disabled)');
      options[event.key === 'Home' ? 0 : options.length - 1]?.focus();
    }
  };
  const run = (action) => {
    close(true);
    action.run?.();
  };

  return (
    <span className={'dn-event-action-anchor' + (className ? ' ' + className : '')}>
      <button ref={anchor} type="button" className="dn-event-overflow-trigger"
        aria-label={'Actions for ' + (event.name || 'event')} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((value) => !value)}>
        <Ellipsis size={21} aria-hidden="true" />
      </button>
      {open && position ? createPortal(
        <div ref={menu} className="dn-event-overflow-menu" role="menu"
          aria-label={'Actions for ' + (event.name || 'event')}
          onKeyDown={onMenuKey}
          style={{ position: 'fixed', left: position.left, top: position.top,
            width: position.width, maxHeight: position.maxHeight }}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button key={action.label} type="button" role="menuitem"
                className={action.danger ? 'is-danger' : ''}
                onClick={() => run(action)}>
                <Icon size={17} aria-hidden="true" /><span>{action.label}</span>
              </button>
            );
          })}
        </div>, document.body,
      ) : null}
    </span>
  );
}
