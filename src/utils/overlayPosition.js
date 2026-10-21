// Pure viewport placement shared by portaled selects and future calendar overlays.
// Coordinates are CSS pixels in the layout viewport, including visualViewport offsets.
export const computeOverlayPlacement = ({
  anchor, viewport, preferredHeight = 320, minimumWidth = 0, gap = 6, margin = 8,
  bottomObstruction = null,
}) => {
  const leftEdge = viewport.left + margin;
  const rightEdge = viewport.left + viewport.width - margin;
  const topEdge = viewport.top + margin;
  const bottomEdge = Math.min(
    viewport.top + viewport.height - margin,
    Number.isFinite(bottomObstruction) ? bottomObstruction - margin : Infinity,
  );
  const usableWidth = Math.max(0, rightEdge - leftEdge);
  const width = Math.min(usableWidth, Math.max(minimumWidth, anchor.width));
  const left = Math.max(leftEdge, Math.min(anchor.left, rightEdge - width));
  const below = Math.max(0, bottomEdge - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - topEdge - gap);
  const openAbove = below < Math.min(preferredHeight, 200) && above > below;
  const availableHeight = openAbove ? above : below;
  const maxHeight = Math.max(0, Math.min(preferredHeight, availableHeight));
  const top = openAbove
    ? Math.max(topEdge, anchor.top - gap - maxHeight)
    : Math.max(topEdge, Math.min(anchor.bottom + gap, bottomEdge - maxHeight));
  return { left, top, width, maxHeight, direction: openAbove ? 'above' : 'below' };
};

export const getVisibleViewport = (win) => {
  const visual = win.visualViewport;
  return {
    left: visual?.offsetLeft ?? 0,
    top: visual?.offsetTop ?? 0,
    width: visual?.width ?? win.innerWidth,
    height: visual?.height ?? win.innerHeight,
  };
};
