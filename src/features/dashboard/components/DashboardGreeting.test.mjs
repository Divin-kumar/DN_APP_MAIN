import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

const nodes = (node) => Array.isArray(node) ? node.flatMap(nodes)
  : node && typeof node === 'object' ? [node, ...nodes(node.props?.children ?? [])] : [];
const textOf = (node) => Array.isArray(node) ? node.map(textOf).join('')
  : node && typeof node === 'object' ? textOf(node.props?.children ?? []) : String(node ?? '');

async function openGreeting(t) {
  const key = `__dnGreeting${Date.now()}${Math.random().toString(36).slice(2)}`;
  const state = { app: { user: { uid: 'owner', displayName: 'Kumar Divin' }, isGuest: false } };
  globalThis[key] = state;
  const server = await createServer({ configFile: false, envFile: false, esbuild: { jsx: 'automatic' },
    ssr: { noExternal: ['react', 'lucide-react'] },
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
    plugins: [{ name: 'isolated-dashboard-greeting', enforce: 'pre', resolveId(source) {
      if (source === 'react/jsx-runtime' || source === 'react/jsx-dev-runtime') return '\0greeting-jsx';
      if (source === 'lucide-react') return '\0greeting-icons';
      if (source.endsWith('/store/useAppStore')) return '\0greeting-app';
      if (/\/store\/use(?:Income|Expense|Event)Store$/.test(source)) throw new Error('The greeting must not read or load business data.');
      return null;
    }, load(id) {
      if (id === '\0greeting-jsx') return 'export const jsx=(type,props)=>({type,props}); export const jsxs=jsx,jsxDEV=jsx,Fragment="fragment";';
      if (id === '\0greeting-icons') return 'export const Sunrise="sunrise", Sun="sun", Moon="moon";';
      if (id === '\0greeting-app') return `export default (select)=>select(globalThis[${JSON.stringify(key)}].app);`;
      return null;
    } }],
  });
  t.after(async () => { await server.close(); delete globalThis[key]; });
  const { default: Greeting } = await server.ssrLoadModule('/src/features/dashboard/components/DashboardGreeting.jsx');
  const props = { now: new Date(2026, 9, 26, 9) };
  const render = () => Greeting(props);
  const salutation = () => textOf(nodes(render()).find((node) => node.type === 'h2'));
  return { state, props, render, salutation };
}

test('Dashboard greeting shows a four-line welcome, local date and personal name without business metrics', async (t) => {
  const h = await openGreeting(t), tree = h.render();
  assert.equal(tree.props['aria-label'], 'Dashboard greeting');
  assert.equal(h.salutation(), 'Good morning, Kumar');
  const time = nodes(tree).find((node) => node.type === 'time');
  assert.equal(time.props.dateTime, '2026-10-26');
  assert.equal(textOf(time), 'Monday, 26 October 2026');
  assert.equal(textOf(nodes(tree).find((node) => node.props?.className === 'dashboard-greeting-eyebrow')), 'Your day');
  assert.equal(textOf(nodes(tree).find((node) => node.props?.className === 'dashboard-greeting-emoji')), '☀️');
  assert.deepEqual(nodes(tree).filter((node) => node.type === 'p').map(textOf),
    ['A fresh day, a few good moments ahead.', 'Your plans and memories are right here.']);
  assert.doesNotMatch(textOf(tree), /activit|spent|balance|pending|completed|summary|retry/i);
  assert.equal(nodes(tree).filter((node) => ['button', 'section'].includes(node.type)).length, 0);
});

test('greeting and emoji change together at local morning, afternoon and evening boundaries', async (t) => {
  const h = await openGreeting(t);
  for (const [hour, expected, emoji] of [[0, 'Good morning', '☀️'], [11, 'Good morning', '☀️'],
    [12, 'Good afternoon', '🌤️'], [17, 'Good afternoon', '🌤️'],
    [18, 'Good evening', '🌙'], [23, 'Good evening', '🌙']]) {
    h.props.now = new Date(2026, 9, 26, hour);
    const tree = h.render();
    assert.equal(h.salutation(), `${expected}, Kumar`);
    assert.equal(textOf(nodes(tree).find((node) => node.props?.className === 'dashboard-greeting-emoji')), emoji);
    assert.equal(nodes(tree).find((node) => node.type === 'time').props.dateTime, '2026-10-26');
  }
});

test('greeting immediately reflects the current account or Guest identity without a previous name', async (t) => {
  const h = await openGreeting(t);
  h.state.app.user = { uid: 'other', displayName: '  Priya   Kumar ' };
  assert.equal(h.salutation(), 'Good morning, Priya');
  h.state.app = { user: null, isGuest: true };
  assert.equal(h.salutation(), 'Good morning, Guest');
  h.state.app = { user: { uid: 'email', email: 'divin@example.com' }, isGuest: false };
  assert.equal(h.salutation(), 'Good morning, divin');
});

test('loading or failed business inputs cannot replace the greeting with metrics, status or retry UI', async (t) => {
  const h = await openGreeting(t), before = textOf(h.render());
  Object.assign(h.props, { events: [{ name: 'Private moment', activities: [{ title: 'Private activity' }] }],
    eventsReady: false, eventsError: true, onRetryEvents: () => { throw new Error('Unexpected business retry.'); } });
  assert.equal(textOf(h.render()), before);
  assert.equal(nodes(h.render()).some((node) => ['alert', 'status'].includes(node.props?.role)), false);
});
