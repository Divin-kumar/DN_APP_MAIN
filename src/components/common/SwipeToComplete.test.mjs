import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

// Browser event bus shared by the real gesture handlers in this process.
globalThis.window = new EventTarget();

const same = (first, second) => Array.isArray(first) && Array.isArray(second)
  && first.length === second.length && first.every((value, index) => Object.is(value, second[index]));
const settle = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const guardedEvent = (extra = {}) => {
  const event = { prevented: false, stopped: false, preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; }, ...extra };
  return event;
};

// Invoke the actual component handlers through isolated React hooks and a width
// fixture. No event recognizer is reimplemented here. Native touch dispatch,
// scrolling, pointer capture release and mobile browser behaviour need UI QA.
const openCard = async (t, { width = 320, onComplete, disabled = false, unavailable = false } = {}) => {
  const key = `__dnSwipeComplete${Date.now()}${Math.random().toString(36).slice(2)}`;
  const slots = [];
  const effects = [];
  const captures = [];
  const calls = [];
  const writesAfterUnmount = [];
  let cursor = 0;
  let tree;
  let unmounted = false;
  const fixture = {
    state(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (next) => {
        if (unmounted) writesAfterUnmount.push(index);
        slots[index] = typeof next === 'function' ? next(slots[index]) : next;
      }];
    },
    ref(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    effect(factory, dependencies) {
      const index = cursor++;
      if (slots[index] && same(slots[index].dependencies, dependencies)) return;
      const previous = slots[index];
      slots[index] = { dependencies, cleanup: previous?.cleanup };
      effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = factory(); });
    },
  };
  globalThis[key] = fixture;
  const server = await createServer({ configFile: false, envFile: false,
    esbuild: { jsx: 'automatic' }, ssr: { noExternal: ['react', 'lucide-react'] },
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
    plugins: [{ name: 'isolated-swipe-completion', enforce: 'pre',
      resolveId(source, importer) {
        if (!importer?.replaceAll('\\', '/').endsWith('/src/components/common/SwipeToComplete.jsx')) return null;
        if (source === 'react') return '\0swipe-completion-react';
        if (['react/jsx-runtime', 'react/jsx-dev-runtime'].includes(source)) return '\0swipe-completion-jsx';
        if (source === 'lucide-react') return '\0swipe-completion-icons';
        if (source.endsWith('.css')) return '\0swipe-completion-css';
        return null;
      },
      load(id) {
        const api = `globalThis[${JSON.stringify(key)}]`;
        if (id === '\0swipe-completion-react') return `export const useState=${api}.state,useRef=${api}.ref,useEffect=${api}.effect;`;
        if (id === '\0swipe-completion-jsx') return 'export const jsx=(type,props)=>({type,props});export const jsxs=jsx,jsxDEV=jsx;';
        if (id === '\0swipe-completion-icons') return 'export const Check="check-icon";';
        if (id === '\0swipe-completion-css') return '';
        return null;
      },
    }],
  });
  const { default: Card } = await server.ssrLoadModule('/src/components/common/SwipeToComplete.jsx');
  const props = { children: { type: 'button', props: { children: 'Edit synthetic activity' } }, label: 'Synthetic activity', disabled,
    onComplete: unavailable ? undefined : () => { calls.push('complete'); return onComplete?.(); } };
  const unmount = () => {
    for (const slot of slots) if (slot?.cleanup) { slot.cleanup(); slot.cleanup = undefined; }
    unmounted = true;
  };
  t.after(async () => { unmount(); await server.close(); delete globalThis[key]; });
  const target = { getBoundingClientRect: () => ({ width }), hasPointerCapture: () => false,
    setPointerCapture: (pointerId) => captures.push(pointerId) };
  const render = (changes = {}) => {
    Object.assign(props, changes);
    cursor = 0;
    tree = Card(props);
    tree.props.ref.current = target;
    for (const effect of effects.splice(0)) effect();
    return tree;
  };
  const pointer = (x, y, pointerId = 7, extra = {}) => ({ clientX: x, clientY: y, pointerId, pointerType: 'mouse',
    button: 0, isPrimary: true, currentTarget: target, ...extra });
  const touch = (x, y, identifier = 5) => ({ clientX: x, clientY: y, identifier });
  const event = (method, payload) => tree.props[method](payload);
  render();
  return { render, calls, captures, writesAfterUnmount, unmount, pointer, touch,
    handlers: () => tree.props, tree: () => tree,
    transform: () => tree.props.children[1].props.style.transform,
    key(extra = {}) { const payload = guardedEvent({ key: 'Enter', ctrlKey: false, metaKey: false, ...extra }); event('onKeyDownCapture', payload); return payload; },
    click(detail = 1) { const payload = guardedEvent({ detail }); event('onClickCapture', payload); return payload; },
    down: (x, y = 100, id = 7, extra) => event('onPointerDownCapture', pointer(x, y, id, extra)),
    move: (x, y = 100, id = 7, extra) => event('onPointerMoveCapture', pointer(x, y, id, extra)),
    up: (x, y = 100, id = 7, extra) => event('onPointerUpCapture', pointer(x, y, id, extra)),
    pointerCancel: (id = 7) => event('onPointerCancelCapture', pointer(0, 0, id)),
    touchStart: (touches) => event('onTouchStartCapture', { touches }),
    touchMove: (touches) => event('onTouchMoveCapture', { touches }),
    touchEnd: (changedTouches) => event('onTouchEndCapture', { changedTouches }),
    touchCancel: () => event('onTouchCancelCapture', {}),
  };
};

test('ordinary pointer and touch taps keep the opening click and never capture or complete', async (t) => {
  const card = await openCard(t);
  card.down(100); card.move(106, 104); card.up(106, 104);
  assert.equal(card.click().prevented, false);
  card.touchStart([card.touch(100, 100)]);
  card.touchEnd([card.touch(102, 101)]);
  assert.equal(card.click().prevented, false);
  assert.deepEqual(card.calls, []);
  assert.deepEqual(card.captures, []);
  card.render();
  assert.equal(card.transform(), 'translateX(0px)');
});

test('deliberate left and right drags complete once and consume the trailing opening click', async (t) => {
  for (const direction of [-1, 1]) {
    const pending = deferred();
    const card = await openCard(t, { onComplete: () => pending.promise });
    card.down(150); card.move(150 + direction * 100, 104); card.render();
    assert.match(card.tree().props.className, /is-dragging/);
    assert.match(card.tree().props.className, /is-ready/);
    card.up(150 + direction * 100, 104);
    card.up(150 + direction * 100, 104);
    assert.equal(card.calls.length, 1);
    assert.deepEqual(card.captures, [7]);
    const click = card.click();
    assert.equal(click.prevented, true);
    assert.equal(click.stopped, true);
    card.render();
    assert.equal(card.tree().props['aria-busy'], true);
    pending.resolve(); await settle(); card.render();
    assert.equal(card.tree().props['aria-busy'], false);
    assert.equal(card.transform(), 'translateX(0px)');
  }
});

test('completion distance adapts to row width while staying within 72 and 120 pixels', async (t) => {
  for (const [width, below, threshold] of [[200, 71, 72], [350, 97, 98], [900, 119, 120]]) {
    const card = await openCard(t, { width });
    card.down(100); card.move(100 + below); card.up(100 + below);
    assert.equal(card.calls.length, 0, `${width}px row: short drag must not complete`);
    card.down(100); card.move(100 + threshold); card.up(100 + threshold);
    assert.equal(card.calls.length, 1, `${width}px row: deliberate drag completes at the bounded threshold`);
    await settle();
  }
});

test('vertical scrolling, diagonal motion, short drags and returning near the start never complete', async (t) => {
  const card = await openCard(t);
  for (const [middle, end] of [
    [[104, 150], [105, 240]], [[180, 180], [220, 220]],
    [[135, 103], [140, 104]], [[210, 100], [105, 100]],
    [[210, 100], [210, 240]],
  ]) {
    card.down(100, 100); card.move(...middle); card.up(...end); card.render();
    assert.equal(card.calls.length, 0);
    assert.equal(card.transform(), 'translateX(0px)');
    assert.equal(card.click().prevented, true, 'a moved gesture must not open the edit dialog');
  }
});

test('touch swipes complete once and ignore synthetic touch-pointer duplicates', async (t) => {
  const card = await openCard(t);
  card.down(100, 100, 5, { pointerType: 'touch' });
  card.touchStart([card.touch(100, 100)]);
  card.move(210, 100, 5, { pointerType: 'touch' });
  card.touchMove([card.touch(210, 100)]);
  card.up(210, 100, 5, { pointerType: 'touch' });
  card.touchEnd([card.touch(210, 100)]);
  card.touchEnd([card.touch(210, 100)]);
  assert.equal(card.calls.length, 1);
  assert.deepEqual(card.captures, []);
  assert.equal(card.click().prevented, true);
  await settle();
});

test('touch cancellation, multitouch and an unmatched touch ending cannot complete the activity', async (t) => {
  const card = await openCard(t);
  card.touchStart([card.touch(100, 100)]);
  card.touchMove([card.touch(220, 100)]);
  card.touchCancel(); card.touchEnd([card.touch(220, 100)]); card.render();
  assert.equal(card.calls.length, 0);
  assert.equal(card.transform(), 'translateX(0px)');
  card.touchStart([card.touch(100, 100)]);
  card.touchMove([card.touch(220, 100), card.touch(230, 105, 6)]);
  card.touchEnd([card.touch(220, 100)]);
  assert.equal(card.calls.length, 0);
  card.touchStart([card.touch(100, 100), card.touch(105, 100, 6)]);
  card.touchMove([card.touch(220, 100)]); card.touchEnd([card.touch(220, 100)]);
  assert.equal(card.calls.length, 0);
  card.touchStart([card.touch(100, 100)]); card.touchMove([card.touch(220, 100)]);
  card.touchEnd([card.touch(220, 100, 6)]);
  assert.equal(card.calls.length, 0);
  card.touchEnd([card.touch(220, 100)]);
  assert.equal(card.calls.length, 1, 'the original touch still owns its deliberate gesture');
  await settle();
});

test('pointer cancellation resets the drag and mismatched pointer events preserve its owner', async (t) => {
  const card = await openCard(t);
  card.down(100); card.move(220); card.pointerCancel(); card.up(220); card.render();
  assert.equal(card.calls.length, 0);
  assert.equal(card.transform(), 'translateX(0px)');
  card.down(100); card.move(220); card.move(230, 100, 8); card.up(230, 100, 8); card.pointerCancel(8);
  assert.equal(card.calls.length, 0);
  card.up(220);
  assert.equal(card.calls.length, 1);
  await settle();
});

test('right-click and nonprimary pointer presses never start a completion gesture', async (t) => {
  const card = await openCard(t);
  for (const extra of [{ button: 2 }, { isPrimary: false }]) {
    card.down(100, 100, 7, extra); card.move(230); card.up(230);
  }
  assert.equal(card.calls.length, 0);
  assert.deepEqual(card.captures, []);
});

test('pending saves reject repeated swipes and shortcuts; rejection releases the guard for retry', async (t) => {
  const pending = deferred();
  const card = await openCard(t, { onComplete: () => pending.promise });
  card.down(100); card.move(220); card.up(220);
  card.key({ ctrlKey: true });
  card.down(100); card.move(230); card.up(230);
  assert.equal(card.calls.length, 1);
  assert.equal(card.click().prevented, true);
  pending.reject(new Error('Synthetic save failed')); await settle(); card.render();
  assert.equal(card.tree().props['aria-busy'], false);
  assert.equal(card.transform(), 'translateX(0px)');
  card.key({ metaKey: true });
  assert.equal(card.calls.length, 2);
  await settle();
});

test('synchronously thrown persistence errors are handled and allow another attempt', async (t) => {
  let attempt = 0;
  const card = await openCard(t, { onComplete: () => { if (attempt++ === 0) throw new Error('Synthetic throw'); } });
  card.key({ ctrlKey: true }); await settle(); card.render();
  assert.equal(card.tree().props['aria-busy'], false);
  card.key({ ctrlKey: true });
  assert.equal(card.calls.length, 2);
  await settle();
});

test('Control and Command Enter complete; ordinary Enter and Space retain ordinary record activation', async (t) => {
  const card = await openCard(t);
  assert.equal(card.key().prevented, false);
  assert.equal(card.key({ key: ' ' }).prevented, false);
  assert.equal(card.calls.length, 0);
  assert.equal(card.click(0).prevented, false);
  const control = card.key({ ctrlKey: true });
  assert.equal(control.prevented, true); assert.equal(control.stopped, true);
  assert.equal(card.calls.length, 1);
  await settle(); card.render();
  const command = card.key({ metaKey: true });
  assert.equal(command.prevented, true); assert.equal(command.stopped, true);
  assert.equal(card.calls.length, 2);
  await settle();
  card.down(100); card.move(135); card.up(135);
  card.key();
  assert.equal(card.click().prevented, false, 'keyboard activation should clear a prior pointer suppression');
});

test('disabled, missing callbacks and disabling during a drag prevent completion', async (t) => {
  const card = await openCard(t, { disabled: true });
  card.down(100); card.move(240); card.up(240); card.key({ ctrlKey: true });
  assert.equal(card.calls.length, 0);
  card.render({ disabled: false });
  card.down(100); card.move(240); card.render({ disabled: true }); card.up(240); card.render();
  assert.equal(card.calls.length, 0);
  assert.equal(card.transform(), 'translateX(0px)');
  const noHandler = await openCard(t, { unavailable: true });
  noHandler.down(100); noHandler.move(240); noHandler.up(240); noHandler.key({ metaKey: true });
  assert.equal(noHandler.calls.length, 0);
});

test('unmount ignores stale completion handlers and pending settlements never write component state', async (t) => {
  const card = await openCard(t);
  const handlers = card.handlers();
  card.unmount();
  handlers.onKeyDownCapture(guardedEvent({ key: 'Enter', ctrlKey: true }));
  assert.equal(card.calls.length, 0);
  assert.deepEqual(card.writesAfterUnmount, []);
  const pending = deferred();
  const savingCard = await openCard(t, { onComplete: () => pending.promise });
  savingCard.key({ ctrlKey: true });
  savingCard.unmount();
  pending.resolve(); await settle();
  assert.equal(savingCard.calls.length, 1);
  assert.deepEqual(savingCard.writesAfterUnmount, []);
});

test('left state swipes consider velocity without allowing short, slow or opposite-direction movements', async (t) => {
  const card = await openCard(t, { width: 350 });
  card.render({ direction: 'left', actionLabel: 'Reopen', actionIcon: 'reopen-icon' });
  assert.match(card.tree().props['aria-label'], /Swipe left to reopen/);
  let now = 10000;
  t.mock.method(Date, 'now', () => now);
  for (const [distance, duration] of [[30, 30], [60, 300], [-60, 60]]) {
    card.down(200); now += duration; card.move(200 - distance); card.up(200 - distance);
    assert.equal(card.calls.length, 0);
    now += 1000;
  }
  card.down(200); now += 60; card.move(140); card.up(140);
  assert.equal(card.calls.length, 1, 'a deliberate 60px left swipe commits at sufficient velocity');
  assert.equal(card.click().prevented, true);
  await settle(); card.render();
  assert.equal(card.transform(), 'translateX(0px)');
});
