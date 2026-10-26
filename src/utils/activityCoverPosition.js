export const COVER_ZOOM_MIN = 1;
export const COVER_ZOOM_MAX = 3;
export const COVER_POSITION_DEFAULTS = Object.freeze({ x: 50, y: 50, zoom: COVER_ZOOM_MIN });
const validPosition = (value) => Number.isFinite(value) && value >= 0 && value <= 100;
export const COVER_POSITION_RULES = Object.freeze({ x: validPosition, y: validPosition,
  zoom: (value) => Number.isFinite(value) && value >= COVER_ZOOM_MIN && value <= COVER_ZOOM_MAX });
export const clampCoverPosition = (value) => Math.max(0, Math.min(100, value));
export const clampCoverZoom = (value) => Number.isFinite(value) ? Math.max(COVER_ZOOM_MIN, Math.min(COVER_ZOOM_MAX, value)) : COVER_ZOOM_MIN;

const coverSize = (frame, image, zoom = COVER_ZOOM_MIN) => {
  if (![image.width, image.height, frame.width, frame.height].every((value) => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.max(frame.width / image.width, frame.height / image.height) * clampCoverZoom(zoom);
  return { width: image.width * scale, height: image.height * scale };
};

// object-fit: cover moves within the overflow of the scaled original, never its bytes.
export const dragCoverPosition = (start, delta, frame, image) => {
  const size = coverSize(frame, image, start.zoom);
  if (!size) return { ...start };
  const overflowX = size.width - frame.width, overflowY = size.height - frame.height;
  return { ...start, x: overflowX > 1 ? clampCoverPosition(start.x - delta.x / overflowX * 100) : start.x,
    y: overflowY > 1 ? clampCoverPosition(start.y - delta.y / overflowY * 100) : start.y };
};

// Keep the same point of the original beneath the pinch center (or frame center
// for buttons), then bound both offsets so zooming never reveals an empty edge.
export const zoomCoverPosition = (start, requestedZoom, frame, image, anchor = { x: frame.width / 2, y: frame.height / 2 }) => {
  const zoom = clampCoverZoom(requestedZoom);
  const before = coverSize(frame, image, start.zoom), after = coverSize(frame, image, zoom);
  if (!before || !after) return { ...start, zoom };
  const offset = (axis, size, extent) => size > extent ? -(size - extent) * start[axis] / 100 : 0;
  const next = (axis, oldSize, newSize, extent, point) => {
    const ratio = (point - offset(axis, oldSize, extent)) / oldSize;
    return newSize - extent > 1 ? clampCoverPosition((ratio * newSize - point) / (newSize - extent) * 100) : 50;
  };
  return { x: next('x', before.width, after.width, frame.width, anchor.x),
    y: next('y', before.height, after.height, frame.height, anchor.y), zoom };
};
