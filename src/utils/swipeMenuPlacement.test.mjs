import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSwipeMenuPlacement, getSwipeDockReserve } from './swipeMenuPlacement.js';

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


test('measured iPhone dock clearance accounts for Home Indicator insets', () => {
  const viewport = { left: 0, top: 0, width: 390, height: 844 };
  const dock = { left: 10, top: 745, right: 380, bottom: 810, width: 370, height: 65 };
  const reserve = getSwipeDockReserve({ viewport, dockRect: dock });
  assert.equal(reserve, 107);
  const pos = computeSwipeMenuPlacement({
    anchor: { left: 14, right: 376, top: 650, bottom: 735 },
    viewport, count: 5, bottomReserve: reserve,
  });
  assert.ok(pos.top + pos.maxHeight <= dock.top - 12 - 8);
  assert.equal(pos.direction, 'above');
});

test('keyboard and desktop without a visible dock reserve no phantom bottom space', () => {
  const viewport = { left: 0, top: 80, width: 390, height: 340 };
  const dock = { top: 745, bottom: 810, width: 370, height: 65 };
  assert.equal(getSwipeDockReserve({ viewport, dockRect: dock }), 0);
  assert.equal(getSwipeDockReserve({ viewport, dockRect: dock, dockVisible: false }), 0);
  assert.equal(getSwipeDockReserve({ viewport, dockRect: null }), 0);
});

test('dock clearance follows visual viewport offsets during browser panning', () => {
  const viewport = { left: 12, top: 60, width: 300, height: 520 };
  const dock = { top: 505, bottom: 565, width: 280, height: 60 };
  assert.equal(getSwipeDockReserve({ viewport, dockRect: dock }), 83);
});
