import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripTags, normalizeWords, sameWords } from './enhance.js';

test('stripTags removes only bracketed tags; keeps ellipses, caps, punctuation', () => {
  assert.equal(stripTags('Remove [pause] the OBSTACLE…'), 'Remove  the OBSTACLE…');
  assert.equal(stripTags('[sighs] Tools are tools.'), ' Tools are tools.');
  assert.equal(stripTags('plain text, no tags'), 'plain text, no tags');
});

test('normalizeWords is insensitive to caps, punctuation, ellipses, and tags', () => {
  assert.deepEqual(normalizeWords('Tools… [sighs] are TOOLS!'), ['tools', 'are', 'tools']);
  assert.deepEqual(normalizeWords('  AI — quietly.  '), ['ai', 'quietly']);
});

test('sameWords: true when only tags/caps/punct/ellipses differ', () => {
  assert.equal(sameWords('Tools are tools.', 'Tools… [sighs] are TOOLS!'), true);
});

test('sameWords: false on an added word', () => {
  assert.equal(sameWords('Tools are tools.', 'Tools are really tools.'), false);
});

test('sameWords: false on a removed word', () => {
  assert.equal(sameWords('Tools are tools.', 'Tools tools.'), false);
});

test('sameWords: false on a reordered word', () => {
  assert.equal(sameWords('tools are good', 'are tools good'), false);
});

test('normalizeWords mirrors the karaoke mapper: hyphenated compound is one token', () => {
  // align-map.js strips punctuation WITHOUT splitting, so "state-of-the-art"
  // is a single token there. The guard must agree or it could wrong-pass.
  assert.deepEqual(normalizeWords('state-of-the-art tool'), ['stateoftheart', 'tool']);
  assert.equal(sameWords('state-of-the-art tool', 'state of the art tool'), false);
});

import { loadEnhanced } from './enhance.js';

const liveBlocks = [
  { index: 0, text: 'Remove the obstacle.' },
  { index: 1, text: 'Tools are tools.' },
];

test('loadEnhanced returns enhanced text when words match; clean is the LIVE text', () => {
  const readImpl = () => JSON.stringify({ slug: 's', blocks: [
    { index: 0, clean: 'Remove the obstacle.', enhanced: 'Remove the obstacle…' },
    { index: 1, clean: 'Tools are tools.', enhanced: '[sighs] Tools are TOOLS.' },
  ]});
  const out = loadEnhanced('s', liveBlocks, { readImpl, onWarn: () => {} });
  assert.equal(out[0].clean, 'Remove the obstacle.');
  assert.equal(out[0].tagged, 'Remove the obstacle…');
  assert.equal(out[1].tagged, '[sighs] Tools are TOOLS.');
});

test('loadEnhanced falls back to clean on a missing file (one file-level warning)', () => {
  const warnings = [];
  const readImpl = () => { throw new Error('ENOENT'); };
  const out = loadEnhanced('s', liveBlocks, { readImpl, onWarn: (m) => warnings.push(m) });
  assert.equal(out[0].tagged, out[0].clean);
  assert.equal(out[1].tagged, out[1].clean);
  assert.equal(warnings.length, 1);
});

test('loadEnhanced falls back per-block when an entry is stale (word-altered)', () => {
  const warnings = [];
  const readImpl = () => JSON.stringify({ slug: 's', blocks: [
    { index: 0, clean: 'Remove the obstacle.', enhanced: 'Remove the obstacle…' },
    { index: 1, clean: 'old text', enhanced: 'Tools are instruments.' },
  ]});
  const out = loadEnhanced('s', liveBlocks, { readImpl, onWarn: (m) => warnings.push(m) });
  assert.equal(out[0].tagged, 'Remove the obstacle…');
  assert.equal(out[1].tagged, out[1].clean);
  assert.equal(warnings.length, 1);
});

test('loadEnhanced falls back per-block when an index is missing from the artifact', () => {
  const warnings = [];
  const readImpl = () => JSON.stringify({ slug: 's', blocks: [
    { index: 0, clean: 'Remove the obstacle.', enhanced: 'Remove the obstacle…' },
  ]});
  const out = loadEnhanced('s', liveBlocks, { readImpl, onWarn: (m) => warnings.push(m) });
  assert.equal(out[1].tagged, out[1].clean);
  assert.equal(warnings.length, 1);
});
