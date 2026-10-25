import test from 'node:test';
import assert from 'node:assert/strict';
import { COVER_POSITION_DEFAULTS, COVER_POSITION_RULES, dragCoverPosition } from './activityCoverPosition.js';
import { normalizeListState } from './listStateMemory.js';

test('cover dragging translates only the scaled overflow and leaves source dimensions unchanged', () => {
  const portrait = { width: 600, height: 1200 }, frame = { width: 300, height: 300 }, start = { x: 50, y: 50 };
  assert.deepEqual(dragCoverPosition(start, { x: 100, y: 60 }, frame, portrait), { x: 50, y: 30 });
  assert.deepEqual(dragCoverPosition(start, { x: 60, y: 100 }, frame, { width: 1200, height: 600 }), { x: 30, y: 50 });
  assert.deepEqual(portrait, { width: 600, height: 1200 }); assert.deepEqual(start, { x: 50, y: 50 });
});
test('cover offsets clamp to visible bounds; tiny images and invalid dimensions cannot distort or produce NaN', () => {
  const start = { x: 50, y: 50 }, frame = { width: 300, height: 300 };
  assert.deepEqual(dragCoverPosition(start, { x: 9999, y: -9999 }, frame, { width: 600, height: 1200 }), { x: 50, y: 100 });
  assert.deepEqual(dragCoverPosition(start, { x: 999, y: 999 }, frame, { width: 1, height: 1 }), start);
  assert.deepEqual(dragCoverPosition(start, { x: 99, y: 99 }, frame, { width: Infinity, height: 0 }), start);
  assert.deepEqual(normalizeListState({ x: NaN, y: 500 }, COVER_POSITION_DEFAULTS, COVER_POSITION_RULES), start);
});
