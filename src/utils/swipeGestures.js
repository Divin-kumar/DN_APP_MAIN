export const resolveSwipeGesture = (start, point, axis = null, threshold = 56) => {
  if (!start || !point) return { axis, action: null, moved: false };
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  if (!axis) {
    if (Math.abs(dy) > 11 && Math.abs(dy) > Math.abs(dx) * 1.2) axis = 'vertical';
    else if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.35) axis = 'horizontal';
  }
  if (axis !== 'horizontal') return { axis, action: null, moved: false };
  const moved = Math.abs(dx) > 12;
  return { axis, moved, action: Math.abs(dx) >= threshold ? (dx > 0 ? 'delete' : 'other') : null };
};
