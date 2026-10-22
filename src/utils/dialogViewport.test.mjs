import test from 'node:test';
import assert from 'node:assert/strict';
import { getDialogViewportBounds, observeDialogViewport } from './dialogViewport.js';

class EventSurface {
  listeners = new Map();

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) listener({ type });
  }

  get listenerCount() {
    return [...this.listeners.values()].reduce((count, listeners) => count + listeners.size, 0);
  }
}

function browserFixture({ visual = true } = {}) {
  const win = new EventSurface();
  const frames = new Map();
  let frameId = 0;
  Object.assign(win, {
    innerWidth: 390,
    innerHeight: 844,
    document: { documentElement: { clientWidth: 390, clientHeight: 844 } },
    visualViewport: visual ? Object.assign(new EventSurface(), {
      width: 390, height: 844, offsetLeft: 0, offsetTop: 0, scale: 1,
    }) : undefined,
    requestAnimationFrame(callback) {
      const id = ++frameId;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  return {
    win,
    frames,
    flushFrames() {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback();
    },
  };
}

test('a Safari keyboard uses the visible height and positive pan offset without moving outside the page', () => {
  const { win } = browserFixture();
  Object.assign(win.visualViewport, { height: 390, offsetTop: 118 });
  assert.deepEqual(getDialogViewportBounds(win), {
    width: 390, height: 390, left: 0, top: 118, keyboardOpen: true,
  });

  Object.assign(win.visualViewport, { width: 370, offsetLeft: 70, offsetTop: 800 });
  const viewport = getDialogViewportBounds(win);
  assert.equal(viewport.left + viewport.width, win.innerWidth);
  assert.equal(viewport.top + viewport.height, win.innerHeight);
});

test('normal browser chrome changes do not mark a keyboard as open', () => {
  const { win } = browserFixture();
  Object.assign(win.visualViewport, { height: 770, offsetTop: 20 });
  assert.deepEqual(getDialogViewportBounds(win), {
    width: 390, height: 770, left: 0, top: 20, keyboardOpen: false,
  });
});

test('browsers without visualViewport retain layout bounds', () => {
  const { win } = browserFixture({ visual: false });
  assert.deepEqual(getDialogViewportBounds(win), {
    width: 390, height: 844, left: 0, top: 0, keyboardOpen: false,
  });
});

test('invalid layout dimensions fall back to document bounds and remain positive if neither is available', () => {
  const { win } = browserFixture({ visual: false });
  Object.assign(win, { innerWidth: Number.NaN, innerHeight: 0 });
  assert.deepEqual(getDialogViewportBounds(win), {
    width: 390, height: 844, left: 0, top: 0, keyboardOpen: false,
  });
  Object.assign(win.document.documentElement, { clientWidth: -1, clientHeight: Number.POSITIVE_INFINITY });
  assert.deepEqual(getDialogViewportBounds(win), {
    width: 1, height: 1, left: 0, top: 0, keyboardOpen: false,
  });
});

test('invalid visual sizes and offsets cannot produce a misplaced or nonfinite dialog', () => {
  const { win } = browserFixture();
  Object.assign(win.visualViewport, {
    width: Number.NaN, height: -1, offsetLeft: Number.POSITIVE_INFINITY, offsetTop: -40,
  });
  assert.deepEqual(getDialogViewportBounds(win), {
    width: 390, height: 844, left: 0, top: 0, keyboardOpen: false,
  });
  Object.assign(win.visualViewport, { width: 900, height: 1200, offsetLeft: 40, offsetTop: 50 });
  assert.deepEqual(getDialogViewportBounds(win), {
    width: 390, height: 844, left: 0, top: 0, keyboardOpen: false,
  });
});

test('manual pinch zoom keeps the layout size rather than reflowing the sheet into the magnified viewport', () => {
  const { win } = browserFixture();
  for (const scale of [1.25, 2, 0.8]) {
    Object.assign(win.visualViewport, { scale, width: 195, height: 350, offsetLeft: 90, offsetTop: 150 });
    assert.deepEqual(getDialogViewportBounds(win), {
      width: 390, height: 844, left: 0, top: 0, keyboardOpen: false,
    });
    assert.equal(win.visualViewport.scale, scale, 'Reading geometry must not change the user zoom');
  }
});

test('viewport observation reports initial geometry immediately and coalesces keyboard resize and pan events', () => {
  const { win, frames, flushFrames } = browserFixture();
  const updates = [];
  const stop = observeDialogViewport(win, (bounds) => updates.push(bounds));
  assert.equal(updates.length, 1);
  assert.equal(updates[0].height, 844);

  Object.assign(win.visualViewport, { height: 420, offsetTop: 50 });
  win.visualViewport.dispatch('resize');
  Object.assign(win.visualViewport, { height: 360, offsetTop: 100 });
  win.visualViewport.dispatch('scroll');
  win.dispatch('resize');
  assert.equal(updates.length, 1, 'Event bursts wait for one animation frame');
  assert.equal(frames.size, 1);
  flushFrames();
  assert.equal(updates.length, 2);
  assert.deepEqual(updates[1], {
    width: 390, height: 360, left: 0, top: 100, keyboardOpen: true,
  });
  stop();
});

test('orientation changes read fresh layout and visual geometry rather than the initial portrait dimensions', () => {
  const { win, flushFrames } = browserFixture();
  const updates = [];
  const stop = observeDialogViewport(win, (bounds) => updates.push(bounds));
  Object.assign(win, { innerWidth: 844, innerHeight: 390 });
  Object.assign(win.visualViewport, { width: 844, height: 390, offsetTop: 0 });
  win.dispatch('resize');
  flushFrames();
  assert.deepEqual(updates.at(-1), {
    width: 844, height: 390, left: 0, top: 0, keyboardOpen: false,
  });
  stop();
});

test('cleanup removes both window and visual listeners and cancels pending updates', () => {
  const { win, frames, flushFrames } = browserFixture();
  const updates = [];
  const stop = observeDialogViewport(win, (bounds) => updates.push(bounds));
  assert.equal(win.listenerCount, 1);
  assert.equal(win.visualViewport.listenerCount, 2);
  win.visualViewport.dispatch('resize');
  assert.equal(frames.size, 1);
  stop();
  assert.equal(win.listenerCount, 0);
  assert.equal(win.visualViewport.listenerCount, 0);
  assert.equal(frames.size, 0);
  Object.assign(win.visualViewport, { height: 300 });
  win.visualViewport.dispatch('scroll');
  win.dispatch('resize');
  flushFrames();
  assert.equal(updates.length, 1, 'Unmounted dialogs receive no more geometry updates');
});

test('observation still updates and cleans up when visualViewport is unavailable', () => {
  const { win, flushFrames } = browserFixture({ visual: false });
  const updates = [];
  const stop = observeDialogViewport(win, (bounds) => updates.push(bounds));
  Object.assign(win, { innerWidth: 640, innerHeight: 480 });
  win.dispatch('resize');
  flushFrames();
  assert.deepEqual(updates.at(-1), {
    width: 640, height: 480, left: 0, top: 0, keyboardOpen: false,
  });
  stop();
  assert.equal(win.listenerCount, 0);
});
