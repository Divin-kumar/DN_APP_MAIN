import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

export const MobileControlsContext = createContext(null);

// Portal the existing controls, not copies: callers keep their state, handlers,
// debounce, filter drafts and scope. Desktop renders in its original location.
export default function MobileControlsSlot({ children }) {
  const target = useContext(MobileControlsContext);
  return target ? createPortal(children, target) : children;
}
