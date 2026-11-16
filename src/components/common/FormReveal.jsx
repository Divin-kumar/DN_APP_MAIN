import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { useLayoutEffect, useRef } from 'react';

const expanded = { gridTemplateRows: '1fr', opacity: 1 };
const collapsed = { gridTemplateRows: '0fr', opacity: 0 };

function RevealPanel({ children }) {
  const reduceMotion = useReducedMotion();
  const isPresent = useIsPresent();
  const panel = useRef(null);
  useLayoutEffect(() => { panel.current.inert = !isPresent; }, [isPresent]);
  return <motion.div ref={panel} className="dn-form-reveal"
    initial={collapsed} animate={expanded} exit={collapsed}
    transition={{ duration: reduceMotion ? 0 : .22, ease: [0.24, 0.72, 0.26, 1] }}>
    <div>{children}</div>
  </motion.div>;
}

export default function FormReveal({ show, children }) {
  return <AnimatePresence initial={false}>
    {show ? <RevealPanel>{children}</RevealPanel> : null}
  </AnimatePresence>;
}
