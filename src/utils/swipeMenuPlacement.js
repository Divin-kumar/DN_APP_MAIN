// A compact fixed popover positioned beside a card, never a full-card overlay.
// Uses CSS viewport pixels, including iOS visualViewport offsets.
export const computeSwipeMenuPlacement = ({
  anchor, viewport, count = 3, width = 188, itemHeight = 44,
  margin = 12, gap = 8, bottomReserve = 0,
}) => {
  const leftEdge = viewport.left + margin;
  const rightEdge = viewport.left + viewport.width - margin;
  const topEdge = viewport.top + margin;
  const safeReserve = Math.min(Math.max(0, bottomReserve), Math.max(0, viewport.height * 0.25));
  const bottomEdge = viewport.top + viewport.height - margin - safeReserve;
  const menuWidth = Math.min(Math.max(0, rightEdge - leftEdge), width);
  const maxHeight = Math.min(244, Math.max(0, bottomEdge - topEdge));
  const preferredHeight = Math.min(maxHeight, 12 + Math.max(1, count) * itemHeight + 8);
  const below = Math.max(0, bottomEdge - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - topEdge - gap);
  const direction = below >= Math.min(preferredHeight, 132) || below >= above ? 'below' : 'above';
  const naturalTop = direction === 'below'
    ? anchor.bottom + gap
    : anchor.top - preferredHeight - gap;
  const top = Math.max(topEdge, Math.min(naturalTop, bottomEdge - preferredHeight));
  const left = Math.max(leftEdge, Math.min(anchor.right - menuWidth, rightEdge - menuWidth));
  return { top, left, width: menuWidth, maxHeight: preferredHeight, direction };
};
