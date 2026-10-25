import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';

for (const domain of ['Income', 'Expense']) for (const operation of ['add', 'update', 'delete']) {
  test(`${domain} ${operation}: late account success/failure cannot replace a new same-ID scope`, async (t) => {
    t.mock.method(console, 'error', () => {});
    const key = `__dnFinanceMutation${Date.now()}${Math.random().toString(36).slice(2)}`;
    let settle;
    const api = { read: async (uid) => [{ id: 'same', firestoreId: `${uid}-document`, name: uid, amount: 10 }],
      write: () => new Promise((resolve, reject) => { settle = { resolve, reject }; }) };
    globalThis[key] = api;
    const server = await createServer({ configFile: false, envFile: false, ssr: { external: ['zustand', 'react'] },
      server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
      plugins: [{ name: 'isolated-financial-mutations', enforce: 'pre',
        resolveId(source, importer) {
          if (!importer?.replaceAll('\\', '/').endsWith(`/src/store/use${domain}Store.js`)) return null;
          if (source === `../services/${domain.toLowerCase()}Service`) return '\0scope-finance-service';
          if (source === '../dev/sampleData') return '\0scope-finance-sample';
          return null;
        },
        load(id) {
          const fixture = `globalThis[${JSON.stringify(key)}]`, plural = `${domain}s`;
          if (id === '\0scope-finance-service') return `export const get${plural}ForUser=${fixture}.read;
            export const create${domain}=${fixture}.write,update${domain}=${fixture}.write,delete${domain}=${fixture}.write;
            export const getGuest${plural}=()=>[],saveGuest${domain}=()=>[],removeGuest${domain}=()=>[];`;
          if (id === '\0scope-finance-sample') return 'export const getActiveSampleScenario=()=>null,getActiveSampleData=()=>null,requireActiveSampleData=()=>null,saveActiveSampleData=()=>{};';
          return null;
        } }],
    });
    t.after(async () => { await server.close(); delete globalThis[key]; });
    const { default: store } = await server.ssrLoadModule(`/src/store/use${domain}Store.js`);
    const field = `${domain.toLowerCase()}s`, load = `load${domain}s`;
    for (const failure of [false, true]) {
      await store.getState()[load]('A', false);
      const original = store.getState()[field][0];
      const method = operation === 'add' ? `add${domain}` : `${operation}${domain}Item`;
      const pending = store.getState()[method]('A', false, operation === 'delete' ? original.id : { ...original, name: 'Old pending edit' });
      await store.getState()[load]('B', false);
      const current = store.getState();
      if (failure) {
        const rejected = assert.rejects(pending, /old request failed/);
        settle.reject(new Error('old request failed')); await rejected;
      } else { settle.resolve({ ...original, name: 'Old success' }); await pending; }
      assert.equal(store.getState(), current);
      assert.equal(store.getState()[field][0].name, 'B');
    }
  });
}
