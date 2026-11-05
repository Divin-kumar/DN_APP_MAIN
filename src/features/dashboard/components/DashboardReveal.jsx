import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

// Animate only the content beneath the dashboard header; saved Show/Hide state
// and the existing internal scroll regions remain owned by DashboardOverview.
export default function DashboardReveal({ open, children }) {
  const reducedMotion = useReducedMotion();
  return <AnimatePresence initial={false}>
    {open ? <motion.div key="dashboard-section-body" className="dn-dashboard-reveal"
      initial={reducedMotion ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={reducedMotion ? { height: 0, opacity: 0 } : { height: 0, opacity: 0 }}
      transition={reducedMotion ? { duration: 0 } : { height: { duration: .25, ease: [.22, .8, .25, 1] }, opacity: { duration: .17 } }}>
      <div className="dn-dashboard-reveal-inner">{children}</div>
    </motion.div> : null}
  </AnimatePresence>;
}