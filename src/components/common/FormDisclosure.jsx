import { useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';

export default function FormDisclosure({ label = 'More options', hint = '', children, className = '' }) {
  const panel = useRef(null);
  const motion = useRef(null);
  useEffect(() => () => motion.current?.cancel(), []);

  const showRequiredField = (event) => {
    motion.current?.cancel();
    motion.current = null;
    event.currentTarget.open = true;
    delete event.currentTarget.dataset.closing;
    panel.current.inert = false;
  };

  const toggle = (event) => {
    const details = event.currentTarget.parentElement;
    const region = panel.current;
    const opening = !details.open || Boolean(details.dataset.closing);
    if (!region.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (motion.current) {
        motion.current.cancel();
        motion.current = null;
        details.open = Boolean(details.dataset.closing);
        delete details.dataset.closing;
        region.inert = false;
        event.preventDefault();
      }
      return;
    }

    event.preventDefault();
    // Start at the painted height so a second tap reverses without a jump.
    const currentHeight = details.open ? region.offsetHeight : 0;
    const currentOpacity = details.open ? Number(getComputedStyle(region).opacity) : 0;
    motion.current?.cancel();
    details.open = true;
    region.inert = !opening;
    if (opening) delete details.dataset.closing;
    else details.dataset.closing = 'true';

    const targetHeight = opening ? region.scrollHeight : 0;
    const animation = region.animate([
      { height: `${currentHeight}px`, opacity: currentOpacity, overflow: 'clip' },
      { height: `${targetHeight}px`, opacity: opening ? 1 : 0, overflow: 'clip' },
    ], { duration: opening ? 165 : 135, easing: 'cubic-bezier(.2,.65,.32,1)', fill: 'both' });
    motion.current = animation;
    animation.onfinish = () => {
      if (motion.current !== animation) return;
      details.open = opening;
      delete details.dataset.closing;
      region.inert = false;
      motion.current = null;
      animation.cancel();
    };
  };

  return <details className={`dn-form-disclosure ${className}`.trim()} onInvalidCapture={showRequiredField}>
    <summary onClick={toggle}>
      <span>{label}</span>
      {hint ? <small>{hint}</small> : null}
      <Plus size={16} className="dn-form-expand" aria-hidden="true" />
    </summary>
    <div ref={panel} className="dn-form-disclosure-panel">
      <div className="dn-form-disclosure-content">{children}</div>
    </div>
  </details>;
}
