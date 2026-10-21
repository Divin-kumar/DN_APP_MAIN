import test from 'node:test';
import assert from 'node:assert/strict';
import { computeOverlayPlacement } from './overlayPosition.js';

const viewport = { left: 0, top: 0, width: 390, height: 800 };

test('overlay opens below with sufficient space and matches trigger width', () => {
  const result = computeOverlayPlacement({ anchor: { left: 12, top: 100, bottom: 148, width: 180 }, viewport, preferredHeight: 280 });
  assert.equal(result.direction, 'below');
  assert.equal(result.left, 12);
  assert.equal(result.width, 180);
  assert.equal(result.maxHeight, 280);
});
test('overlay flips above bottom navigation when needed', () => {
  const result = computeOverlayPlacement({ anchor: { left: 220, top: 620, bottom: 668, width: 240 }, viewport, preferredHeight: 320, bottomObstruction: 738 });
  assert.equal(result.direction, 'above');
  assert.equal(result.maxHeight, 320);
  assert.ok(result.left + result.width <= 382);
});
test('overlay scroll region stays within small visual viewport and keyboard', () => {
  const result = computeOverlayPlacement({ anchor: { left: 0, top: 210, bottom: 260, width: 480 }, viewport: { left: 0, top: 90, width: 310, height: 280 }, preferredHeight: 450 });
  assert.ok(result.maxHeight <= 112);
  assert.ok(result.top >= 98);
  assert.ok(result.left >= 8);
  assert.ok(result.left + result.width <= 302);
});
test('overlay accounts for shifted visual viewport', () => {
  const result = computeOverlayPlacement({ anchor: { left: 5, top: 310, bottom: 356, width: 160 }, viewport: { left: 40, top: 200, width: 300, height: 250 }, preferredHeight: 180 });
  assert.ok(result.left >= 48);
  assert.ok(result.top >= 208);
  assert.ok(result.top + result.maxHeight <= 442);
});
