// Shared viewport-aware select used in filters and forms.
// The portal avoids clipping by cards, scroll panes, modals, and bottom navigation.
import { Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';
import { computeOverlayPlacement, getVisibleViewport } from '../../utils/overlayPosition';
import './DropdownSelect.css';

const getOptionLabel = (children) => Children.toArray(children)
  .map((child) => (typeof child === 'string' || typeof child === 'number' ? String(child) : ''))
  .join('');
const SEARCH_LIMIT = 10;
const ROW_HEIGHT = 44;

export default function DropdownSelect({
  id, name, value, onChange, children, disabled = false, required = false,
  placeholder = 'Select an option', className = '', menuMinWidth = 220,
  searchable: searchableProp, searchOnDemand = false, allowCustom = false, searchLabel = 'Search options', ...accessibilityProps
}) {
  const generatedId = useId();
  const triggerId = id || `dropdown-${generatedId}`;
  const listboxId = `${triggerId}-options`;
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const typeahead = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [placement, setPlacement] = useState(null);
  const [scrollTop, setScrollTop] = useState(0);
  const sourceOptions = useMemo(() => Children.toArray(children)
    .filter((child) => isValidElement(child) && child.type === 'option')
    .map((child) => ({
      value: String(child.props.value ?? getOptionLabel(child.props.children)),
      label: getOptionLabel(child.props.children),
      shortLabel: String(child.props['data-short-label'] || getOptionLabel(child.props.children)),
      disabled: Boolean(child.props.disabled),
    })), [children]);
  const options = useMemo(() => allowCustom && query.trim()
    && !sourceOptions.some((option) => option.value.toLowerCase() === query.trim().toLowerCase())
    ? [...sourceOptions, { value: query.trim(), label: query.trim(), shortLabel: query.trim(), disabled: false, custom: true }]
    : sourceOptions, [sourceOptions, allowCustom, query]);
  const selectedIndex = options.findIndex((option) => option.value === String(value ?? ''));
  const selectedOption = options[selectedIndex] || (allowCustom && value ? { label: String(value), shortLabel: String(value) } : null);
  const searchable = searchableProp ?? (allowCustom || options.length > SEARCH_LIMIT);
  // On forms, show the choices first. Only an explicit Search tap or keyboard
  // request creates/focuses a search input, avoiding an unsolicited iOS keyboard.
  const searchVisible = searchable && (!searchOnDemand || searchOpen);
  useEffect(() => {
    if (open && searchOnDemand && searchOpen) searchRef.current?.focus({ preventScroll: true });
  }, [open, searchOnDemand, searchOpen]);
  const visibleIndices = useMemo(() => options.map((option, index) => ({ option, index }))
    .filter(({ option }) => option.label.toLowerCase().includes(query.trim().toLowerCase()))
    .map(({ index }) => index), [options, query]);
  const enabledIndices = visibleIndices.filter((index) => !options[index].disabled);
  const shownActiveIndex = enabledIndices.includes(activeIndex) ? activeIndex : (enabledIndices[0] ?? -1);
  const virtual = visibleIndices.length > 60;
  const visibleHeight = Math.max(44, (placement?.maxHeight || 360) - (searchVisible ? 66 : searchOnDemand && searchable ? 54 : 14));
  const virtualStart = virtual ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 4) : 0;
  const virtualEnd = virtual ? Math.min(visibleIndices.length, virtualStart + Math.ceil(visibleHeight / ROW_HEIGHT) + 9) : visibleIndices.length;
  const renderedIndices = visibleIndices.slice(virtualStart, virtualEnd);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setQuery('');
    setSearchOpen(false);
    setScrollTop(0);
    setPlacement(null);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const reposition = useCallback(() => {
    const element = triggerRef.current;
    if (!element) return;
    const win = element.ownerDocument.defaultView;
    const bounds = element.getBoundingClientRect();
    const viewport = getVisibleViewport(win);
    const keyboardSearch = searchRef.current && element.ownerDocument.activeElement === searchRef.current;
    if ((bounds.bottom < viewport.top || bounds.top > viewport.top + viewport.height) && !keyboardSearch) {
      close();
      return;
    }
    // A focused search can shift the iOS visualViewport away from the anchor.
    // Keep the choices reachable instead of unmounting the focused input.
    const anchor = keyboardSearch && (bounds.bottom < viewport.top || bounds.top > viewport.top + viewport.height)
      ? { ...bounds, top: viewport.top + 14, bottom: viewport.top + 58 }
      : bounds;
    const obstruction = [...element.ownerDocument.querySelectorAll('.mobile-tabbar, .mobile-dock, .mobile-bottom-nav')]
      .filter((node) => node.getClientRects().length && getComputedStyle(node).position === 'fixed')
      .map((node) => node.getBoundingClientRect().top)
      .filter((top) => top > bounds.bottom && top < viewport.top + viewport.height);
    const preferredHeight = Math.min(360, options.length * 44 + 14 + (searchVisible ? 52 : searchOnDemand && searchable ? 44 : 0));
    const next = computeOverlayPlacement({
      anchor,
      viewport,
      preferredHeight,
      minimumWidth: Math.max(bounds.width, menuMinWidth),
      bottomObstruction: obstruction.length ? Math.min(...obstruction) : null,
    });
    if (keyboardSearch && next.maxHeight < 90) {
      next.top = viewport.top + 8;
      next.maxHeight = Math.max(90, viewport.height - 16);
    }
    setPlacement(next);
  }, [close, options.length, searchVisible, searchOnDemand, searchable, menuMinWidth]);

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
    if (virtual) {
      const position = visibleIndices.indexOf(shownActiveIndex), top = position * ROW_HEIGHT;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (top + ROW_HEIGHT > list.scrollTop + list.clientHeight) list.scrollTop = top + ROW_HEIGHT - list.clientHeight;
      setScrollTop(list.scrollTop);
      return;
    }
    if (!item) return;
    const itemTop = item.offsetTop - list.offsetTop;
    if (itemTop < list.scrollTop) list.scrollTop = itemTop;
    else if (itemTop + item.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = itemTop + item.offsetHeight - list.clientHeight;
    }
  }, [shownActiveIndex, listboxId, open, query, placement, virtual]);

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
    if (event.key === 'Tab') {
      if (open && searchable && event.target === triggerRef.current && !event.shiftKey) {
        // Tab is an explicit request to enter search; pointer opening never is.
        event.preventDefault();
        if (searchOnDemand && !searchOpen) setSearchOpen(true);
        else searchRef.current?.focus({ preventScroll: true });
        return;
      }
      if (event.target === searchRef.current) {
        triggerRef.current?.focus({ preventScroll: true });
        if (event.shiftKey) { event.preventDefault(); return; }
      }
      close(); return;
    }
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
    if (event.key === 'Enter' || (event.key === ' ' && event.target !== searchRef.current && !(searchable && open && query))) {
      event.preventDefault();
      if (open) commitOption(shownActiveIndex);
      else { setOpen(true); setQuery(''); setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0); }
      return;
    }
    if (event.target === triggerRef.current && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (searchable) {
        if (searchOnDemand) setSearchOpen(true);
        setQuery((current) => open ? current + event.key : event.key);
        setScrollTop(0); setActiveIndex(-1);
      } else {
        const now = Date.now();
        const prefix = now - typeahead.current.time < 700 ? typeahead.current.text + event.key : event.key;
        const find = (text) => options.findIndex((option) => !option.disabled && option.label.toLocaleLowerCase().startsWith(text.toLocaleLowerCase()));
        const match = find(prefix);
        typeahead.current = { text: match >= 0 ? prefix : event.key, time: now };
        const next = match >= 0 ? match : find(event.key);
        if (next >= 0) setActiveIndex(next);
      }
      setOpen(true);
    } else if (searchable && open && event.target === triggerRef.current && event.key === 'Backspace' && query) {
      event.preventDefault();
      setQuery((current) => current.slice(0, -1));
      setScrollTop(0); setActiveIndex(-1);
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
          // Opening choices must not summon the mobile keyboard. Searching is
          // available only when the user explicitly focuses the search input.
          triggerRef.current?.focus({ preventScroll: true });
          if (open) close(true);
          else { setQuery(''); setSearchOpen(false); setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0); setOpen(true); }
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
          {searchOnDemand && searchable && !searchVisible ? (
            <button className="dropdown-search-reveal" type="button" aria-label={searchLabel}
              onClick={(event) => { event.stopPropagation(); setSearchOpen(true); }}>
              <Search size={16} aria-hidden="true" /> Search
            </button>
          ) : null}
          {searchVisible ? (
            <label className="dropdown-search-wrap">
              <Search size={16} aria-hidden="true" />
              <input ref={searchRef} type="search" aria-label={searchLabel}
                aria-controls={listboxId} aria-activedescendant={shownActiveIndex >= 0 ? `${listboxId}-option-${shownActiveIndex}` : undefined}
                value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(-1); setScrollTop(0); if (listRef.current) listRef.current.scrollTop = 0; }}
                placeholder={allowCustom ? 'Search or type a value' : searchLabel} />
            </label>
          ) : null}
          <div ref={listRef} id={listboxId} className={`dropdown-options-scroll${virtual ? ' is-virtual' : ''}`} role="listbox"
            aria-labelledby={triggerId} aria-label={accessibilityProps['aria-label'] || name || 'Options'}
            onScroll={(event) => { if (virtual) setScrollTop(event.currentTarget.scrollTop); }}
            onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
            {virtual && virtualStart > 0 ? <div role="presentation" style={{ height: virtualStart * ROW_HEIGHT }} /> : null}
            {renderedIndices.map((index) => {
              const option = options[index];
              return <div id={`${listboxId}-option-${index}`} key={`${option.value}-${index}`}
                role="option" aria-selected={index === selectedIndex}
                aria-setsize={visibleIndices.length} aria-posinset={visibleIndices.indexOf(index) + 1}
                aria-disabled={option.disabled || undefined}
                className={`dropdown-option${index === selectedIndex ? ' is-selected' : ''}${index === shownActiveIndex ? ' is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commitOption(index)}>
                <span title={option.label}>{option.custom ? `Use “${option.label}”` : option.label}</span>
                {index === selectedIndex ? <Check size={15} aria-hidden="true" /> : null}
              </div>;
            })}
            {virtual && virtualEnd < visibleIndices.length ? <div role="presentation" style={{ height: (visibleIndices.length - virtualEnd) * ROW_HEIGHT }} /> : null}
            {!visibleIndices.length ? <div className="dropdown-no-results">No matching options</div> : null}
          </div>
        </div>, document.body,
      ) : null}
    </span>
  );
}
