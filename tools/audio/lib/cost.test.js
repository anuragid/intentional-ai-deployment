import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateCost } from './cost.js';

test('estimateCost sums characters and reports both modes', () => {
  const est = estimateCost([{ index: 0, text: 'abcde' }, { index: 1, text: 'fg' }]);
  assert.equal(est.narrationChars, 7);
  assert.ok(est.summary.includes('7'));
});
