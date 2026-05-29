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
