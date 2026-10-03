import { useEffect, useRef, useState } from 'react';

export default function useSwipeActions({ surfaceSelector } = {}) {
  const [action, setAction] = useState(null);
  const swipeRootRef = useRef(null);
  const pointerStartRef = useRef(null);
  const gestureMovedRef = useRef(false);

  useEffect(() => {
    if (!action) return undefined;
    const handleOutsidePointerDown = (event) => {
      const target = event.target;
      const swipeSurface = surfaceSelector && target instanceof Element ? target.closest(surfaceSelector) : null;
      const isInside = swipeSurface
        ? swipeRootRef.current?.contains(swipeSurface)
        : swipeRootRef.current?.contains(target);
      if (!isInside) setAction(null);
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [action, surfaceSelector]);

  const handlePointerDown = (event) => {
    const interactiveTarget = event.target.closest('button, a, input, select, textarea');
    if (interactiveTarget && interactiveTarget !== event.currentTarget) return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    gestureMovedRef.current = false;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!pointerStartRef.current) return;
    const deltaX = event.clientX - pointerStartRef.current.x;
    const deltaY = event.clientY - pointerStartRef.current.y;
    if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) gestureMovedRef.current = true;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    setAction(deltaX > 0 ? 'delete' : 'other');
  };

  const handlePointerUp = () => {
    pointerStartRef.current = null;
  };

  const consumeSwipeClick = (event) => {
    if (!gestureMovedRef.current) return false;
    event.preventDefault();
    event.stopPropagation();
    gestureMovedRef.current = false;
    return true;
  };

  const toggleOther = () => setAction((current) => (current === 'other' ? null : 'other'));
  const close = () => setAction(null);

  return {
    action,
    setAction,
    swipeRootRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    consumeSwipeClick,
    toggleOther,
    close,
  };
}
