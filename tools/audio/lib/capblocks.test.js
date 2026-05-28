import { test } from 'node:test';
import assert from 'node:assert/strict';
import { capBlocks } from './chunk.js';

const blocks = [
  { index: 0, text: 'aaaa' },     // 4
  { index: 1, text: 'bbbb' },     // +2 sep +4 = 10
  { index: 2, text: 'cccc' },     // +2 sep +4 = 16
];

test('capBlocks returns all blocks when maxChars is falsy', () => {
  assert.equal(capBlocks(blocks, 0).length, 3);
  assert.equal(capBlocks(blocks, null).length, 3);
});

test('capBlocks stops before exceeding maxChars', () => {
  // 0 -> 4; +sep+bbbb = 10 <= 11 ok; +sep+cccc = 16 > 11 stop
  const out = capBlocks(blocks, 11);
  assert.deepEqual(out.map(b => b.index), [0, 1]);
});

test('capBlocks always keeps at least the first block even if oversized', () => {
  const out = capBlocks([{ index: 0, text: 'x'.repeat(50) }, { index: 1, text: 'y' }], 10);
  assert.deepEqual(out.map(b => b.index), [0]);
});
