import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findActiveWordIndex } from '../../../shared/audio-player.js';

const words = [
  { start: 0, end: 0.5 }, { start: 0.5, end: 1.0 }, { start: 1.0, end: 2.0 },
];

test('returns -1 before first word', () => {
  assert.equal(findActiveWordIndex(words, -0.1), -1);
});
test('finds the word covering t', () => {
  assert.equal(findActiveWordIndex(words, 0.6), 1);
  assert.equal(findActiveWordIndex(words, 1.5), 2);
});
test('clamps to last word after the end', () => {
  assert.equal(findActiveWordIndex(words, 99), 2);
});
