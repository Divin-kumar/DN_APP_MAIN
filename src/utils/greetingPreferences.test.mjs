import assert from 'node:assert/strict';
import test from 'node:test';

import { migrateGreetingPreferences } from './greetingPreferences.js';

const defaults = {
  Birthday: 'Happy {ordinal} Birthday {name}',
  Anniversary: 'Happy {ordinal} Anniversary {name}',
};

test('legacy default greetings migrate to the Default selector value', () => {
  const migrated = migrateGreetingPreferences({ greetingTemplates: defaults }, defaults);
  assert.equal(migrated.greetingTemplateStyles.Birthday, 'Default');
  assert.equal(migrated.greetingTemplateStyles.Anniversary, 'Default');
});

test('legacy customized greetings migrate to Custom without losing their text', () => {
  const migrated = migrateGreetingPreferences({ greetingTemplates: { Birthday: 'Cheers, {name}!' } }, defaults);
  assert.equal(migrated.greetingTemplateStyles.Birthday, 'Custom');
  assert.equal(migrated.greetingCustomTemplates.Birthday, 'Cheers, {name}!');
});

test('already migrated preferences keep their selected style and custom text', () => {
  const migrated = migrateGreetingPreferences({
    greetingTemplateStyles: { Birthday: 'Friendly' },
    greetingCustomTemplates: { Birthday: 'Remember this custom draft' },
  }, defaults);
  assert.equal(migrated.greetingTemplateStyles.Birthday, 'Friendly');
  assert.equal(migrated.greetingCustomTemplates.Birthday, 'Remember this custom draft');
});
