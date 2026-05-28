import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractBlocks } from './extract.js';

const html = readFileSync(
  fileURLToPath(new URL('../fixtures/sample-article.html', import.meta.url)), 'utf8');

test('extractBlocks returns prose blocks in order, footnote markers stripped', () => {
  const blocks = extractBlocks(html);
  assert.deepEqual(blocks.map(b => b.text), [
    'AI creates value.',          // footnote "1" excluded
    'The Pull',
    'Remove the obstacle. Automate the task.',
    'Tools are tools.',
  ]);
  assert.deepEqual(blocks.map(b => b.index), [0, 1, 2, 3]);
});

test('extractBlocks ignores content outside .article__prose and inside figures', () => {
  const blocks = extractBlocks(html);
  assert.ok(!blocks.some(b => /skipped/.test(b.text)));
  assert.ok(!blocks.some(b => b.text === 'Title'));
});
