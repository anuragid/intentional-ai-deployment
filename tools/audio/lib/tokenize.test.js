import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collapseWhitespace, tokenizeWords } from '../../../shared/audio-tokenize.js';

test('collapseWhitespace collapses runs and trims', () => {
  assert.equal(collapseWhitespace('  a\n  b   c '), 'a b c');
});

test('tokenizeWords splits on whitespace with offsets', () => {
  const toks = tokenizeWords('AI creates value');
  assert.deepEqual(toks.map(t => t.text), ['AI', 'creates', 'value']);
  assert.equal(toks[0].charStart, 0);
  assert.equal(toks[0].charEnd, 2);
  assert.equal(toks[1].charStart, 3);
  assert.equal(toks[2].charEnd, 16);
});

test('tokenizeWords on empty string returns []', () => {
  assert.deepEqual(tokenizeWords(''), []);
});
