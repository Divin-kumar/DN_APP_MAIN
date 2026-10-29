import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePaymentMethod, paymentMethodLabel, requirePaymentMethod } from './paymentMethod.js';

test('payment reads preserve custom and retired names without inferring missing methods', () => {
  assert.equal(normalizePaymentMethod('Cash'), 'Cash');
  assert.equal(normalizePaymentMethod('Online'), 'Online');
  assert.equal(paymentMethodLabel(null), 'Not specified');
  assert.equal(paymentMethodLabel(''), 'Not specified');
  for (const invalid of [null,undefined,'',42,{},false]) {
    assert.equal(normalizePaymentMethod(invalid),null);
    assert.throws(() => requirePaymentMethod(invalid),/available payment method/);
  }
  for (const value of ['Card', 'UPI', 'Bank', 'cash']) assert.equal(normalizePaymentMethod(value), value);
  assert.equal(normalizePaymentMethod(' Bank transfer '), 'Bank transfer');
  assert.equal(requirePaymentMethod('Online'), 'Online');
});

test('payment writes require active configured choices or the same transaction’s retained method', () => {
  const configured = [{ value: 'UPI', active: true }, { value: 'Cheque', active: false }];
  assert.equal(requirePaymentMethod('UPI', configured), 'UPI');
  assert.throws(() => requirePaymentMethod('Cash', configured), /available payment method/);
  assert.throws(() => requirePaymentMethod('Cheque', configured), /available payment method/);
  assert.equal(requirePaymentMethod('Cheque', configured, 'Cheque'), 'Cheque');
  assert.throws(() => requirePaymentMethod('UPI', []), /available payment method/);
  assert.equal(requirePaymentMethod('Old custom method', [], 'Old custom method'), 'Old custom method');
});
