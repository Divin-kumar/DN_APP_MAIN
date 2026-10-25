export const COVER_POSITION_DEFAULTS = Object.freeze({ x: 50, y: 50 });
const validPosition = (value) => Number.isFinite(value) && value >= 0 && value <= 100;
export const COVER_POSITION_RULES = Object.freeze({ x: validPosition, y: validPosition });
export const clampCoverPosition = (value) => Math.max(0, Math.min(100, value));

// object-fit: cover moves within the overflow of the scaled original, never its bytes.
export const dragCoverPosition = (start, delta, frame, image) => {
  if (![image.width, image.height, frame.width, frame.height].every((value) => Number.isFinite(value) && value > 0)) return { x: start.x, y: start.y };
  const scale = Math.max(frame.width / image.width, frame.height / image.height);
  const overflowX = image.width * scale - frame.width, overflowY = image.height * scale - frame.height;
  return { x: overflowX > 1 ? clampCoverPosition(start.x - delta.x / overflowX * 100) : start.x,
    y: overflowY > 1 ? clampCoverPosition(start.y - delta.y / overflowY * 100) : start.y };
};
