import test from 'node:test';
import assert from 'node:assert/strict';

import { getEventGreeting } from './greeting.js';

test('configured greeting body keeps line breaks and intentional blank lines', () => {
  const greeting = getEventGreeting({
    type: 'Birthday',
    name: 'Alex',
    personName: 'Alex',
    date: '2000-10-01',
    recurrence: 'none',
  }, {}, [{
    value: 'Birthday',
    canGenerateGreetingCards: true,
    greetingTemplate: 'Happy {ordinal} Birthday {name}\n\n1. {eventName}\n2. Keep celebrating',
  }]);

  assert.ok(greeting);
  assert.equal(greeting.title.startsWith('Happy '), true);
  assert.equal(greeting.body, '\n1. Birthday\n2. Keep celebrating');
});
