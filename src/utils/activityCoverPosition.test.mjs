import test from 'node:test';
import assert from 'node:assert/strict';
import { COVER_POSITION_DEFAULTS, COVER_POSITION_RULES, dragCoverPosition, zoomCoverPosition, clampCoverZoom } from './activityCoverPosition.js';
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
  assert.deepEqual(normalizeListState({ x: NaN, y: 500 }, COVER_POSITION_DEFAULTS, COVER_POSITION_RULES), { ...start, zoom: 1 });
});

test('zoom is bounded relative to cover fit and legacy saved offsets start at the original fit', () => {
  assert.deepEqual(normalizeListState({ x: 20, y: 80 }, COVER_POSITION_DEFAULTS, COVER_POSITION_RULES), { x: 20, y: 80, zoom: 1 });
  assert.deepEqual(normalizeListState({ x: 20, y: 80, zoom: 99 }, COVER_POSITION_DEFAULTS, COVER_POSITION_RULES), { x: 20, y: 80, zoom: 1 });
  assert.equal(clampCoverZoom(.1), 1); assert.equal(clampCoverZoom(20), 3); assert.equal(clampCoverZoom(NaN), 1);
  const result = zoomCoverPosition({ x: 20, y: 80, zoom: 2 }, Infinity, { width: 300, height: 300 }, { width: 0, height: 0 });
  assert.deepEqual(result, { x: 20, y: 80, zoom: 1 });
});

test('zoom keeps the same original point under a pinch center and pans across the new overflow', () => {
  const frame = { width: 300, height: 300 }, image = { width: 300, height: 300 };
  const zoomed = zoomCoverPosition({ x: 50, y: 50, zoom: 1 }, 2, frame, image, { x: 75, y: 60 });
  assert.deepEqual(zoomed, { x: 25, y: 20, zoom: 2 });
  assert.deepEqual(dragCoverPosition(zoomed, { x: 30, y: 30 }, frame, image), { x: 15, y: 10, zoom: 2 });
  assert.deepEqual(dragCoverPosition(zoomed, { x: 9999, y: -9999 }, frame, image), { x: 0, y: 100, zoom: 2 });
  assert.deepEqual(zoomCoverPosition(zoomed, 1, frame, image), { x: 50, y: 50, zoom: 1 });
});

test('portrait and panoramic photos never expose an empty edge after zooming and panning at their limits', () => {
  const frame = { width: 390, height: 338 };
  for (const image of [{ width: 600, height: 1200 }, { width: 2400, height: 300 }, { width: 1, height: 1 }]) {
    for (const requestedZoom of [0, 1, 1.75, 3, 30]) {
      for (const anchor of [{ x: 0, y: 0 }, { x: frame.width, y: frame.height }, { x: 100, y: 125 }]) {
        let position = zoomCoverPosition({ x: 50, y: 50, zoom: 1 }, requestedZoom, frame, image, anchor);
        position = dragCoverPosition(position, { x: 2000, y: -2000 }, frame, image);
        const scale = Math.max(frame.width / image.width, frame.height / image.height) * position.zoom;
        const width = image.width * scale, height = image.height * scale;
        const left = -(width - frame.width) * position.x / 100, top = -(height - frame.height) * position.y / 100;
        assert.ok(left <= .0001 && top <= .0001);
        assert.ok(left + width >= frame.width - .0001 && top + height >= frame.height - .0001);
        assert.ok(position.zoom >= 1 && position.zoom <= 3);
      }
    }
  }
});
