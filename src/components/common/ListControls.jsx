import { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import './ListControls.css';

// Filtering stays in the caller; controls expand within the page, without a modal.
export default function ListControls({
  title = 'Filters', activeCount = 0, resultCount, resultLabel = 'results',
  summary = '', onReset, canReset, hasSort = false, hasPanel = true, builder = false, chips, search, sort, children,
}) {
  const [open, setOpen] = useState(false);
  const [edges, setEdges] = useState({ previous: false, next: false });
  const panelId = useId();
  const panelRef = useRef(null);
  const railRef = useRef(null);
  const triggerRef = useRef(null);
  const label = hasSort || sort ? 'Filters and sort' : 'Filters';
  const updateEdges = () => {
    const rail = railRef.current;
    if (!rail) return;
    const previous = rail.scrollLeft > 2;
    const next = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2;
    setEdges((current) => current.previous === previous && current.next === next ? current : { previous, next });
  };
  useEffect(() => {
    if (!open) return undefined;
    if (!builder) updateEdges();
    const rail = railRef.current;
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(updateEdges) : null;
    if (rail) { observer?.observe(rail); [...rail.children].forEach((child) => observer?.observe(child)); }
    window.addEventListener('resize', updateEdges);
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.target.closest?.('.dn-modal, [role="dialog"]')) return;
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    const closeOnOutsideClick = (event) => {
      const panel = panelRef.current;
      if (panel?.contains(event.target) || triggerRef.current?.contains(event.target)) return;
      // DropdownSelect renders its options/search in a document-body portal.
      // Follow the listbox's ARIA owner instead of treating every portal as ours.
      const portal = event.target?.closest?.('.dropdown-menu-portal');
      const owners = portal?.querySelector('[role="listbox"]')?.getAttribute('aria-labelledby')?.split(/\s+/) || [];
      if (owners.some((id) => panel?.contains(document.getElementById(id)))) return;
      // Wait until click: collapsing on pointerdown can move the intended target
      // before pointerup. The click path is already resolved, so its action stays
      // intact without consuming the event or moving focus.
      setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('click', closeOnOutsideClick, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateEdges);
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('click', closeOnOutsideClick, true);
    };
  }, [open, builder]);
  const moveRail = (direction) => {
    const rail = railRef.current;
    rail?.scrollBy({ left: direction * Math.max(160, rail.clientWidth * .75),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  return (
    <div className="dn-list-controls">
      <div className="dn-list-controls-row">
        {search ? <div className="dn-list-controls-search">{search}</div> : null}
        {hasPanel ? <button type="button" className={`dn-list-controls-trigger${activeCount ? ' is-active' : ''}`}
          aria-label={`${label}${activeCount ? `, ${activeCount} active` : ''}`}
          ref={triggerRef} aria-controls={panelId} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          <SlidersHorizontal size={16} aria-hidden="true" /><span>Filters</span>
          {activeCount ? <span className="dn-list-controls-badge" aria-hidden="true">{activeCount}</span> : null}
        </button> : activeCount && onReset ? <button type="button" className="dn-list-controls-trigger"
          aria-label="Clear search" onClick={onReset}><X size={15} aria-hidden="true" /><span>Clear</span></button> : null}
      </div>
      {hasPanel && open ? <section id={panelId} ref={panelRef} className="dn-list-controls-panel" aria-label={title}>
        {builder ? <div className="dn-list-controls-builder">{children}</div> : <div className="dn-list-controls-filters-row">
          <div ref={railRef} className="dn-list-controls-body" onScroll={updateEdges}>{children}</div>
          {edges.previous || edges.next ? <div className="dn-list-controls-scroll" role="group" aria-label="More filter controls">
            <button type="button" aria-label="Previous filter controls" disabled={!edges.previous} onClick={() => moveRail(-1)}><ChevronLeft size={16} aria-hidden="true" /></button>
            <button type="button" aria-label="More filter controls" disabled={!edges.next} onClick={() => moveRail(1)}><ChevronRight size={16} aria-hidden="true" /></button>
          </div> : null}
        </div>}
        {sort ? <div className="dn-list-controls-sort-row">{sort}</div> : null}
        {onReset ? <div className="dn-list-controls-reset-row"><button type="button" className="dn-list-controls-reset" onClick={onReset}
          disabled={!(canReset ?? activeCount)}>Reset</button></div> : null}
      </section> : null}
      {chips}
      <div className="dn-list-controls-topline">
        {typeof resultCount === 'number' ? <span className="dn-list-controls-context" aria-live="polite" aria-atomic="true">{resultCount} {resultLabel}</span> : null}
        {summary ? <span className="dn-list-controls-summary" title={summary}>{summary}</span> : null}
      </div>
    </div>
  );
}
