import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSwipeGesture, resolveDirectionalSwipe } from './swipeGestures.js';
const start = { x: 150, y: 150 };
test('vertical scrolling prevents accidental swipe', () => {
  const a = resolveSwipeGesture(start, { x:140, y:184 });
  assert.equal(a.axis,'vertical');
  assert.equal(resolveSwipeGesture(start,{x:80,y:190},a.axis).action,null);
});
test('only sufficiently deliberate horizontal motion reveals actions', () => {
  assert.equal(resolveSwipeGesture(start,{x:117,y:154}).action,null);
  assert.equal(resolveSwipeGesture(start,{x:112,y:114}).action,null);
  assert.equal(resolveDirectionalSwipe({offsetX:23,velocityX:1700}),null);
});
test('left is other and right is delete', () => {
  assert.equal(resolveSwipeGesture(start,{x:85,y:152}).action,'other');
  assert.equal(resolveSwipeGesture(start,{x:216,y:153}).action,'delete');
  assert.equal(resolveDirectionalSwipe({offsetX:-56}),'other');
  assert.equal(resolveDirectionalSwipe({offsetX:56}),'delete');
  assert.equal(resolveDirectionalSwipe({offsetX:24,velocityX:700}),'delete');
});
test('opposite drag dismisses open tray without deleting', () => {
  assert.equal(resolveDirectionalSwipe({wasOpen:'other',offsetX:40}),null);
  assert.equal(resolveDirectionalSwipe({wasOpen:'delete',offsetX:-40}),null);
});
