import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, ListChecks, ListTodo, Receipt, Upload, PanelBottom, Plus } from 'lucide-react';
import ModalDialog from '../components/common/ModalDialog';
import usePersistentListState from '../hooks/usePersistentListState';
import './MobileCommandDock.css';

const defaults = Object.freeze({ floating: false, edge: 'right', y: .65 });
const rules = Object.freeze({ edge: ['left','right'], y: value => Number.isFinite(value) && value >= 0 && value <= 1 });
const CREATE_SIZE = 52;
const EDGE_PADDING = 10;
const DOUBLE_TAP_WINDOW_MS = 320;

// On a direct deep link there is no safe in-app history to pop.
const fallbackBackPath = pathname => {
  if (pathname.startsWith('/settings/')) return '/settings';
  if (/^\/events\/[^/]+\/(activities\/[^/]+|[^/]+)$/.test(pathname)) return pathname.slice(0, pathname.lastIndexOf('/'));
  if (/^\/events\/[^/]+$/.test(pathname)) return '/events';
  return pathname === '/dashboard' ? null : '/dashboard';
};
const destinations = [
  ['Home','/dashboard',LayoutDashboard], ['Moments','/events',CalendarDays],
  ['Activities','/activities',ListChecks], ['Tasks','/tasks',ListTodo],
  ['Finance','/financials/transactions',Receipt],
];
export default function MobileCommandDock({ controlsRef, menuRef, open, setOpen, onCreate, onAttachment, onExitComplete, isEntry, activePath }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [position, savePosition, resetPosition] = usePersistentListState('mobile-command', defaults, rules);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight, top: 0, inset: 0 }));
  const [drag, setDrag] = useState(null);
  const pointer = useRef(null);
  const tapTimer = useRef(null);
  const suppressClick = useRef(false);
  const clearPendingTap = () => {
    if (tapTimer.current !== null) window.clearTimeout(tapTimer.current);
    tapTimer.current = null;
  };
  // Do not open a stale menu after another route navigates or the dock unmounts.
  useEffect(() => () => {
    window.clearTimeout(tapTimer.current);
    tapTimer.current = null;
  }, [location.key]);
  const trigger = useRef(null);
  useEffect(() => {
    // Safari reports transient/negative visualViewport offsets while its
    // keyboard and browser chrome animate. Only a real keyboard-sized occlusion
    // should move the dock; harmless address-bar changes must not jump the +.
    let frame = null;
    const update = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const v = window.visualViewport;
        const width = v?.width || window.innerWidth;
        const height = v?.height || window.innerHeight;
        const top = Math.max(0, v?.offsetTop || 0);
        const occluded = Math.max(0, window.innerHeight - height - top);
        const inset = occluded >= 120 ? occluded : 0;
        setViewport(current => current.width === width && current.height === height &&
          current.top === top && current.inset === inset ? current : { width, height, top, inset });
      });
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);
  // Preserve the independent main scroller when Safari keyboard focus-pans
  // the fixed search dock. visualViewport still positions the search above it.
  useEffect(() => {
    const main = document.querySelector('.dn-shell > .dn-main');
    const canvas = main?.querySelector('.dn-content');
    if (!main || !canvas) return undefined;
    let savedScroll = 0;
    const isSearch = node => node?.matches?.('.dn-command-controls .dn-list-controls-search input');
    const restore = () => {
      if (!isSearch(document.activeElement)) return;
      if (Math.abs(canvas.scrollTop - savedScroll) > 1) canvas.scrollTop = savedScroll;
      if (window.scrollY > 1) window.scrollTo(0, 0);
    };
    const focused = event => {
      if (!isSearch(event.target)) return;
      savedScroll = canvas.scrollTop;
      main.style.setProperty('--dn-command-search-rest-height', `${main.getBoundingClientRect().height}px`);
      document.documentElement.classList.add('dn-command-search-focused');
      requestAnimationFrame(restore);
    };
    const blurred = event => {
      if (!isSearch(event.target)) return;
      document.documentElement.classList.remove('dn-command-search-focused');
      main.style.removeProperty('--dn-command-search-rest-height');
    };
    const viewportMoved = () => { if (isSearch(document.activeElement)) requestAnimationFrame(restore); };
    document.addEventListener('focusin', focused);
    document.addEventListener('focusout', blurred);
    window.visualViewport?.addEventListener('resize', viewportMoved);
    window.visualViewport?.addEventListener('scroll', viewportMoved);
    return () => {
      document.removeEventListener('focusin', focused);
      document.removeEventListener('focusout', blurred);
      window.visualViewport?.removeEventListener('resize', viewportMoved);
      window.visualViewport?.removeEventListener('scroll', viewportMoved);
      document.documentElement.classList.remove('dn-command-search-focused');
      main.style.removeProperty('--dn-command-search-rest-height');
    };
  }, []);
  const clamp = (value, low, high) => Math.max(low, Math.min(value, Math.max(low, high)));
  const floating = position.floating && viewport.inset < 100;
  const x = drag?.x ?? (position.edge === 'left' ? EDGE_PADDING : viewport.width - CREATE_SIZE - EDGE_PADDING);
  const verticalTravel = Math.max(1, viewport.height - (CREATE_SIZE + 116));
  const y = drag?.y ?? (viewport.top + 76 + position.y * verticalTravel);
  const pointerDown = event => {
    if (event.button !== 0 || !event.isPrimary) return;
    // A tap on + is also an explicit exit from iOS Search. Blur synchronously
    // on pointerdown so the keyboard cannot linger beneath the delayed menu.
    const focused = document.activeElement;
    if (focused?.matches?.('.dn-command-controls .dn-list-controls-search input')) focused.blur();
    const rect = event.currentTarget.getBoundingClientRect();
    pointer.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, dx: event.clientX-rect.x, dy: event.clientY-rect.y, moved: false };
    suppressClick.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = event => {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    if (!p.moved && Math.hypot(event.clientX-p.startX,event.clientY-p.startY) < 10) return;
    p.moved = true;
    suppressClick.current = true;
    clearPendingTap();
    setDrag({x:clamp(event.clientX-p.dx,EDGE_PADDING,viewport.width-CREATE_SIZE-EDGE_PADDING),y:clamp(event.clientY-p.dy,viewport.top+76,viewport.top+viewport.height-CREATE_SIZE-24)});
  };
  const pointerEnd = (event, cancelled = false) => {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    if (p.moved && drag && !cancelled) savePosition({ floating: true, edge: drag.x+CREATE_SIZE/2 < viewport.width/2 ? 'left':'right',
      y: clamp((drag.y-viewport.top-76)/verticalTravel,0,1) });
    if (cancelled) suppressClick.current = false;
    pointer.current = null;
    setDrag(null);
    if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onTriggerClick = event => {
    if (suppressClick.current) { suppressClick.current = false; return; }
    // Keyboard and assistive-tech activation remains immediate, not delayed.
    if (event.detail === 0) {
      clearPendingTap();
      setOpen(previous => !previous);
      return;
    }
    if (tapTimer.current !== null) {
      clearPendingTap();
      // React Router history index prevents leaving DN for an external origin.
      if (Number.isInteger(window.history.state?.idx) && window.history.state.idx > 0) navigate(-1);
      else {
        const fallback = fallbackBackPath(location.pathname);
        if (fallback) navigate(fallback, { replace: true });
      }
      return;
    }
    // Wait briefly so a second tap goes Back without flashing the create sheet.
    tapTimer.current = window.setTimeout(() => {
      tapTimer.current = null;
      setOpen(previous => !previous);
    }, DOUBLE_TAP_WINDOW_MS);
  };
  return <div ref={menuRef} className={`dn-command-root${floating || drag ? ' is-floating' : ''}${viewport.inset ? ' is-keyboard-open' : ''}`} style={{'--dn-command-keyboard':`${viewport.inset}px`}}>
    <div className="dn-command-bar" aria-label="Current page controls">
      <div ref={controlsRef} className="dn-command-controls" />
      <div className="dn-command-button-slot">
        <button ref={trigger} type="button" className={`mobile-dock-create-trigger dn-command-trigger${open?' is-open':''}${drag?' is-dragging':''}`}
          style={floating || drag ? {position:'fixed',left:x,top:y}:undefined}
          aria-label={open?'Close quick create menu':'Open quick create menu'}
          aria-description="Tap once for navigation and creation, double-tap to go back. Drag to move; return to dock from the menu."
          aria-haspopup="dialog" aria-expanded={open}
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event=>pointerEnd(event)}
          onPointerCancel={event=>pointerEnd(event,true)}
          onClick={onTriggerClick}>
          <Plus className="dn-create-glyph" size={31} strokeWidth={2.8} aria-hidden="true" />
        </button>
      </div>
    </div>
    <AnimatePresence initial={false} mode="wait" onExitComplete={onExitComplete}>{open ? <ModalDialog key="mobile-command" title="Navigate & create" className="dn-command-dialog" variant="drawer" onClose={()=>setOpen(false)}>
      <nav aria-label="Main navigation" className="dn-command-destinations">
        {destinations.map(([label,path,Icon])=><Link key={path} to={path} aria-current={activePath===path?'page':undefined} onClick={()=>setOpen(false)}>
          <span className="dn-command-destination-icon"><Icon size={21} strokeWidth={1.8} aria-hidden="true" /></span><span>{label}</span>
        </Link>)}
      </nav>
      <section role="group" className="dn-command-actions" aria-label="Quick create actions">
        <h3>Create new</h3>
        <div>
          <button type="button" onClick={event=>onCreate('event',event)}><CalendarDays size={19} aria-hidden="true" />Life moment</button>
          <button type="button" onClick={event=>onCreate('activity',event)}><ListChecks size={19} aria-hidden="true" />{isEntry?'Add entry':'Activity'}</button>
          <button type="button" onClick={event=>onCreate('task',event)}><ListTodo size={19} aria-hidden="true" />Task</button>
          <button type="button" onClick={event=>onCreate('transaction',event)}><Receipt size={19} aria-hidden="true" />Transaction</button>
          {onAttachment ? <button type="button" onClick={onAttachment}><Upload size={19} aria-hidden="true" />Attachment</button>:null}
        </div>
      </section>
      {position.floating ? <button type="button" className="dn-command-redock" onClick={()=>{resetPosition();setOpen(false);}}><PanelBottom size={18} aria-hidden="true" />Return to dock</button>
        : <p className="dn-command-hint">Drag the creator to either edge for easier reach.</p>}
    </ModalDialog> : null}</AnimatePresence>
  </div>;
}
