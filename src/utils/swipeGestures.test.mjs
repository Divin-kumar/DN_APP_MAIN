import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSwipeGesture, resolveDirectionalSwipe } from './swipeGestures.js';

const start = { x: 150, y: 150 };
test('vertical scroll cannot accidentally open an action tray', () => {
  const vertical = resolveSwipeGesture(start, { x: 140, y: 184 });
  assert.equal(vertical.axis, 'vertical');
  assert.equal(resolveSwipeGesture(start, { x: 80, y: 190 }, vertical.axis).action, null);
});
test('short, diagonal and tap movements do not reveal actions', () => {
  assert.equal(resolveSwipeGesture(start, { x: 125, y: 154 }).action, null);
  assert.equal(resolveSwipeGesture(start, { x: 110, y: 117 }).action, null);
  assert.equal(resolveSwipeGesture(start, { x: 151, y: 150 }).action, null);
});
test('left opens contextual actions and right opens Delete at 44px', () => {
  assert.equal(resolveSwipeGesture(start, { x: 105, y: 151 }).action, 'other');
  assert.equal(resolveSwipeGesture(start, { x: 195, y: 151 }).action, 'delete');
  assert.equal(resolveSwipeGesture(start, { x: 110, y: 151 }).action, null);
  assert.equal(resolveSwipeGesture(start, { x: 190, y: 151 }).action, null);
});
test('legacy drag adapter also never executes delete by itself', () => {
  assert.equal(resolveDirectionalSwipe({ offsetX: -44 }), 'other');
  assert.equal(resolveDirectionalSwipe({ offsetX: 44 }), 'delete');
  assert.equal(resolveDirectionalSwipe({ offsetX: 23, velocityX: 2000 }), null);
  assert.equal(resolveDirectionalSwipe({ wasOpen: 'delete', offsetX: -33 }), null);
});

test('both directions are accepted as a menu-opening intent at the same threshold', () => {
  for (const destination of [{ x: 104, y: 150 }, { x: 196, y: 150 }]) {
    assert.ok(resolveSwipeGesture(start, destination).action);
  }
  for (const destination of [{ x: 133, y: 150 }, { x: 167, y: 150 }, { x: 202, y: 208 }]) {
    assert.equal(resolveSwipeGesture(start, destination).action, null);
  }
});
