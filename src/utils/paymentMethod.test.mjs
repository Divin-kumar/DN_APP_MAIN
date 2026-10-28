import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePaymentMethod, paymentMethodLabel, requirePaymentMethod } from './paymentMethod.js';

test('Phase 5 recognizes exactly Cash and Online, including historical missing values', () => {
  assert.equal(normalizePaymentMethod('Cash'), 'Cash');
  assert.equal(normalizePaymentMethod('Online'), 'Online');
  assert.equal(paymentMethodLabel(null), 'Not specified');
  assert.equal(paymentMethodLabel(''), 'Not specified');
  for (const invalid of ['Card','UPI','Bank','cash',null,undefined,'']) {
    assert.equal(normalizePaymentMethod(invalid),null);
    assert.throws(() => requirePaymentMethod(invalid),/Cash or Online/);
  }
  assert.equal(requirePaymentMethod('Online'), 'Online');
});
