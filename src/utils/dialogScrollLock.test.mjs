import test from 'node:test';
import assert from 'node:assert/strict';
import { lockDialogScroll } from './dialogScrollLock.js';

class InlineStyle {
  properties = new Map();

  getPropertyValue(property) { return this.properties.get(property)?.value || ''; }
  getPropertyPriority(property) { return this.properties.get(property)?.priority || ''; }
  setProperty(property, value, priority = '') { this.properties.set(property, { value, priority }); }
  removeProperty(property) {
    const value = this.getPropertyValue(property);
    this.properties.delete(property);
    return value;
  }
}

function browserFixture({ left = 0, top = 0, classes = [] } = {}) {
  const classNames = new Set(classes);
  const body = {
    style: new InlineStyle(),
    classList: {
      add: (name) => classNames.add(name),
      remove: (name) => classNames.delete(name),
      contains: (name) => classNames.has(name),
    },
  };
  const root = { style: new InlineStyle() };
  const scrollCalls = [];
  const win = {
    document: { body, documentElement: root },
    scrollX: left,
    scrollY: top,
    scrollTo(options) { scrollCalls.push(options); },
  };
  return { win, body, root, scrollCalls };
}

const snapshot = (style) => [...style.properties].sort(([a], [b]) => a.localeCompare(b));

test('locks page scrolling without losing existing inline values or priorities', () => {
  const { win, body, root, scrollCalls } = browserFixture({ left: 18.5, top: 243.25 });
  for (const [property, value, priority = ''] of [
    ['position', 'relative', 'important'], ['top', '3px'], ['left', '4%'],
    ['right', '12px', 'important'], ['width', 'calc(100% - 8px)'],
    ['overflow', 'auto', 'important'], ['color', 'red'],
  ]) body.style.setProperty(property, value, priority);
  root.style.setProperty('overflow', 'scroll', 'important');
  root.style.setProperty('overscroll-behavior', 'contain');
  const originalBody = snapshot(body.style);
  const originalRoot = snapshot(root.style);

  const release = lockDialogScroll(win);
  assert.equal(body.style.getPropertyValue('position'), 'fixed');
  assert.equal(body.style.getPropertyValue('top'), '-243.25px');
  assert.equal(body.style.getPropertyValue('left'), '-18.5px');
  assert.equal(body.style.getPropertyValue('right'), 'auto');
  assert.equal(body.style.getPropertyValue('width'), '100%');
  assert.equal(body.style.getPropertyValue('overflow'), 'hidden');
  assert.equal(body.style.getPropertyPriority('position'), 'important');
  assert.equal(root.style.getPropertyValue('overflow'), 'hidden');
  assert.equal(root.style.getPropertyValue('overscroll-behavior'), 'none');
  assert.equal(body.classList.contains('dn-modal-open'), true);
  assert.deepEqual(scrollCalls, []);

  release();
  assert.deepEqual(snapshot(body.style), originalBody);
  assert.deepEqual(snapshot(root.style), originalRoot);
  assert.equal(body.classList.contains('dn-modal-open'), false);
  assert.deepEqual(scrollCalls, [{ left: 18.5, top: 243.25, behavior: 'instant' }]);
});

test('the final release restores styles before restoring the original page scroll', () => {
  const { win, body, root } = browserFixture({ left: -12, top: 530 });
  body.style.setProperty('position', 'relative');
  const calls = [];
  win.scrollTo = (options) => {
    assert.equal(body.style.getPropertyValue('position'), 'relative');
    assert.equal(body.style.getPropertyValue('top'), '');
    assert.equal(root.style.getPropertyValue('overflow'), '');
    assert.equal(body.classList.contains('dn-modal-open'), false);
    calls.push(options);
  };
  const release = lockDialogScroll(win);
  assert.equal(body.style.getPropertyValue('left'), '12px');
  win.scrollX = 0;
  win.scrollY = 0;
  release();
  assert.deepEqual(calls, [{ left: -12, top: 530, behavior: 'instant' }]);
});

test('nested dialogs retain the first snapshot until the last release', () => {
  const { win, body, root, scrollCalls } = browserFixture({ top: 320 });
  const releaseOuter = lockDialogScroll(win);
  win.scrollY = 0;
  const releaseInner = lockDialogScroll(win);
  releaseInner();
  assert.equal(body.style.getPropertyValue('position'), 'fixed');
  assert.equal(body.style.getPropertyValue('top'), '-320px');
  assert.equal(root.style.getPropertyValue('overflow'), 'hidden');
  assert.equal(body.classList.contains('dn-modal-open'), true);
  assert.deepEqual(scrollCalls, []);

  releaseOuter();
  assert.deepEqual(snapshot(body.style), []);
  assert.deepEqual(snapshot(root.style), []);
  assert.deepEqual(scrollCalls, [{ left: 0, top: 320, behavior: 'instant' }]);
});

test('out-of-order and repeated releases cannot unlock an active nested dialog', () => {
  const { win, body, scrollCalls } = browserFixture({ top: 180 });
  const releaseOuter = lockDialogScroll(win);
  const releaseInner = lockDialogScroll(win);
  releaseOuter();
  releaseOuter();
  assert.equal(body.style.getPropertyValue('position'), 'fixed');
  assert.equal(body.classList.contains('dn-modal-open'), true);
  assert.deepEqual(scrollCalls, []);
  releaseInner();
  releaseInner();
  assert.equal(body.style.getPropertyValue('position'), '');
  assert.equal(scrollCalls.length, 1);

  win.scrollY = 70;
  const releaseNext = lockDialogScroll(win);
  releaseInner();
  assert.equal(body.style.getPropertyValue('top'), '-70px');
  releaseNext();
  assert.deepEqual(scrollCalls.at(-1), { left: 0, top: 70, behavior: 'instant' });
});

test('keeps a pre-existing modal class and unrelated changes made while locked', () => {
  const { win, body, root } = browserFixture({ classes: ['dn-modal-open', 'theme-ready'] });
  const release = lockDialogScroll(win);
  body.style.setProperty('background', 'blue');
  root.style.setProperty('color', 'white');
  body.classList.add('other-dialog-state');
  release();
  assert.equal(body.classList.contains('dn-modal-open'), true);
  assert.equal(body.classList.contains('theme-ready'), true);
  assert.equal(body.classList.contains('other-dialog-state'), true);
  assert.equal(body.style.getPropertyValue('background'), 'blue');
  assert.equal(root.style.getPropertyValue('color'), 'white');
});

test('locks different documents independently', () => {
  const first = browserFixture({ top: 100 });
  const second = browserFixture({ top: 200 });
  const releaseFirst = lockDialogScroll(first.win);
  const releaseSecond = lockDialogScroll(second.win);
  releaseFirst();
  assert.equal(first.body.style.getPropertyValue('position'), '');
  assert.equal(second.body.style.getPropertyValue('position'), 'fixed');
  assert.deepEqual(second.scrollCalls, []);
  releaseSecond();
  assert.deepEqual(first.scrollCalls, [{ left: 0, top: 100, behavior: 'instant' }]);
  assert.deepEqual(second.scrollCalls, [{ left: 0, top: 200, behavior: 'instant' }]);
});
