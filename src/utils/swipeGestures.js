// Card swipe intent: a single source of truth for Moments, Activities,
// Transactions and Code Lists. This function never runs an action.
export const resolveSwipeGesture = (start, point, axis = null, threshold = 44) => {
  if (!start || !point) return { axis, action: null, moved: false };
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  if (!axis) {
    if (Math.abs(dy) > 11 && Math.abs(dy) > Math.abs(dx) * 1.2) axis = 'vertical';
    else if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.3) axis = 'horizontal';
  }
  if (axis !== 'horizontal') return { axis, action: null, moved: false };
  const moved = Math.abs(dx) > 12;
  const deliberate = Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy) * 1.2;
  return { axis, moved, action: deliberate ? (dx > 0 ? 'delete' : 'other') : null };
};

// Compatibility adapter for legacy consumers that receive drag offsets.
export const resolveDirectionalSwipe = ({ offsetX = 0, velocityX = 0, wasOpen = null } = {}) => {
  if (offsetX <= -44 || (offsetX <= -24 && velocityX <= -650)) return 'other';
  if (offsetX >= 44 || (offsetX >= 24 && velocityX >= 650)) return 'delete';
  if (wasOpen === 'other' && offsetX >= 32) return null;
  if (wasOpen === 'delete' && offsetX <= -32) return null;
  return wasOpen;
};
