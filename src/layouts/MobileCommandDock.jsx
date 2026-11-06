import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, ListChecks, ListTodo, Receipt, Plus, Upload, PanelBottom } from 'lucide-react';
import ModalDialog from '../components/common/ModalDialog';
import usePersistentListState from '../hooks/usePersistentListState';
import './MobileCommandDock.css';

const defaults = Object.freeze({ floating: false, edge: 'right', y: .65 });
const rules = Object.freeze({ edge: ['left','right'], y: value => Number.isFinite(value) && value >= 0 && value <= 1 });
const destinations = [
  ['Home','/dashboard',LayoutDashboard], ['Moments','/events',CalendarDays],
  ['Activities','/activities',ListChecks], ['Tasks','/tasks',ListTodo],
  ['Finance','/financials/transactions',Receipt],
];
export default function MobileCommandDock({ controlsRef, menuRef, open, setOpen, onCreate, onAttachment, isEntry, activePath }) {
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
  const clamp = (value, low, high) => Math.max(low, Math.min(value, Math.max(low, high)));
  const floating = position.floating && viewport.inset < 100;
  const x = drag?.x ?? (position.edge === 'left' ? 12 : viewport.width - 64);
  const y = drag?.y ?? (viewport.top + 76 + position.y * Math.max(0, viewport.height - 164));
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
    setDrag({x:clamp(event.clientX-p.dx,12,viewport.width-64),y:clamp(event.clientY-p.dy,viewport.top+76,viewport.top+viewport.height-88)});
  };
  const pointerEnd = (event, cancelled = false) => {
    const p = pointer.current;
    if (!p || p.id !== event.pointerId) return;
    if (p.moved && drag && !cancelled) savePosition({ floating: true, edge: drag.x+26 < viewport.width/2 ? 'left':'right',
      y: clamp((drag.y-viewport.top-76)/Math.max(1,viewport.height-164),0,1) });
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
          <Plus size={24} className="dn-create-glyph" aria-hidden="true" />
        </button>
      </div>
    </div>
    {open ? <ModalDialog title="Navigate & create" className="dn-command-dialog" variant="drawer" onClose={()=>setOpen(false)}>
      <nav aria-label="Main navigation" className="dn-command-destinations">
        {destinations.map(([label,path,Icon])=><Link key={path} to={path} aria-current={activePath===path?'page':undefined} onClick={()=>setOpen(false)}>
          <Icon size={21} aria-hidden="true" /><span>{label}</span>
        </Link>)}
      </nav>
      <section role="group" className="dn-command-actions" aria-label="Quick create actions">
        <h3>Create</h3>
        <div>
          <button type="button" onClick={event=>onCreate('event',event)}><CalendarDays size={19} aria-hidden="true" />Life moment</button>
          <button type="button" onClick={event=>onCreate('activity',event)}><ListChecks size={19} aria-hidden="true" />{isEntry?'Add entry':'Activity'}</button>
          <button type="button" onClick={event=>onCreate('task',event)}><ListTodo size={19} aria-hidden="true" />Task</button>
          <button type="button" onClick={event=>onCreate('transaction',event)}><Receipt size={19} aria-hidden="true" />Transaction</button>
          {onAttachment ? <button type="button" onClick={onAttachment}><Upload size={19} aria-hidden="true" />Attachment</button>:null}
        </div>
      </section>
      {position.floating ? <button type="button" className="dn-command-redock" onClick={()=>{resetPosition();setOpen(false);}}><PanelBottom size={18} aria-hidden="true" />Return to dock</button>
        : <p className="dn-command-hint">Drag the + to move it. You can return it here from this menu.</p>}
    </ModalDialog> : null}
  </div>;
}
