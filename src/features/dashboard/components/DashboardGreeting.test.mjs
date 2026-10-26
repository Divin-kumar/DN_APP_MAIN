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
  const calls = [];
  const state = { app: { user: { uid: 'owner', displayName: 'Kumar Divin' }, isGuest: false }, sample: null,
    income: { incomes: [{ id: 'i', date: '2026-10-26', amount: 1000 }], loadedFor: 'user:owner', activeLoadKey: 'user:owner', loadIncomes: (...args) => calls.push(['income', ...args]) },
    expense: { expenses: [{ id: 'e', date: '2026-10-26', amount: 450 }], loadedFor: 'user:owner', activeLoadKey: 'user:owner', loadExpenses: (...args) => calls.push(['expense', ...args]) } };
  globalThis[key] = state;
  const server = await createServer({ configFile: false, envFile: false, esbuild: { jsx: 'automatic' },
    ssr: { noExternal: ['react', 'lucide-react'] },
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
    plugins: [{ name: 'isolated-daily-summary', enforce: 'pre', resolveId(source) {
      if (source === 'react') return '\0daily-react';
      if (source === 'react/jsx-runtime' || source === 'react/jsx-dev-runtime') return '\0daily-jsx';
      if (source === 'lucide-react') return '\0daily-icons';
      if (source.endsWith('/store/useAppStore')) return '\0daily-app';
      if (source.endsWith('/store/useIncomeStore')) return '\0daily-income';
      if (source.endsWith('/store/useExpenseStore')) return '\0daily-expense';
      if (source.endsWith('/dev/sampleData')) return '\0daily-sample';
      return null;
    }, load(id) {
      const fixture = `globalThis[${JSON.stringify(key)}]`;
      if (id === '\0daily-react') return 'export const useEffect=()=>{}, useMemo=(fn)=>fn();';
      if (id === '\0daily-jsx') return 'export const jsx=(type,props)=>({type,props}); export const jsxs=jsx,jsxDEV=jsx,Fragment="fragment";';
      if (id === '\0daily-icons') return 'export const CalendarDays="icon", CheckCheck="icon", Clock3="icon", Images="icon", Sparkles="icon", Sunrise="icon", Sun="icon", Moon="icon", Wallet="icon";';
      if (id === '\0daily-app') return `export default (select)=>select(${fixture}.app);`;
      if (id === '\0daily-income') return `export default ()=>${fixture}.income;`;
      if (id === '\0daily-expense') return `export default ()=>${fixture}.expense;`;
      if (id === '\0daily-sample') return `export const getActiveSampleScenario=()=>${fixture}.sample;`;
      return null;
    } }],
  });
  t.after(async () => { await server.close(); delete globalThis[key]; });
  const { default: Greeting } = await server.ssrLoadModule('/src/features/dashboard/components/DashboardGreeting.jsx');
  const props = { events: [{ date: '2026-10-26', activities: [{ date: '2026-10-26' }] }], eventsReady: true,
    eventsError: false, momentTypes: [], now: new Date(2026, 9, 26, 9), onRetryEvents: () => calls.push(['events']) };
  const render = () => Greeting(props);
  const metric = (label) => nodes(render()).find((node) => node.props?.label === label)?.props;
  return { state, props, calls, render, metric };
}

test('daily greeting presents real activity and monthly ledger values with an explicit recent-date window', async (t) => {
  const h = await openGreeting(t);
  assert.match(textOf(h.render()), /Good morning, Kumar/);
  assert.equal(h.metric('Activities today').value, 1);
  assert.equal(h.metric('Recent moments').value, 1);
  assert.equal(h.metric('Recent moments').detail, 'Dated in the past 7 days');
  assert.equal(h.metric('Pending activities').value, 1);
  assert.equal(h.metric('Spent · Oct 2026').value, '₹450');
  assert.equal(h.metric('Spent · Oct 2026').detail, 'Balance ₹550');
});

test('failed or loading event reads never become zero counts and expose an effective retry', async (t) => {
  const h = await openGreeting(t);
  h.props.eventsReady = false;
  assert.equal(h.metric('Activities today').value, '…');
  assert.equal(h.metric('Activities today').pending, true);
  h.props.eventsError = true;
  assert.equal(h.metric('Activities today').value, '—');
  assert.equal(h.metric('Pending activities').value, '—');
  nodes(h.render()).find((node) => node.type === 'button' && node.props.children === 'Retry summary').props.onClick();
  assert.deepEqual(h.calls, [['events']]);
});

test('finance values hide for a previous account, a changed Sample, loading or failed reads', async (t) => {
  const h = await openGreeting(t);
  h.state.app.user = { uid: 'other' };
  assert.equal(h.metric('Spent · Oct 2026').value, '…');
  assert.equal(h.metric('Spent · Oct 2026').detail, 'Balance unavailable');
  h.state.app.user = { uid: 'owner' };
  h.state.sample = 'isolated';
  assert.equal(h.metric('Spent · Oct 2026').value, '…');
  h.state.sample = null;
  h.state.expense.loading = true;
  assert.equal(h.metric('Spent · Oct 2026').value, '…');
  h.state.expense.loading = false;
  h.state.expense.error = 'Unable to load expenses.';
  assert.equal(h.metric('Spent · Oct 2026').value, '—');
  assert.match(textOf(h.render()), /Spending couldn’t be loaded/);
  nodes(h.render()).find((node) => node.type === 'button' && node.props.children === 'Retry finances').props.onClick();
  assert.deepEqual(h.calls, [['income', 'owner', false], ['expense', 'owner', false]]);
});

test('income failure keeps independently loaded spending available and never invents a balance', async (t) => {
  const h = await openGreeting(t);
  h.state.income.error = 'Unable to load incomes.';
  assert.equal(h.metric('Spent · Oct 2026').value, '₹450');
  assert.equal(h.metric('Spent · Oct 2026').detail, 'Balance unavailable');
  assert.match(textOf(h.render()), /Balance couldn’t be loaded/);
});

test('rolled-back save errors do not hide successfully loaded financial ledgers behind an ineffective load retry', async (t) => {
  const h = await openGreeting(t);
  h.state.income.error = 'Unable to save the income. Your changes were restored.';
  h.state.expense.error = 'Unable to delete the expense. It has been restored.';
  assert.equal(h.metric('Spent · Oct 2026').value, '₹450');
  assert.equal(h.metric('Spent · Oct 2026').detail, 'Balance ₹550');
  assert.doesNotMatch(textOf(h.render()), /Retry finances/);
});
