import test from 'node:test';
import assert from 'node:assert/strict';
import { pdfStoryText } from './pdfStoryText.js';

test('PDF Studio renders historical paragraph HTML as readable writing, not visible tags', () => {
  assert.equal(pdfStoryText('<p>Morning notes</p><p>Another day &amp; some joy.</p>'), 'Morning notes\nAnother day & some joy.');
  assert.equal(pdfStoryText('<p>On the road<br/>We stopped</p><ul><li>One</li><li>Two</li></ul>'),
    'On the road\nWe stopped\n• One\n• Two');
  assert.equal(pdfStoryText('<p><strong>Remember</strong> &lt;3</p>'), 'Remember <3');
});
test('PDF text conversion preserves ordinary Markdown and literal unsafe markup', () => {
  assert.equal(pdfStoryText('**A lovely day**\n- Warm tea'), 'A lovely day\n• Warm tea');
  assert.match(pdfStoryText('<script>alert(1)</script>'), /<script>/);
});
