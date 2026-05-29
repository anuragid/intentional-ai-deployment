import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collapseWhitespace } from '../../../shared/audio-tokenize.js';
import { stripTags } from './tag.js';

test('stripTags removes bracketed delivery tags only', () => {
  assert.equal(stripTags('Remove [pause] the obstacle.'), 'Remove  the obstacle.');
  assert.equal(stripTags('[sighs] Tools are tools.'), ' Tools are tools.');
  assert.equal(stripTags('plain text, no tags'), 'plain text, no tags');
});

test('stripTags leaves spoken words and ordinary punctuation intact', () => {
  const tagged = 'AI creates value [pause] — quietly. [exhales]';
  assert.equal(stripTags(tagged), 'AI creates value  — quietly. ');
});

test('additive-only invariant: collapseWhitespace(stripTags(tagged)) === clean', () => {
  const clean = 'Remove the obstacle. Automate the task.';
  const tagged = 'Remove the obstacle. [pause] Automate the task.';
  assert.equal(collapseWhitespace(stripTags(tagged)), clean);
});

test('invariant catches a model that alters a word', () => {
  const clean = 'Tools are tools.';
  const bad = 'Tools are [pause] instruments.'; // changed "tools" -> "instruments"
  assert.notEqual(collapseWhitespace(stripTags(bad)), clean);
});
