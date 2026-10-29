import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { createServer } from 'vite';
import { sameRecord } from '../utils/transactionRelations.js';
import { createBackupDocument } from './backupService.js';
import { DEFAULT_CODE_LISTS } from '../utils/codeLists.js';

test('account financial readers include unified transactions, retain source routing and keep canonical IDs first', async (t) => {
  const records = new Map([
    ['users/A/expenses', [
      ['typed-expense', { id: 'existing-expense', name: 'Typed expense', amount: 10, date: '2026-10-18' }],
      ['same-provider-id', { id: 'typed-distinct', name: 'Other typed expense', amount: 30, date: '2026-10-18' }],
    ]],
    ['users/A/incomes', [['typed-income', { id: 'existing-income', name: 'Typed income', type: 'Salary', amount: 100, date: '2026-10-18' }]]],
    ['users/A/eventGroups', [['moment-doc', { id: 'moment', name: 'Moment', date: '2026-10-22', activities: [
      { id: 'activity', title: 'Activity', expenses: [{ id: 'nested-only', name: 'Embedded only', amount: 5, date: '2026-10-21' }] },
    ] }]]],
    ['users/A/transactions', [
      ['legacy-expense-existing', { id: 'existing-expense', kind: 'expense', name: 'Mirrored expense', amount: 999, date: '2026-10-19' }],
      ['legacy-income-existing', { id: 'existing-income', kind: 'income', name: 'Mirrored income', category: 'Bonus', amount: 999, date: '2026-10-19' }],
      ['transaction-20', { id: 'new-20', kind: 'expense', name: 'New expense one', amount: 20, date: '2026-10-22', category: 'Other', eventId: 'moment', activityId: 'activity', firestoreId: 'outdated-provider-id' }],
      ['transaction-115', { id: 'new-115', kind: 'expense', name: 'New expense two', amount: 115, date: '2026-10-22', eventId: 'moment', activityId: 'activity' }],
      ['transaction-50', { id: 'new-50', kind: 'expense', name: 'New expense three', amount: 50, date: '2026-10-22' }],
      ['transaction-income', { id: 'new-income', kind: 'income', name: 'Reward', category: 'Bonus', amount: 2, date: '2026-10-20', eventId: 'moment' }],
      ['same-provider-id', { id: 'unified-distinct', kind: 'expense', name: 'Different unified expense', amount: 40, date: '2026-10-20' }],
      ['unknown-kind', { id: 'ignored-transfer', kind: 'transfer', amount: 500, date: '2026-10-22' }],
    ]],
  ]);
  const calls = [];
  let nextDocument = 0;
  let failNextBatch = false;
  const applyOperation = (operation, path, data) => {
    const boundary = path.lastIndexOf('/');
    const collectionPath = path.slice(0, boundary);
    const documentId = path.slice(boundary + 1);
    const items = records.get(collectionPath) || [];
    if (operation === 'delete') records.set(collectionPath, items.filter(([id]) => id !== documentId));
    else records.set(collectionPath, items.map(([id, current]) => [id, id === documentId ? { ...current, ...data } : current]));
  };
  const fixtureKey = `__dnFinancialSourceTest${Date.now()}`;
  const api = {
    collection: (_db, ...parts) => parts.join('/'),
    doc: (_db, ...parts) => parts.join('/'),
    getDocs: async (path) => {
      calls.push(['read', path]);
      const items = records.get(path);
      if (items instanceof Error) throw items;
      return { empty: !items?.length, docs: (items || []).map(([id, data]) => ({ id, data: () => data })) };
    },
    addDoc: async (path, data) => {
      calls.push(['create', path, data]);
      const id = `new-provider-${++nextDocument}`;
      records.set(path, [...(records.get(path) || []), [id, { ...data }]]);
      return { id };
    },
    updateDoc: async (path, data) => { calls.push(['update', path, data]); applyOperation('update', path, data); },
    deleteDoc: async (path) => { calls.push(['delete', path]); applyOperation('delete', path); },
    writeBatch: () => {
      const operations = [];
      return {
        update: (path, data) => operations.push(['update', path, data]),
        delete: (path) => operations.push(['delete', path]),
        commit: async () => {
          calls.push(['batch-commit', operations]);
          if (failNextBatch) { failNextBatch = false; throw new Error('Atomic batch rejected'); }
          for (const [operation, path, data] of operations) applyOperation(operation, path, data);
        },
      };
    },
  };
  globalThis[fixtureKey] = api;
  const server = await createServer({
    configFile: false, envFile: false, ssr: { noExternal: ['firebase', 'react'] },
    // Attach HMR to an unlistened server; parallel module tests need no socket.
    server: { middlewareMode: true, watch: null, hmr: { server: createHttpServer() } },
    plugins: [{
      name: 'isolated-financial-sources', enforce: 'pre',
      resolveId(source, importer) {
        if (importer?.replaceAll('\\', '/').endsWith('/src/hooks/useTransactionManager.js')) {
          if (source.endsWith('/services/scopedRecordActions')) return '\0financial-hook-writer';
          if (source === 'react') return '\0financial-hook-react';
          const store = { '../store/useAppStore': 'app', '../store/useIncomeStore': 'income',
            '../store/useExpenseStore': 'expense', '../store/useEventStore': 'event' }[source];
          if (store) return `\0financial-hook-${store}`;
        }
        if (!/\/src\/services\/(?:expenseService|incomeService|eventService|accountTransactionService)\.js$/.test(importer?.replaceAll('\\', '/') || '')) return null;
        if (source === 'firebase/firestore') return '\0financial-test-firestore';
        if (source === '../firebase/config') return '\0financial-test-db';
        return null;
      },
      load(id) {
        if (id === '\0financial-test-db') return 'export const db = {};';
        if (id === '\0financial-test-firestore') return `export const { ${Object.keys(api).join(', ')} } = globalThis[${JSON.stringify(fixtureKey)}];`;
        if (id === '\0financial-hook-writer') return `import {createScopedRecordActions} from '/src/utils/scopedRecordActions.js'; const api=()=>globalThis[${JSON.stringify(fixtureKey)}].hook; export const scopedRecordActions=createScopedRecordActions({getSession:()=>api().appState,getEvents:()=>api().eventState});`;
        if (id === '\0financial-hook-react') return 'export const useCallback = (callback) => callback;';
        if (id === '\0financial-hook-app') return `const useStore=(selector)=>selector(globalThis[${JSON.stringify(fixtureKey)}].hook.appState); useStore.getState=()=>globalThis[${JSON.stringify(fixtureKey)}].hook.appState; export default useStore;`;
        if (id === '\0financial-hook-event') return `const useStore = () => globalThis[${JSON.stringify(fixtureKey)}].hook.eventState; useStore.getState = useStore; export default useStore;`;
        if (['\0financial-hook-income', '\0financial-hook-expense'].includes(id)) {
          const store = id.endsWith('income') ? 'incomeStore' : 'expenseStore';
          return `const useStore = () => globalThis[${JSON.stringify(fixtureKey)}].hook.${store}.getState(); useStore.getState = useStore; export default useStore;`;
        }
        return null;
      },
    }],
  });
  t.after(async () => { await server.close(); delete globalThis[fixtureKey]; });
  const expenseService = await server.ssrLoadModule('/src/services/expenseService.js');
  const incomeService = await server.ssrLoadModule('/src/services/incomeService.js');

  const expenses = await expenseService.getExpensesForUser('A');
  const incomes = await incomeService.getIncomesForUser('A');
  assert.equal(calls.every(([operation]) => operation === 'read'), true, 'loading never migrates or writes business data');
  assert.equal(expenses.length, 7);
  assert.equal(incomes.length, 2);
  assert.equal(expenses.find((item) => item.id === 'existing-expense').amount, 10, 'typed record wins when the same application ID is mirrored');
  assert.equal(incomes.find((item) => item.id === 'existing-income').amount, 100);
  assert.equal(incomes.find((item) => item.id === 'new-income').type, 'Bonus', 'unified income category maps to the existing typed form');
  assert.equal(expenses.some((item) => item.id === 'ignored-transfer'), false);
  const recovered = expenses.find((item) => item.id === 'new-20');
  assert.equal(recovered.firestoreCollection, 'transactions');
  assert.equal(recovered.firestoreId, 'transaction-20', 'actual provider identity takes precedence over old stored metadata');
  assert.equal(recovered.eventId, 'moment');
  assert.equal(recovered.activityId, 'activity');
  const typed = expenses.find((item) => item.id === 'typed-distinct');
  const unified = expenses.find((item) => item.id === 'unified-distinct');
  assert.equal(sameRecord(typed, unified), false, 'equal provider IDs in different collections are different records');
  const duplicatedExpense = expenses.find((item) => item.id === 'existing-expense');
  const duplicatedIncome = incomes.find((item) => item.id === 'existing-income');
  assert.deepEqual(duplicatedExpense.firestoreSources, [
    { collection: 'expenses', id: 'typed-expense' }, { collection: 'transactions', id: 'legacy-expense-existing' },
  ]);
  assert.equal(duplicatedIncome.firestoreSources.length, 2);

  const updatedExpense = await expenseService.updateExpense('A', { ...recovered, name: 'Edited' });
  assert.equal(calls.at(-1)[1], 'users/A/transactions/transaction-20');
  assert.equal(calls.at(-1)[2].kind, 'expense');
  assert.equal(calls.at(-1)[2].id, 'new-20');
  assert.equal(Object.hasOwn(calls.at(-1)[2], 'firestoreCollection'), false);
  assert.equal(Object.hasOwn(calls.at(-1)[2], 'firestoreId'), false);
  assert.equal(updatedExpense.firestoreId, 'transaction-20');
  assert.equal(updatedExpense.firestoreCollection, 'transactions');
  await expenseService.deleteExpense('A', expenses.find((item) => item.id === 'new-50'));
  assert.deepEqual(calls.at(-1), ['delete', 'users/A/transactions/transaction-50']);

  const recoveredIncome = incomes.find((item) => item.id === 'new-income');
  await incomeService.updateIncome('A', { ...recoveredIncome, type: 'Salary' });
  assert.equal(calls.at(-1)[1], 'users/A/transactions/transaction-income');
  assert.equal(calls.at(-1)[2].kind, 'income');
  assert.equal(calls.at(-1)[2].category, 'Salary');
  await incomeService.deleteIncome('A', recoveredIncome);
  assert.deepEqual(calls.at(-1), ['delete', 'users/A/transactions/transaction-income']);
  await expenseService.updateExpense('A', typed);
  assert.equal(calls.at(-1)[1], 'users/A/expenses/same-provider-id');
  assert.equal(Object.hasOwn(calls.at(-1)[2], 'kind'), false);
  await expenseService.createExpense('A', { ...recovered, id: 'created-expense', firestoreCollection: 'transactions',
    firestoreSources: [{ collection: 'transactions', id: 'must-not-copy-this-source' }] });
  assert.equal(calls.at(-1)[1], 'users/A/expenses', 'new writes remain in the current typed ledger');
  assert.equal(Object.hasOwn(calls.at(-1)[2], 'firestoreSources'), false);
  await incomeService.createIncome('A', { ...recoveredIncome, id: 'created-income', firestoreCollection: 'transactions' });
  assert.equal(calls.at(-1)[1], 'users/A/incomes');
  await expenseService.updateExpense('A', { ...typed, firestoreCollection: '../other-user' });
  assert.equal(calls.at(-1)[1], 'users/A/expenses/same-provider-id', 'unrecognized source paths cannot redirect writes');

  const backup = createBackupDocument({ expenses, incomes, codeLists: DEFAULT_CODE_LISTS });
  assert.equal(backup.expenses.length, 7);
  assert.equal(backup.incomes.length, 2);
  assert.equal(backup.expenses.some((item) => item.id === 'new-115'), true);
  assert.equal([...backup.expenses, ...backup.incomes].every((item) => !Object.hasOwn(item, 'firestoreId') && !Object.hasOwn(item, 'firestoreCollection') && !Object.hasOwn(item, 'firestoreSources')), true);
  const nestedBackup = createBackupDocument({ moments: [{ id: 'moment', activities: [{ id: 'activity', expenses: [recovered] }] }], codeLists: DEFAULT_CODE_LISTS });
  assert.equal(Object.hasOwn(nestedBackup.activities[0].expenses[0], 'firestoreSources'), false, 'nested expense copies also exclude runtime document origins');

  await expenseService.updateExpense('A', { ...duplicatedExpense, amount: 11 });
  assert.equal(calls.at(-1)[0], 'batch-commit');
  assert.equal(records.get('users/A/expenses').find(([id]) => id === 'typed-expense')[1].amount, 11);
  assert.equal(records.get('users/A/transactions').find(([id]) => id === 'legacy-expense-existing')[1].amount, 11);
  const beforeRejectedDelete = JSON.stringify([...records]);
  failNextBatch = true;
  await assert.rejects(() => expenseService.deleteExpense('A', duplicatedExpense), /Atomic batch rejected/);
  assert.equal(JSON.stringify([...records]), beforeRejectedDelete, 'a rejected batch leaves both source copies unchanged');
  await expenseService.deleteExpense('A', duplicatedExpense);
  assert.equal((await expenseService.getExpensesForUser('A')).some((item) => item.id === duplicatedExpense.id), false, 'deleting a typed winner cannot resurrect its unified copy after reload');
  await incomeService.deleteIncome('A', duplicatedIncome);
  assert.equal((await incomeService.getIncomesForUser('A')).some((item) => item.id === duplicatedIncome.id), false, 'duplicate-source income deletion also survives reload');

  const { default: expenseStore } = await server.ssrLoadModule('/src/store/useExpenseStore.js');
  expenseStore.getState().setExpenses([typed, unified]);
  await expenseStore.getState().deleteExpenseItem('A', false, unified.id);
  assert.deepEqual(expenseStore.getState().expenses.map((item) => item.id), ['typed-distinct']);
  assert.deepEqual(calls.at(-1), ['delete', 'users/A/transactions/same-provider-id']);

  // Exercise the actual coordinator, actual expense store and actual source-aware
  // service with controlled hook bindings. React memoization is outside this test.
  const { default: incomeStore } = await server.ssrLoadModule('/src/store/useIncomeStore.js');
  api.hook = { appState: { user: { uid: 'A' }, isGuest: false }, expenseStore, incomeStore,
    eventState: { loadedFor:'user:A',activeLoadKey:'user:A', events: [], updateEventItem: async (_uid, _guest, event) => {
      calls.push(['event-update', event]);
      api.hook.eventState.events = [event];
    } } };
  const { default: useTransactionManager } = await server.ssrLoadModule('/src/hooks/useTransactionManager.js');
  expenseStore.getState().setExpenses([recovered]);
  expenseStore.setState({loadedFor:'user:A',activeLoadKey:'user:A'});
  await useTransactionManager().removeTransaction({ ...recovered, transactionKind: 'expense', eventId: 'missing-moment', activityId: 'missing-activity' });
  assert.deepEqual(calls.at(-1), ['delete', 'users/A/transactions/transaction-20'], 'a persisted recovered expense remains deletable after an old parent disappears');
  const beforeNestedDelete = calls.length;
  await assert.rejects(() => useTransactionManager().removeTransaction({ id: 'nested-orphan', transactionKind: 'expense', eventId: 'missing-moment', activityId: 'missing-activity' }), /moment is unavailable/);
  assert.equal(calls.length, beforeNestedDelete, 'nested-only deletion still requires its actual parent');
  api.hook.appState = { user: null, isGuest: true };
  expenseStore.setState({loadedFor:'guest:anonymous',activeLoadKey:'guest:anonymous'});
  await assert.rejects(() => useTransactionManager().removeTransaction({ ...recovered, transactionKind: 'expense', eventId: 'missing-moment', activityId: 'missing-activity' }), /moment is unavailable/, 'guest mirror safety remains unchanged');
  api.hook.appState = { user: { uid: 'A' }, isGuest: false, adminValuesOwner: 'A', adminValues: { paymentMethods: ['Cash', 'Online'] } };
  expenseStore.setState({loadedFor:'user:A',activeLoadKey:'user:A'});
  api.hook.eventState.events = [{ id: 'moment', activities: [{ id: 'activity', expenses: [recovered] }] }];
  expenseStore.getState().setExpenses([recovered]);
  expenseStore.setState({loadedFor:'user:A',activeLoadKey:'user:A'});
  const beforeLinkedDelete = calls.length;
  await useTransactionManager().removeTransaction({ ...recovered, transactionKind: 'expense' });
  assert.equal(calls[beforeLinkedDelete][0], 'event-update');
  assert.deepEqual(calls[beforeLinkedDelete][1].activities[0].expenses, [], 'an available activity mirror is reconciled before deleting the source document');
  assert.deepEqual(calls.at(-1), ['delete', 'users/A/transactions/transaction-20']);

  records.set('users/A/expenses', [...records.get('users/A/expenses'), ['convert-typed', { id: 'convert-source', name: 'Conversion fixture', amount: 15, date: '2026-10-22' }]]);
  records.set('users/A/transactions', [...records.get('users/A/transactions'), ['convert-unified', { id: 'convert-source', kind: 'expense', name: 'Conversion fixture', amount: 15, date: '2026-10-22' }]]);
  const beforeConversion = await expenseService.getExpensesForUser('A');
  expenseStore.getState().setExpenses(beforeConversion);
  expenseStore.setState({loadedFor:'user:A',activeLoadKey:'user:A'});
  incomeStore.getState().setIncomes(await incomeService.getIncomesForUser('A'));
  api.hook.eventState.events = [];
  await useTransactionManager().saveTransaction({ transactionKind: 'income', title: 'Converted', amount: 15, date: '2026-10-22', category: 'Bonus', paymentMethod: 'Online', notes: '', eventId: '', activityId: '' },
    { ...beforeConversion.find((item) => item.id === 'convert-source'), transactionKind: 'expense' });
  assert.equal((await expenseService.getExpensesForUser('A')).some((item) => item.id === 'convert-source'), false, 'type conversion removes every known old-kind source so it cannot reappear');
  assert.equal((await incomeService.getIncomesForUser('A')).some((item) => item.name === 'Converted' && item.amount === 15), true);

  records.set('users/B/transactions', Object.assign(new Error('Denied fixture'), { code: 'permission-denied' }));
  records.set('users/B/incomes', [['typed-B', { id: 'B-income', name: 'Readable', amount: 3, date: '2026-10-22' }]]);
  const warn = console.warn;
  const warnings = [];
  console.warn = (message) => warnings.push(message);
  try { assert.equal((await incomeService.getIncomesForUser('B')).length, 1); }
  finally { console.warn = warn; }
  assert.match(warnings[0], /transaction collection is unavailable/);
  records.set('users/B/transactions', Object.assign(new Error('Offline fixture'), { code: 'unavailable' }));
  await assert.rejects(() => incomeService.getIncomesForUser('B'), /Offline fixture/, 'network failures are not silently treated as a complete ledger');
  assert.equal((await incomeService.getIncomesForUser('C')).length, 0, 'a different account cannot return A records');

  for (const [collectionName, read] of [['expenses', expenseService.getExpensesForUser], ['incomes', incomeService.getIncomesForUser]]) {
    records.set(`users/D/${collectionName}`, [['actual-document', { name: 'Missing application ID', amount: 1, date: '2026-10-22',
      firestoreId: 'outdated-stored-id', firestoreCollection: 'transactions',
      firestoreSources: [{ collection: 'transactions', id: 'unrelated-stored-source' }] }]]);
    const [record] = await read('D');
    assert.equal(record.id, 'actual-document', 'missing application IDs fall back to the actual provider document, never stale stored metadata');
    assert.equal(record.firestoreId, 'actual-document');
    assert.equal(record.firestoreCollection, collectionName);
    assert.deepEqual(record.firestoreSources, [{ collection: collectionName, id: 'actual-document' }], 'stored source arrays cannot supply runtime routing');
  }
});
