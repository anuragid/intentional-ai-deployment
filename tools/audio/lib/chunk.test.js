import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkBlocks } from './chunk.js';

const blocks = [
  { index: 0, text: 'aaaa' },   // 4
  { index: 1, text: 'bbbb' },   // 4
  { index: 2, text: 'cccccccc' }, // 8
];

test('chunkBlocks groups blocks without exceeding maxChars', () => {
  const chunks = chunkBlocks(blocks, 9); // separators count
  // join separator is '\n\n' (2 chars): [0]+sep+[1] = 4+2+4=10 > 9 -> split
  assert.equal(chunks.length, 3);
  assert.deepEqual(chunks[0].map(b => b.index), [0]);
});

test('a single block larger than maxChars still becomes its own chunk', () => {
  const chunks = chunkBlocks([{ index: 0, text: 'x'.repeat(50) }], 10);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0][0].index, 0);
});
