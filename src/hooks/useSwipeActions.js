import { useEffect, useRef, useState } from 'react';
import { resolveSwipeGesture } from '../utils/swipeGestures';

export default function useSwipeActions({ surfaceSelector } = {}) {
  const [action, setAction] = useState(null);
  const swipeRootRef = useRef(null);
  const pointerStartRef = useRef(null);
  const gestureMovedRef = useRef(false);
  const gestureAxisRef = useRef(null);
  const lastActionRef = useRef(null);

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
    gestureAxisRef.current = null;
    lastActionRef.current = null;
  };

  const handlePointerMove = (event) => {
    if (!pointerStartRef.current) return;
    const result = resolveSwipeGesture(
      pointerStartRef.current,
      { x: event.clientX, y: event.clientY },
      gestureAxisRef.current,
    );
    gestureAxisRef.current = result.axis;
    if (result.moved) gestureMovedRef.current = true;
    if (result.action && lastActionRef.current !== result.action) {
      lastActionRef.current = result.action;
      if (event.pointerType === 'touch') {
        try { navigator.vibrate?.(8); } catch { /* Unsupported on this browser */ }
      }
      setAction(result.action);
    }
  };

  const handlePointerUp = () => {
    pointerStartRef.current = null;
    gestureAxisRef.current = null;
    lastActionRef.current = null;
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
