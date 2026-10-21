import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSwipeGesture } from './swipeGestures.js';

const start = { x: 150, y: 150 };
test('vertical scroll locks out accidental swipe action', () => {
  const vertical = resolveSwipeGesture(start, { x: 140, y: 184 });
  assert.equal(vertical.axis, 'vertical');
  assert.equal(resolveSwipeGesture(start, { x: 80, y: 190 }, vertical.axis).action, null);
});
test('small horizontal motion does not reveal destructive actions', () => {
  const result = resolveSwipeGesture(start, { x: 117, y: 154 });
  assert.equal(result.axis, 'horizontal');
  assert.equal(result.action, null);
  assert.equal(result.moved, true);
});
test('horizontal thresholds reveal existing directions consistently', () => {
  assert.equal(resolveSwipeGesture(start, { x: 85, y: 152 }).action, 'other');
  assert.equal(resolveSwipeGesture(start, { x: 216, y: 153 }).action, 'delete');
});
test('diagonal motion without dominant horizontal axis is not a swipe', () => {
  const result = resolveSwipeGesture(start, { x: 112, y: 114 });
  assert.equal(result.action, null);
});

import { resolveTransactionSwipe } from './swipeGestures.js';
test('finance swipe only reveals after deliberate left displacement', () => {
  assert.equal(resolveTransactionSwipe({ offsetX: -12, velocityX: -1600 }), false);
  assert.equal(resolveTransactionSwipe({ offsetX: -23, velocityX: -900 }), false);
  assert.equal(resolveTransactionSwipe({ offsetX: -56, velocityX: 0 }), true);
  assert.equal(resolveTransactionSwipe({ offsetX: -25, velocityX: -700 }), true);
  assert.equal(resolveTransactionSwipe({ offsetX: -40, velocityX: -100 }), false);
});
test('right swipe dismisses revealed actions without triggering delete', () => {
  assert.equal(resolveTransactionSwipe({ wasOpen: true, offsetX: 39, velocityX: 0 }), true);
  assert.equal(resolveTransactionSwipe({ wasOpen: true, offsetX: 40, velocityX: 0 }), false);
  assert.equal(resolveTransactionSwipe({ wasOpen: true, offsetX: 24, velocityX: 650 }), false);
  assert.equal(resolveTransactionSwipe({ wasOpen: true, offsetX: 2, velocityX: 0 }), true);
});
