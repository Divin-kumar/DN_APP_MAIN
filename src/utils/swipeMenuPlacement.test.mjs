import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSwipeMenuPlacement } from './swipeMenuPlacement.js';

test('compact popup stays near a card instead of covering the whole card', () => {
  const pos = computeSwipeMenuPlacement({
    anchor: { left: 25, right: 360, top: 160, bottom: 260 },
    viewport: { left: 0, top: 0, width: 390, height: 840 }, count: 3, bottomReserve: 84,
  });
  assert.equal(pos.width, 188);
  assert.equal(pos.direction, 'below');
  assert.equal(pos.left, 172);
  assert.equal(pos.top, 268);
  assert.ok(pos.maxHeight < 200);
});
test('popup flips above the bottom navigation and scrolls tall Moment menus', () => {
  const pos = computeSwipeMenuPlacement({
    anchor: { left: 18, right: 375, top: 608, bottom: 710 },
    viewport: { left: 0, top: 0, width: 390, height: 800 }, count: 7, bottomReserve: 84,
  });
  assert.equal(pos.direction, 'above');
  assert.ok(pos.top >= 12);
  assert.ok(pos.top + pos.maxHeight <= 704);
  assert.ok(pos.maxHeight <= 244);
});
test('safe positioning on tiny shifted mobile visual viewport with keyboard', () => {
  const viewport = { left: 20, top: 140, width: 280, height: 265 };
  const pos = computeSwipeMenuPlacement({
    anchor: { left: 220, right: 330, top: 245, bottom: 310 },
    viewport, count: 9, bottomReserve: 40,
  });
  assert.ok(pos.width <= 256);
  assert.ok(pos.left >= 32);
  assert.ok(pos.left + pos.width <= 288);
  assert.ok(pos.top >= 152);
  assert.ok(pos.top + pos.maxHeight <= 393 - 40);
});
