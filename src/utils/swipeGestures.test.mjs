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
