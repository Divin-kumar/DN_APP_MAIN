import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

const sameDependencies = (left, right) => Array.isArray(left) && Array.isArray(right)
  && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
const children = (value) => Array.isArray(value) ? value.flatMap(children)
  : value && typeof value === 'object' ? [value] : [];

// Render the real component and run its installed document handlers. DOM nodes
// below model containment and DropdownSelect's actual ARIA portal ownership;
// no browser, Firebase, production records or live app state are initialized.
const openControls = async (t, overrides = {}) => {
  const key = `__dnListControls${Date.now()}${Math.random().toString(36).slice(2)}`;
  const slots = [];
  const documentListeners = new Map();
  const windowListeners = new Map();
  const elementsById = new Map();
  const focused = [];
  let cursor = 0, effects = [], stateWrites = 0, tree, dom;
  const install = (registry, type, callback, capture = false) => {
    if (!registry.has(type)) registry.set(type, new Map());
    registry.get(type).set(callback, capture);
  };
  const remove = (registry, type, callback) => registry.get(type)?.delete(callback);
  const document = {
    addEventListener: (...args) => install(documentListeners, ...args),
    removeEventListener: (...args) => remove(documentListeners, ...args),
    getElementById: (id) => elementsById.get(id) || null,
  };
  const window = {
    addEventListener: (...args) => install(windowListeners, ...args),
    removeEventListener: (...args) => remove(windowListeners, ...args),
    matchMedia: () => ({ matches: true }),
  };
  class Element {
    constructor(type, props = {}, parent = null) {
      this.type = type; this.props = props; this.parent = parent;
      this.children = []; this.ownerDocument = document;
      this.scrollLeft = 0; this.clientWidth = 160; this.scrollWidth = 500;
      if (props.id) elementsById.set(props.id, this);
    }
    matches(selector) {
      return selector.startsWith('.') ? String(this.props.className || '').split(/\s+/).includes(selector.slice(1))
        : selector === '[role="listbox"]' ? this.props.role === 'listbox'
          : selector === '[role="dialog"]' ? this.props.role === 'dialog' : false;
    }
    contains(target) { for (let item = target; item; item = item.parent) if (item === this) return true; return false; }
    closest(selector) { for (let item = this; item; item = item.parent) if (selector.split(',').some((part) => item.matches(part.trim()))) return item; return null; }
    querySelector(selector) { return this.children.find((item) => item.matches(selector)) || this.children.map((item) => item.querySelector(selector)).find(Boolean) || null; }
    getAttribute(name) { return this.props[name] ?? null; }
    focus(options) { focused.push({ node: this, options }); }
    scrollBy({ left }) { this.scrollLeft += left; this.props.onScroll?.(); }
  }
  const build = (node, parent = null) => {
    const element = new Element(node.type, node.props, parent);
    if (node.props?.ref) node.props.ref.current = element;
    element.children = children(node.props?.children).map((child) => build(child, element));
    return element;
  };
  const all = (element = dom) => element ? [element, ...element.children.flatMap((child) => all(child))] : [];
  const props = {
    title: 'Synthetic filters', activeCount: 1, resultCount: 3, resultLabel: 'records', summary: 'Selected scope',
    onReset: () => {}, search: { type: 'input', props: { type: 'search', id: 'search' } },
    children: { type: 'div', props: { className: 'dn-list-controls-field', children: { type: 'button', props: { id: 'owned-dropdown', role: 'combobox' } } } },
    sort: { type: 'div', props: { className: 'dn-list-controls-field', children: { type: 'button', props: { className: 'sort-option', id: 'sort-choice' } } } },
    ...overrides,
  };
  const api = {
    state(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => { stateWrites += 1; slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    ref(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
    id() { const index = cursor++; return slots[index] ||= `fixture-list-${index}`; },
    effect(factory, dependencies) {
      const index = cursor++, previous = slots[index];
      if (previous && sameDependencies(previous.dependencies, dependencies)) return;
      slots[index] = { dependencies, cleanup: previous?.cleanup };
      effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = factory(); });
    },
  };
  const globals = new Map(['document', 'window'].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: window });
  globalThis[key] = api;
  const server = await createServer({ configFile: false, envFile: false, esbuild: { jsx: 'automatic' }, ssr: { noExternal: ['react', 'lucide-react'] },
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
    plugins: [{ name: 'isolated-list-controls', enforce: 'pre',
      resolveId(source) {
        if (source === 'react') return '\0list-controls-react';
        if (['react/jsx-runtime', 'react/jsx-dev-runtime'].includes(source)) return '\0list-controls-jsx';
        if (source === 'lucide-react') return '\0list-controls-icons';
        return null;
      },
      load(id) {
        const fixture = `globalThis[${JSON.stringify(key)}]`;
        if (id === '\0list-controls-react') return `export const useState=${fixture}.state,useRef=${fixture}.ref,useId=${fixture}.id,useEffect=${fixture}.effect;`;
        if (id === '\0list-controls-jsx') return 'export const jsx=(type,props)=>({type,props}); export const jsxs=jsx,jsxDEV=jsx;';
        if (id === '\0list-controls-icons') return 'export const ChevronLeft="icon",ChevronRight="icon",SlidersHorizontal="icon",X="icon";';
        return null;
      },
    }],
  });
  const unmount = () => slots.forEach((slot) => { if (typeof slot?.cleanup === 'function') { slot.cleanup(); slot.cleanup = undefined; } });
  t.after(async () => {
    unmount(); await server.close(); delete globalThis[key];
    for (const [name, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  });
  const { default: ListControls } = await server.ssrLoadModule('/src/components/common/ListControls.jsx');
  const render = (updates = {}) => {
    Object.assign(props, updates); cursor = 0; elementsById.clear();
    tree = ListControls(props); dom = build(tree);
    const pending = effects; effects = []; pending.forEach((effect) => effect());
    return dom;
  };
  const find = (className) => all().find((element) => element.matches(`.${className}`));
  const dispatch = (type, target, overrides = {}) => {
    const event = { type, target, defaultPrevented: false, propagationStopped: false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.propagationStopped = true; }, ...overrides };
    for (const listener of documentListeners.get(type)?.keys() || []) listener(event);
    return event;
  };
  const open = () => { find('dn-list-controls-trigger').props.onClick(); render(); return find('dn-list-controls-panel'); };
  const portal = (ownerId) => build({ type: 'div', props: { className: 'dropdown-menu dropdown-menu-portal', children: [
    { type: 'input', props: { type: 'search', id: `${ownerId}-search` } },
    { type: 'div', props: { role: 'listbox', 'aria-labelledby': ownerId, children: { type: 'div', props: { role: 'option', id: `${ownerId}-option` } } } },
  ] } });
  render();
  return { render, find, open, portal, dispatch, documentListeners, windowListeners, focused, unmount,
    createElement: (props = {}) => new Element('button', props), get: (id) => elementsById.get(id), stateWrites: () => stateWrites };
};

test('shared Refine actions lead in one row before filters without moving search/results', async (t) => {
  const harness = await openControls(t);
  assert.equal(harness.find('dn-list-controls-panel'), undefined);
  harness.open();
  const panel = harness.find('dn-list-controls-panel');
  assert.deepEqual(panel.children.map((node) => node.props.className), ['dn-list-controls-action-line', 'dn-list-controls-filters-row']);
  assert.equal(harness.find('dn-list-controls-body').contains(harness.get('owned-dropdown')), true);
  assert.equal(harness.find('dn-list-controls-body').contains(harness.get('sort-choice')), false);
  assert.equal(harness.find('dn-list-controls-action-line').contains(harness.get('sort-choice')), true);
  assert.equal(harness.find('dn-list-controls-action-line').contains(harness.find('dn-list-controls-reset')), true);
  assert.equal(harness.find('dn-list-controls-action-line').children[0].props.className, 'dn-list-controls-sort-row');
  assert.equal(harness.find('dn-list-controls-action-line').children[1].props.className, 'dn-list-controls-reset-row');
  assert.equal(panel.contains(harness.get('search')), false);
  assert.equal(harness.find('dn-list-controls-trigger').props['aria-expanded'], true);
  assert.equal(harness.find('dn-list-controls-trigger').props['aria-label'], 'Filters and sort, 1 active');
  const triggerContent = harness.find('dn-list-controls-trigger').children;
  assert.equal(triggerContent.some((child) => child.props.children === 'Refine'), true,
    'visual label says Refine while Filters and sort remains the accessible name');
  assert.equal(harness.find('dn-list-controls-context').props['aria-live'], 'polite');
});

test('filter-only pages omit the sort row and keep Reset as a lightweight semantic button', async (t) => {
  let resets = 0;
  const harness = await openControls(t, { sort: undefined, onReset: () => { resets += 1; } });
  harness.open();
  assert.equal(harness.find('dn-list-controls-sort-row'), undefined);
  const reset = harness.find('dn-list-controls-reset');
  assert.equal(reset.type, 'button');
  assert.equal(reset.props.children, 'Reset');
  reset.props.onClick(); harness.render();
  assert.equal(resets, 1);
  assert.ok(harness.find('dn-list-controls-panel'), 'reset does not unnecessarily dismiss the panel');
});

test('outside dismissal waits for the resolved click, then preserves its action and focus', async (t) => {
  const harness = await openControls(t);
  harness.open();
  let actions = 0;
  const outside = harness.createElement({ onClick: () => { actions += 1; } });
  harness.dispatch('pointerdown', outside); harness.render();
  assert.ok(harness.find('dn-list-controls-panel'), 'the panel cannot move the target before pointerup');
  harness.dispatch('pointerup', outside); harness.render();
  assert.ok(harness.find('dn-list-controls-panel'));
  const event = harness.dispatch('click', outside);
  harness.render();
  if (!event.defaultPrevented) outside.props.onClick();
  assert.equal(harness.find('dn-list-controls-panel'), undefined);
  assert.equal(event.defaultPrevented, false);
  assert.equal(event.propagationStopped, false);
  assert.equal(actions, 1);
  assert.deepEqual(harness.focused, []);
});

test('own portaled dropdown options and search remain inside until their selection handler executes', async (t) => {
  const harness = await openControls(t);
  harness.open();
  const portal = harness.portal('owned-dropdown');
  for (const target of [harness.get('owned-dropdown'), portal.children[0], portal.children[1].children[0]]) {
    const event = harness.dispatch('click', target);
    harness.render();
    assert.ok(harness.find('dn-list-controls-panel'));
    assert.equal(event.defaultPrevented, false);
  }
  let selected = false;
  portal.children[1].children[0].props.onClick = () => { selected = true; };
  portal.children[1].children[0].props.onClick();
  assert.equal(selected, true, 'the parent never unmounts an owned dropdown before its option click');
});

test('unrelated dropdown portals and the search field outside the panel dismiss filters', async (t) => {
  const harness = await openControls(t);
  harness.open();
  const unrelated = harness.portal('other-dropdown');
  harness.dispatch('click', unrelated.children[1].children[0]); harness.render();
  assert.equal(harness.find('dn-list-controls-panel'), undefined);
  harness.open();
  harness.dispatch('click', harness.get('search')); harness.render();
  assert.equal(harness.find('dn-list-controls-panel'), undefined);
  assert.deepEqual(harness.focused, []);
});

test('click on Filters does not dismiss then reopen the panel before its toggle action', async (t) => {
  const harness = await openControls(t);
  harness.open();
  const trigger = harness.find('dn-list-controls-trigger');
  harness.dispatch('click', trigger);
  trigger.props.onClick(); harness.render();
  assert.equal(harness.find('dn-list-controls-panel'), undefined);
});

test('Escape respects nested dropdown/dialog handling and restores trigger focus only when dismissing', async (t) => {
  const harness = await openControls(t);
  harness.open();
  harness.dispatch('keydown', harness.get('owned-dropdown'), { key: 'Escape', defaultPrevented: true }); harness.render();
  assert.ok(harness.find('dn-list-controls-panel'));
  harness.dispatch('keydown', harness.createElement({ role: 'dialog' }), { key: 'Escape' }); harness.render();
  assert.ok(harness.find('dn-list-controls-panel'));
  harness.dispatch('keydown', harness.get('owned-dropdown'), { key: 'Escape' }); harness.render();
  assert.equal(harness.find('dn-list-controls-panel'), undefined);
  assert.equal(harness.focused.length, 1);
  assert.deepEqual(harness.focused[0].options, { preventScroll: true });
});

test('click/keyboard/resize listeners clean up on close and unmount without stale state changes', async (t) => {
  const harness = await openControls(t);
  for (let cycle = 0; cycle < 3; cycle += 1) {
    harness.open();
    assert.equal(harness.documentListeners.get('click').size, 1);
    assert.deepEqual([...harness.documentListeners.get('click').values()], [true], 'outside detection captures the resolved click without consuming native events');
    assert.equal(harness.documentListeners.get('keydown').size, 1);
    assert.equal(harness.windowListeners.get('resize').size, 1);
    harness.dispatch('click', harness.createElement()); harness.render();
    assert.equal(harness.documentListeners.get('click').size, 0);
    assert.equal(harness.documentListeners.get('keydown').size, 0);
    assert.equal(harness.windowListeners.get('resize').size, 0);
  }
  harness.open(); harness.unmount();
  const writes = harness.stateWrites();
  harness.dispatch('click', harness.createElement());
  harness.dispatch('keydown', harness.createElement(), { key: 'Escape' });
  assert.equal(harness.stateWrites(), writes);
  assert.equal(harness.documentListeners.get('click').size, 0);
});
