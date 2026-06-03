import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkBlocks, segmentBlocks, isHeadingTag } from './chunk.js';

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

test('isHeadingTag recognizes h1-h6, not prose tags', () => {
  for (const t of ['h1', 'H2', 'h3']) assert.equal(isHeadingTag(t), true);
  for (const t of ['p', 'blockquote', 'li', '', undefined]) assert.equal(isHeadingTag(t), false);
});

test('segmentBlocks attaches each heading to its following prose, flagged headingLed', () => {
  const segs = segmentBlocks([
    { index: 0, text: 'intro para', tag: 'p' },
    { index: 1, text: 'A Heading', tag: 'h2' },
    { index: 2, text: 'body one', tag: 'p' },
    { index: 3, text: 'body two', tag: 'p' },
  ], 9000);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].headingLed, false);
  assert.deepEqual(segs[0].blocks.map(b => b.index), [0]);
  assert.equal(segs[1].headingLed, true);                  // heading + its body
  assert.deepEqual(segs[1].blocks.map(b => b.index), [1, 2, 3]);
});

test('segmentBlocks still honors maxChars within a prose run', () => {
  const segs = segmentBlocks([
    { index: 0, text: 'aaaa', tag: 'p' },
    { index: 1, text: 'bbbb', tag: 'p' }, // 4+2+4=10 > 9 -> new prose segment
  ], 9);
  assert.equal(segs.length, 2);
  assert.equal(segs.every(s => !s.headingLed), true);
});

test('segmentBlocks: only the first chunk of an overflowing section is headingLed', () => {
  // 'A Heading'(9) + sep(2) + x*8 = 19 fits in 20; adding y*8 (+2) = 29 overflows.
  const segs = segmentBlocks([
    { index: 0, text: 'A Heading', tag: 'h2' },
    { index: 1, text: 'x'.repeat(8), tag: 'p' },
    { index: 2, text: 'y'.repeat(8), tag: 'p' }, // overflows -> continuation chunk
  ], 20);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].headingLed, true);
  assert.deepEqual(segs[0].blocks.map(b => b.index), [0, 1]); // heading + first body
  assert.equal(segs[1].headingLed, false);                 // continuation, no silence
  assert.deepEqual(segs[1].blocks.map(b => b.index), [2]);
});

test('segmentBlocks: adjacent headings are each headingLed', () => {
  const segs = segmentBlocks([
    { index: 0, text: 'H A', tag: 'h2' },
    { index: 1, text: 'H B', tag: 'h3' },
    { index: 2, text: 'body', tag: 'p' },
  ], 9000);
  assert.equal(segs.length, 2);
  assert.equal(segs[0].headingLed, true);
  assert.deepEqual(segs[0].blocks.map(b => b.index), [0]);  // H A alone (next is a heading)
  assert.equal(segs[1].headingLed, true);
  assert.deepEqual(segs[1].blocks.map(b => b.index), [1, 2]); // H B + body
});
