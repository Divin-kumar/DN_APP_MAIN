import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import './CompletionCheck.css';

// The icon is mounted across status changes: existing completed records do not
// play a celebration every time a list is opened or a filter changes.
export default function CompletionCheck({ active, size = 16 }) {
  const previous = useRef(active);
  const [justCompleted, setJustCompleted] = useState(false);
  useEffect(() => {
    if (active && !previous.current) setJustCompleted(true);
    if (!active) setJustCompleted(false);
    previous.current = active;
  }, [active]);
  if (!active) return null;
  return <Check size={size} aria-hidden="true" className={justCompleted ? 'dn-completion-check is-just-completed' : 'dn-completion-check'}
    onAnimationEnd={() => setJustCompleted(false)} />;
};