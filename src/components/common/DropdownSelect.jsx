// Shared viewport-aware select used in filters and forms.
// The portal avoids clipping by cards, scroll panes, modals, and bottom navigation.
import { Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { computeOverlayPlacement, getVisibleViewport } from '../../utils/overlayPosition';
import './DropdownSelect.css';

const getOptionLabel = (children) => Children.toArray(children)
  .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
  .join('');
const SEARCH_LIMIT = 10;

export default function DropdownSelect({
  id, name, value, onChange, children, disabled = false, required = false,
  placeholder = 'Select an option', className = '', menuMinWidth = 220, ...accessibilityProps
}) {
  const generatedId = useId();
  const triggerId = id || `dropdown-${generatedId}`;
  const listboxId = `${triggerId}-options`;
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState('');
  const [placement, setPlacement] = useState(null);
  const options = Children.toArray(children)
    .filter((child) => isValidElement(child) && child.type === 'option')
    .map((child) => ({
      value: String(child.props.value ?? getOptionLabel(child.props.children)),
      label: getOptionLabel(child.props.children),
      shortLabel: String(child.props['data-short-label'] || getOptionLabel(child.props.children)),
      disabled: Boolean(child.props.disabled),
    }));
  const selectedIndex = options.findIndex((option) => option.value === String(value ?? ''));
  const selectedOption = options[selectedIndex];
  const searchable = options.length > SEARCH_LIMIT;
  const visibleIndices = options.map((option, index) => ({ option, index }))
    .filter(({ option }) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
    .map(({ index }) => index);
  const enabledIndices = visibleIndices.filter((index) => !options[index].disabled);
  const shownActiveIndex = enabledIndices.includes(activeIndex) ? activeIndex : (enabledIndices[0] ?? -1);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setQuery('');
    setPlacement(null);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const reposition = useCallback(() => {
    const element = triggerRef.current;
    if (!element) return;
    const win = element.ownerDocument.defaultView;
    const bounds = element.getBoundingClientRect();
    const viewport = getVisibleViewport(win);
    if (bounds.bottom < viewport.top || bounds.top > viewport.top + viewport.height) {
      close();
      return;
    }
    const obstruction = [...element.ownerDocument.querySelectorAll('.mobile-tabbar, .mobile-dock, .mobile-bottom-nav')]
      .filter((node) => node.getClientRects().length && getComputedStyle(node).position === 'fixed')
      .map((node) => node.getBoundingClientRect().top)
      .filter((top) => top > bounds.bottom && top < viewport.top + viewport.height);
    const preferredHeight = Math.min(360, options.length * 44 + 14 + (searchable ? 52 : 0));
    const next = computeOverlayPlacement({
      anchor: bounds,
      viewport,
      preferredHeight,
      minimumWidth: Math.max(bounds.width, menuMinWidth),
      bottomObstruction: obstruction.length ? Math.min(...obstruction) : null,
    });
    setPlacement(next);
  }, [close, options.length, searchable, menuMinWidth]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    reposition();
    const onViewportChange = (event) => {
      // The options list scrolls independently. Repositioning it on its own
      // scroll event would repeatedly jump back to the highlighted option.
      if (event?.target && menuRef.current?.contains(event.target)) return;
      reposition();
    };
    // Capture nested page/modal scrolling, but ignore the menu's own scrollbar.
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('orientationchange', onViewportChange);
    window.visualViewport?.addEventListener('resize', onViewportChange);
    window.visualViewport?.addEventListener('scroll', onViewportChange);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onViewportChange) : null;
    if (triggerRef.current) observer?.observe(triggerRef.current);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('orientationchange', onViewportChange);
      window.visualViewport?.removeEventListener('resize', onViewportChange);
      window.visualViewport?.removeEventListener('scroll', onViewportChange);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return undefined;
    const onOutsidePointer = (event) => {
      if (!rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) close();
    };
    document.addEventListener('pointerdown', onOutsidePointer);
    return () => document.removeEventListener('pointerdown', onOutsidePointer);
  }, [open, close]);

  useEffect(() => {
    if (!open || shownActiveIndex < 0 || !listRef.current) return;
    const item = document.getElementById(`${listboxId}-option-${shownActiveIndex}`);
    const list = listRef.current;
    if (!item) return;
    const itemTop = item.offsetTop - list.offsetTop;
    if (itemTop < list.scrollTop) list.scrollTop = itemTop;
    else if (itemTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = itemTop + item.offsetHeight - list.clientHeight;
    }
  }, [shownActiveIndex, listboxId, open, query, placement]);

  const commitOption = (index) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== String(value ?? '')) onChange?.({ target: { name, value: option.value } });
    close(true);
  };

  const moveActive = (step) => {
    if (!enabledIndices.length) return;
    const at = enabledIndices.indexOf(shownActiveIndex);
    const next = at < 0 ? (step > 0 ? 0 : enabledIndices.length - 1)
      : (at + step + enabledIndices.length) % enabledIndices.length;
    setActiveIndex(enabledIndices[next]);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === 'Tab') { close(); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { setOpen(true); setQuery(''); setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0); }
      else moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      if (!open) return;
      event.preventDefault();
      if (enabledIndices.length) setActiveIndex(event.key === 'Home' ? enabledIndices[0] : enabledIndices[enabledIndices.length - 1]);
      return;
    }
    if (event.key === 'Enter' || (event.key === ' ' && event.target !== searchRef.current)) {
      event.preventDefault();
      if (open) commitOption(shownActiveIndex);
      else { setOpen(true); setQuery(''); setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0); }
    }
  };

  return (
    <span ref={rootRef} className={`dropdown-field${className ? ` ${className}` : ''}`}>
      <button id={triggerId} ref={triggerRef} type="button" role="combobox"
        className="dropdown-trigger" aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && shownActiveIndex >= 0 && placement ? `${listboxId}-option-${shownActiveIndex}` : undefined}
        aria-required={required || undefined} disabled={disabled}
        onClick={() => {
          if (open) close(true);
          else { setQuery(''); setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0); setOpen(true); }
        }}
        onKeyDown={onKeyDown} {...accessibilityProps}>
        <span className={selectedOption ? '' : 'dropdown-placeholder'}>
          <span className="dropdown-label-full">{selectedOption?.label || placeholder}</span>
          <span className="dropdown-label-short">{selectedOption?.shortLabel || placeholder}</span>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && placement ? createPortal(
        <div ref={menuRef} className="dropdown-menu dropdown-menu-portal"
          style={{ position: 'fixed', top: placement.top, left: placement.left,
            width: placement.width, maxHeight: placement.maxHeight, right: 'auto', bottom: 'auto' }}
          onKeyDown={onKeyDown}>
          {searchable ? (
            <label className="dropdown-search-wrap">
              <Search size={16} aria-hidden="true" />
              <input ref={searchRef} type="search" aria-label="Search options"
                value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1); }}
                placeholder="Search options" />
            </label>
          ) : null}
          <div ref={listRef} id={listboxId} className="dropdown-options-scroll" role="listbox"
            aria-labelledby={triggerId} aria-label={accessibilityProps['aria-label'] || name || 'Options'}
            onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
            {visibleIndices.map((index) => {
              const option = options[index];
              return <div id={`${listboxId}-option-${index}`} key={`${option.value}-${index}`}
                role="option" aria-selected={index === selectedIndex}
                aria-disabled={option.disabled || undefined}
                className={`dropdown-option${index === selectedIndex ? ' is-selected' : ''}${index === shownActiveIndex ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commitOption(index)}>
                <span>{option.label}</span>
                {index === selectedIndex ? <Check size={15} aria-hidden="true" /> : null}
              </div>;
            })}
            {!visibleIndices.length ? <div className="dropdown-no-results">No matching options</div> : null}
          </div>
        </div>, document.body,
      ) : null}
    </span>
  );
}
