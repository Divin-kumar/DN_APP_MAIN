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
const DOUBLE_TAP_WINDOW_MS = 215;

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
export default function MobileCommandDock({ controlsRef, menuRef, open, setOpen, onCreate, onAttachment, handingOff, isEntry, activePath }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [position, savePosition, resetPosition] = usePersistentListState('mobile-command', defaults, rules);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight, top: 0,
    inset: 0, visualBottom: window.innerHeight, keyboardOpen: false }));
  const [searchFocused, setSearchFocused] = useState(false);
  const searchFocusRef = useRef(false);
  const focusBaselineRef = useRef(0);
  const [drag, setDrag] = useState(null);
  const pointer = useRef(null);
  const firstTapAt = useRef(null);
  const secondTap = useRef(false);
  const suppressClick = useRef(false);
  const clearPendingTap = () => {
    firstTapAt.current = null;
    secondTap.current = false;
  };
  const closeMenu = () => {
    clearPendingTap();
    setOpen(false);
  };
  const createFromMenu = (event) => {
    clearPendingTap();
    onCreate(event.currentTarget.dataset.create, event);
  };
  useEffect(() => {
    firstTapAt.current = null;
    secondTap.current = false;
  }, [location.key]);
  const trigger = useRef(null);
  useEffect(() => {
    // Safari can shrink BOTH window.innerHeight and visualViewport.height, or
    // pan visualViewport.offsetTop during focus. Comparing the two current
    // heights then reports zero keyboard inset even while Search is covered.
    // Preserve the pre-focus height and anchor to the visible viewport edge.
    let frame = null;
    const isSearch = node => node?.matches?.('.dn-command-controls .dn-list-controls-search input');
    const update = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const v = window.visualViewport;
        const width = v?.width || window.innerWidth;
        const height = v?.height || window.innerHeight;
        const top = Math.max(0, v?.offsetTop || 0);
        const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight || 0);
        const occluded = Math.max(0, layoutHeight - height - top);
        const inset = occluded >= 120 ? occluded : 0;
        const baseline = focusBaselineRef.current;
        const keyboardOpen = inset >= 120 || (baseline > 0 && baseline - height >= 120);
        const visualBottom = top + height;
        if (!searchFocusRef.current && baseline > 0 && height >= baseline - 40) {
          focusBaselineRef.current = 0;
        }
        setViewport(current => current.width === width && current.height === height &&
          current.top === top && current.inset === inset && current.keyboardOpen === keyboardOpen &&
          current.visualBottom === visualBottom
          ? current : { width, height, top, inset, visualBottom, keyboardOpen });
      });
    };
    const focused = event => {
      if (!isSearch(event.target)) return;
      searchFocusRef.current = true;
      // Capture before iOS begins keyboard animation; do not replace it on
      // every resize or address-bar adjustment while Search remains focused.
      focusBaselineRef.current = Math.max(window.innerHeight,
        document.documentElement.clientHeight || 0, window.visualViewport?.height || 0);
      setSearchFocused(true);
      update();
    };
    const blurred = event => {
      if (!isSearch(event.target)) return;
      searchFocusRef.current = false;
      setSearchFocused(false);
      // Retain baseline until keyboard finishes its dismissal animation.
      update();
    };
    document.addEventListener('focusin', focused);
    document.addEventListener('focusout', blurred);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    update();
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      document.removeEventListener('focusin', focused);
      document.removeEventListener('focusout', blurred);
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
      // Do not reset window.scrollY: iOS Safari pans its visual viewport to
      // reveal focused inputs. Fighting that pan hides Search under the keyboard.
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
  // Insights uses right-aligned report controls and amounts in the scroll area.
  const dockInInsights = /^\/insights\/?$/.test(location.pathname);
  const floating = position.floating && !dockInInsights && !searchFocused && !viewport.keyboardOpen;
  const activeDrag = dockInInsights ? null : drag;
  const x = drag?.x ?? (position.edge === 'left' ? EDGE_PADDING : viewport.width - CREATE_SIZE - EDGE_PADDING);
  const verticalTravel = Math.max(1, viewport.height - (CREATE_SIZE + 116));
  const y = drag?.y ?? (viewport.top + 76 + position.y * verticalTravel);
  const pointerDown = event => {
    if (event.button !== 0 || !event.isPrimary) return;
    // A second activation must start on the + itself, within the gesture window.
    const elapsed = firstTapAt.current === null ? Infinity : event.timeStamp - firstTapAt.current;
    secondTap.current = open && elapsed >= 0 && elapsed <= DOUBLE_TAP_WINDOW_MS;
    suppressClick.current = false;
    if (dockInInsights) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointer.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, dx: event.clientX-rect.x, dy: event.clientY-rect.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = event => {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    if (!p.moved && Math.hypot(event.clientX-p.startX,event.clientY-p.startY) < 10) return;
    if (!p.moved && open) closeMenu();
    p.moved = true;
    suppressClick.current = true;
    setDrag({x:clamp(event.clientX-p.dx,EDGE_PADDING,viewport.width-CREATE_SIZE-EDGE_PADDING),y:clamp(event.clientY-p.dy,viewport.top+76,viewport.top+viewport.height-CREATE_SIZE-24)});
  };
  const pointerEnd = (event, cancelled = false) => {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    if (p.moved && drag && !cancelled) savePosition({ floating: true, edge: drag.x+CREATE_SIZE/2 < viewport.width/2 ? 'left':'right',
      y: clamp((drag.y-viewport.top-76)/verticalTravel,0,1) });
    if (cancelled) {
      secondTap.current = false;
      suppressClick.current = false;
    }
    pointer.current = null;
    setDrag(null);
    if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onTriggerClick = event => {
    const goBack = event.detail !== 0 && secondTap.current;
    secondTap.current = false;
    if (suppressClick.current) { suppressClick.current = false; return; }
    // Close Search's iOS keyboard only after pointerup/click, otherwise
    // resizing the dock during a tap can move its target before activation.
    const focused = document.activeElement;
    if (focused?.matches?.('.dn-command-controls .dn-list-controls-search input')) focused.blur();
    if (open) {
      closeMenu();
      if (!goBack) return;
      // React Router history index prevents leaving DN for an external origin.
      if (Number.isInteger(window.history.state?.idx) && window.history.state.idx > 0) navigate(-1);
      else {
        const fallback = fallbackBackPath(location.pathname);
        if (fallback) navigate(fallback, { replace: true });
      }
      return;
    }
    firstTapAt.current = event.detail === 0 ? null : event.timeStamp;
    setOpen(true);
  };
  return <div ref={menuRef} className={`dn-command-root${dockInInsights ? ' is-insights-docked' : ''}${floating || activeDrag ? ' is-floating' : ''}${viewport.keyboardOpen ? ' is-keyboard-open' : ''}`} style={{
    '--dn-command-keyboard':`${viewport.inset}px`,
    '--dn-command-visual-bottom':`${viewport.visualBottom}px`
  }}>
    <div className={`dn-command-bar${open || activeDrag ? ' is-pointer-active' : ''}`} aria-label="Current page controls">
      <div ref={controlsRef} className="dn-command-controls" />
      <div className="dn-command-button-slot">
        <button ref={trigger} type="button" className={`mobile-dock-create-trigger dn-command-trigger${open?' is-open':''}${activeDrag?' is-dragging':''}`}
          style={floating || activeDrag ? {position:'fixed',left:x,top:y}:undefined}
          aria-label={open?'Close quick create menu':'Open quick create menu'}
          aria-description={'Tap once for navigation and creation, double-tap to go back.' + (dockInInsights ? '' : ' Drag to move; return to dock from the menu.')}
          aria-haspopup="dialog" aria-expanded={open}
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event=>pointerEnd(event)}
          onPointerCancel={event=>pointerEnd(event,true)}
          onClick={onTriggerClick}>
          <Plus className="dn-create-glyph" size={31} strokeWidth={2.8} aria-hidden="true" />
        </button>
      </div>
    </div>
    <AnimatePresence initial={false} custom={handingOff}>{open ? <ModalDialog key="mobile-command" title="Navigate & create"
      className={`dn-command-dialog ${floating ? 'is-floating-' + position.edge : 'is-docked'}`} variant="drawer" onClose={closeMenu} deferClose={false}>
      <nav aria-label="Main navigation" className="dn-command-destinations">
        {destinations.map(([label,path,Icon])=><Link key={path} to={path} aria-current={activePath===path?'page':undefined} onClick={closeMenu}>
          <span className="dn-command-destination-icon"><Icon size={21} strokeWidth={1.8} aria-hidden="true" /></span><span>{label}</span>
        </Link>)}
      </nav>
      <section role="group" className="dn-command-actions" aria-label="Quick create actions">
        <h3>Create new</h3>
        <div>
          <button type="button" data-create="event" onClick={createFromMenu}><CalendarDays size={19} aria-hidden="true" />Life moment</button>
          <button type="button" data-create="activity" onClick={createFromMenu}><ListChecks size={19} aria-hidden="true" />{isEntry?'Add entry':'Activity'}</button>
          <button type="button" data-create="task" onClick={createFromMenu}><ListTodo size={19} aria-hidden="true" />Task</button>
          <button type="button" data-create="transaction" onClick={createFromMenu}><Receipt size={19} aria-hidden="true" />Transaction</button>
          {onAttachment ? <button type="button" onClick={()=>{clearPendingTap();onAttachment();}}><Upload size={19} aria-hidden="true" />Attachment</button>:null}
        </div>
      </section>
      {floating ? <button type="button" className="dn-command-redock" onClick={()=>{resetPosition();closeMenu();}}><PanelBottom size={18} aria-hidden="true" />Return to dock</button> : null}
    </ModalDialog> : null}</AnimatePresence>
  </div>;
}
