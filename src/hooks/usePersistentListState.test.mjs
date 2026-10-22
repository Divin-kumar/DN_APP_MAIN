import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

test('real list-state hook switches scopes synchronously and rejects stale account/Moment callbacks', async (t) => {
  const fixtureKey = `__dnListMemoryTest${Date.now()}`;
  const values = new Map();
  const refs = [];
  let cursor = 0;
  const fixture = { app: { user: { uid: 'owner-a' }, isGuest: false },
    ref: (initial) => refs[cursor++] ||= { current: initial } };
  globalThis[fixtureKey] = fixture;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)),
  } });
  const server = await createServer({ configFile: false, envFile: false, ssr: { noExternal: ['react'] },
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
    plugins: [{ name: 'isolated-list-memory-hook', enforce: 'pre',
      resolveId(source, importer) {
        if (!importer?.replaceAll('\\', '/').endsWith('/src/hooks/usePersistentListState.js')) return null;
        if (source === 'react') return '\0list-memory-react';
        if (source === '../store/useAppStore') return '\0list-memory-app';
        return null;
      },
      load(id) {
        const api = `globalThis[${JSON.stringify(fixtureKey)}]`;
        if (id === '\0list-memory-react') return `export const useRef=${api}.ref; export const useCallback=(fn)=>fn; export const useEffect=()=>{}; export const useSyncExternalStore=(_subscribe, snapshot)=>snapshot();`;
        if (id === '\0list-memory-app') return `const useStore=(select)=>select(${api}.app); useStore.getState=()=>${api}.app; export default useStore;`;
        return null;
      },
    }],
  });
  t.after(async () => {
    await server.close();
    delete globalThis[fixtureKey];
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage;
  });
  const { default: usePersistentListState } = await server.ssrLoadModule('/src/hooks/usePersistentListState.js');
  const defaults = { search: '', filter: 'all', field: 'date', direction: 'asc' };
  const render = (key = 'activities:one') => { cursor = 0; return usePersistentListState(key, defaults); };
  let [state, changeA] = render();
  assert.deepEqual(state, defaults);
  changeA({ search: 'owner A', filter: 'completed', direction: 'desc' });
  fixture.app = { user: { uid: 'owner-b' }, isGuest: false };
  let [, changeB] = render();
  assert.deepEqual(render()[0], defaults);
  changeA({ search: 'stale A' });
  changeB({ search: 'owner B' });
  render('activities:two');
  changeB({ search: 'stale Moment' });
  assert.equal(render()[0].search, 'owner B');
  fixture.app = { user: null, isGuest: true };
  assert.deepEqual(render()[0], defaults);
  render()[1]({ search: 'guest' });
  fixture.app = { user: { uid: 'owner-a' }, isGuest: false };
  assert.equal(render()[0].search, 'owner A');
  render()[2]();
  assert.deepEqual(render()[0], defaults);
  fixture.app = { user: null, isGuest: false };
  render()[1]({ search: 'must not save' });
  assert.deepEqual(render()[0], defaults);
  assert.ok([...values.keys()].every((key) => !key.includes('signed-out')));
});
