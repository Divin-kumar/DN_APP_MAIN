import test from 'node:test';
import assert from 'node:assert/strict';
import { createGreetingCardHtml, greetingToneFromType } from './greetingCard.js';

test('downloaded greeting preserves supported formatting and safely escapes every user field', () => {
  const html = createGreetingCardHtml({
    title: '**Happy birthday** <script>alert(1)</script>',
    body: '**A wonderful year**\n\n<img src=x onerror=alert(1)>\n- *Best wishes*',
    momentName: '<svg onload="alert(1)">',
    momentType: 'Birthday & friends',
    dateLabel: '23 Oct <2026>',
  });
  assert.match(html, /<strong>A wonderful year<\/strong>/);
  assert.match(html, /<ul><li><em>Best wishes<\/em><\/li><\/ul>/);
  assert.match(html, /Happy birthday &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /&lt;svg onload=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /Birthday &amp; friends · 23 Oct &lt;2026&gt;/);
  assert.doesNotMatch(html, /<script|<img|<svg/);
});

test('empty greeting exports remain readable and downloadable without disabling browser zoom', () => {
  const html = createGreetingCardHtml({});
  assert.match(html, /Your greeting title/);
  assert.match(html, /Your message will appear here\./);
  assert.match(html, /A special moment/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
});


test('greeting palettes use constrained occasion classes without echoing untrusted markup', () => {
  assert.equal(greetingToneFromType('Wedding'), 'romance');
  assert.equal(greetingToneFromType('BIRTHDAY'), 'celebration');
  assert.equal(greetingToneFromType('Family vacation'), 'journey');
  assert.equal(greetingToneFromType(''), 'classic');
  const card = createGreetingCardHtml({ momentType: '<svg onload=alert(1)>' });
  assert.match(card, /dn-greeting-card--classic/);
  assert.doesNotMatch(card, /<svg/);
});
