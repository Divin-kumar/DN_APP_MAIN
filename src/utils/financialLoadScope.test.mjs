import test from 'node:test';
import assert from 'node:assert/strict';
import { beginFinancialLoad, isFinancialScopeLoaded } from './financialLoadScope.js';

for (const field of ['incomes', 'expenses']) {
  test(`switching user or guest scope clears stale ${field} and invalidates ownership`, () => {
    const old = { activeLoadKey: 'user:A', loadedFor: 'user:A', [field]: [{ id: 'private-A' }], loading: false, error: 'old' };
    const pending = beginFinancialLoad(old, 'guest:anonymous', field);
    assert.deepEqual(pending[field], []);
    assert.equal(pending.loadedFor, null);
    assert.equal(pending.activeLoadKey, 'guest:anonymous');
    assert.equal(pending.loading, true);
    assert.equal(pending.error, null);
    assert.equal(isFinancialScopeLoaded(pending, 'user:A'), false);
    assert.deepEqual(old[field], [{ id: 'private-A' }]);
  });
  test(`switching back while a load is in flight never reuses ${field} from the old scope`, () => {
    const old = { activeLoadKey: 'user:A', loadedFor: 'user:A', [field]: [{ id: 'old-A' }] };
    const onB = { ...old, ...beginFinancialLoad(old, 'user:B', field) };
    const onA = { ...onB, ...beginFinancialLoad(onB, 'user:A', field) };
    assert.equal(isFinancialScopeLoaded(onA, 'user:A'), false);
    assert.equal(isFinancialScopeLoaded(onA, 'user:B'), false);
    assert.deepEqual(onA[field], []);
    const settled = { ...onA, [field]: [{ id: 'new-A' }], loadedFor: 'user:A' };
    assert.equal(isFinancialScopeLoaded(settled, 'user:A'), true);
  });
  test(`refreshing an active scope retains already-loaded ${field} while joining its request`, () => {
    const current = { activeLoadKey: 'user:A', loadedFor: null, [field]: [{ id: 'optimistic' }] };
    const pending = beginFinancialLoad(current, 'user:A', field);
    assert.equal(Object.hasOwn(pending, field), false);
    assert.equal(Object.hasOwn(pending, 'loadedFor'), false);
    assert.equal(pending.activeLoadKey, 'user:A');
    assert.equal(isFinancialScopeLoaded(current, 'user:A'), false);
  });
}
