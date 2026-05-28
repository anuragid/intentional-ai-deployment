import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs } from './cli.js';

test('parseArgs defaults mode=both', () => {
  const a = parseArgs(['--article', 'friction-reduction']);
  assert.equal(a.article, 'friction-reduction');
  assert.equal(a.mode, 'both');
  assert.equal(a.dryRun, false);
});

test('parseArgs reads mode and dry-run', () => {
  const a = parseArgs(['--article', 'all', '--mode', 'narration', '--dry-run']);
  assert.equal(a.article, 'all');
  assert.equal(a.mode, 'narration');
  assert.equal(a.dryRun, true);
});

test('parseArgs throws on missing --article', () => {
  assert.throws(() => parseArgs(['--mode', 'narration']), /--article/);
});

test('parseArgs rejects invalid mode', () => {
  assert.throws(() => parseArgs(['--article', 'x', '--mode', 'bogus']), /mode/);
});
