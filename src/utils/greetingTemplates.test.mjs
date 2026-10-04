import assert from 'node:assert/strict';
import test from 'node:test';

import { getGreetingTemplateForStyle, GREETING_TEMPLATE_STYLES } from './greetingTemplates.js';

test('greeting selector exposes all required styles', () => {
  assert.deepEqual(GREETING_TEMPLATE_STYLES, ['Default', 'Friendly', 'Professional', 'Motivational', 'Minimal', 'Custom']);
});

test('built-in styles produce greeting templates with supported placeholders', () => {
  for (const style of GREETING_TEMPLATE_STYLES.filter((item) => item !== 'Custom')) {
    assert.match(getGreetingTemplateForStyle(style, 'Birthday'), /\{name\}/);
  }
});

test('Custom preserves the supplied text and blank custom text stays empty for validation', () => {
  assert.equal(getGreetingTemplateForStyle('Custom', 'Birthday', 'Hello {name}'), 'Hello {name}');
  assert.equal(getGreetingTemplateForStyle('Custom', 'Birthday', ''), '');
});
