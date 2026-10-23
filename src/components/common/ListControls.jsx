import { useEffect, useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import './ListControls.css';

// Filtering stays in the caller; controls expand within the page, without a modal.
export default function ListControls({
  title = 'Filters', activeCount = 0, resultCount, resultLabel = 'results',
  summary = '', onReset, hasSort = false, hasPanel = true, search, children,
}) {
  const [open, setOpen] = useState(false);
  const [edges, setEdges] = useState({ previous: false, next: false });
  const panelId = useId();
  const railRef = useRef(null);
  const triggerRef = useRef(null);
  const label = hasSort ? 'Filters and sort' : 'Filters';
  const updateEdges = () => {
    const rail = railRef.current;
    if (!rail) return;
    const previous = rail.scrollLeft > 2;
    const next = rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2;
    setEdges((current) => current.previous === previous && current.next === next ? current : { previous, next });
  };
  useEffect(() => {
    if (!open) return undefined;
    updateEdges();
    const rail = railRef.current;
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(updateEdges) : null;
    observer?.observe(rail);
    [...rail.children].forEach((child) => observer?.observe(child));
    window.addEventListener('resize', updateEdges);
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.target.closest?.('.dn-modal, [role="dialog"]')) return;
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateEdges);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);
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
      {hasPanel && open ? <section id={panelId} className="dn-list-controls-panel" aria-label={title}>
        <div ref={railRef} className="dn-list-controls-body" onScroll={updateEdges}>{children}
          {onReset ? <button type="button" className="dn-list-controls-reset" onClick={onReset}
            disabled={!activeCount}>Reset</button> : null}
        </div>
        {edges.previous || edges.next ? <div className="dn-list-controls-scroll" role="group" aria-label="More filter controls">
            <button type="button" aria-label="Previous filter controls" disabled={!edges.previous} onClick={() => moveRail(-1)}><ChevronLeft size={16} aria-hidden="true" /></button>
            <button type="button" aria-label="More filter controls" disabled={!edges.next} onClick={() => moveRail(1)}><ChevronRight size={16} aria-hidden="true" /></button>
          </div> : null}
      </section> : null}
      <div className="dn-list-controls-topline">
        {typeof resultCount === 'number' ? <span className="dn-list-controls-context" aria-live="polite" aria-atomic="true">{resultCount} {resultLabel}</span> : null}
        {summary ? <span className="dn-list-controls-summary" title={summary}>{summary}</span> : null}
      </div>
    </div>
  );
}
