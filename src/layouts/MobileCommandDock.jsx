import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, ListChecks, ListTodo, Receipt, Upload, PanelBottom, Plus } from 'lucide-react';
import ModalDialog from '../components/common/ModalDialog';
import usePersistentListState from '../hooks/usePersistentListState';
import './MobileCommandDock.css';

const defaults = Object.freeze({ floating: false, edge: 'right', y: .65 });
const rules = Object.freeze({ edge: ['left','right'], y: value => Number.isFinite(value) && value >= 0 && value <= 1 });
const CREATE_SIZE = 68;
const EDGE_PADDING = 12;
const destinations = [
  ['Home','/dashboard',LayoutDashboard], ['Moments','/events',CalendarDays],
  ['Activities','/activities',ListChecks], ['Tasks','/tasks',ListTodo],
  ['Finance','/financials/transactions',Receipt],
];
export default function MobileCommandDock({ controlsRef, menuRef, open, setOpen, onCreate, onAttachment, onExitComplete, isEntry, activePath }) {
  const [position, savePosition, resetPosition] = usePersistentListState('mobile-command', defaults, rules);
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight, top: 0, inset: 0 }));
  const [drag, setDrag] = useState(null);
  const pointer = useRef(null);
  const suppressClick = useRef(false);
  const trigger = useRef(null);
  useEffect(() => {
    const update = () => {
      const v = window.visualViewport;
      setViewport({ width: v?.width || window.innerWidth, height: v?.height || window.innerHeight,
        top: v?.offsetTop || 0, inset: Math.max(0, window.innerHeight - (v?.height || window.innerHeight) - (v?.offsetTop || 0)) });
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
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
  const x = drag?.x ?? (position.edge === 'left' ? 12 : viewport.width - CREATE_SIZE - EDGE_PADDING);
  const y = drag?.y ?? (viewport.top + 76 + position.y * Math.max(0, viewport.height - (CREATE_SIZE + 116)));
  const pointerDown = event => {
    if (event.button !== 0 || !event.isPrimary) return;
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
    setDrag({x:clamp(event.clientX-p.dx,EDGE_PADDING,viewport.width-CREATE_SIZE-EDGE_PADDING),y:clamp(event.clientY-p.dy,viewport.top+76,viewport.top+viewport.height-CREATE_SIZE-24)});
  };
  const pointerEnd = (event, cancelled = false) => {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    if (p.moved && drag && !cancelled) savePosition({ floating: true, edge: drag.x+CREATE_SIZE/2 < viewport.width/2 ? 'left':'right',
      y: clamp((drag.y-viewport.top-76)/Math.max(1,viewport.height-164),0,1) });
    if (cancelled) suppressClick.current = false;
    pointer.current = null;
    setDrag(null);
    if(event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div ref={menuRef} className={`dn-command-root${floating || drag ? ' is-floating' : ''}`} style={{'--dn-command-keyboard':`${viewport.inset}px`}}>
    <div className="dn-command-bar" aria-label="Current page controls">
      <div ref={controlsRef} className="dn-command-controls" />
      <div className="dn-command-button-slot">
        <button ref={trigger} type="button" className={`mobile-dock-create-trigger dn-command-trigger${open?' is-open':''}${drag?' is-dragging':''}`}
          style={floating || drag ? {position:'fixed',left:x,top:y}:undefined}
          aria-label={open?'Close quick create menu':'Open quick create menu'}
          aria-description="Navigation and creation. Drag to move; return to dock from the menu."
          aria-haspopup="dialog" aria-expanded={open}
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event=>pointerEnd(event)}
          onPointerCancel={event=>pointerEnd(event,true)}
          onClick={()=>{if(suppressClick.current){suppressClick.current=false;return;}setOpen(!open);}}>
          <Plus className="dn-create-glyph" size={34} strokeWidth={2.7} aria-hidden="true" />
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
