import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSettingsValue } from './settingsRepository.validation.js';

const validProfile = { displayName: 'Alex', nickname: 'Lex', description: 'Local profile', photoDataUrl: '' };

test('local profile setting accepts bounded text and empty initials-avatar image', () => {
  assert.equal(validateSettingsValue('profile', validProfile).valid, true);
});

test('local profile setting rejects oversized text and non-image data URLs', () => {
  assert.equal(validateSettingsValue('profile', { ...validProfile, description: 'x'.repeat(501) }).valid, false);
  assert.equal(validateSettingsValue('profile', { ...validProfile, photoDataUrl: 'data:text/html;base64,abc' }).valid, false);
});

test('local profile setting accepts only approved image data URL types within its limit', () => {
  assert.equal(validateSettingsValue('profile', { ...validProfile, photoDataUrl: `data:image/jpeg;base64,${'A'.repeat(749_900)}` }).valid, true);
  assert.equal(validateSettingsValue('profile', { ...validProfile, photoDataUrl: `data:image/jpeg;base64,${'A'.repeat(750_001)}` }).valid, false);
});
