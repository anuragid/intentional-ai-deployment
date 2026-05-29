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

import { tagBlocks } from './tag.js';

const blocks = [
  { index: 0, text: 'Remove the obstacle. Automate the task.' },
  { index: 1, text: 'Tools are tools.' },
];

test('tagBlocks keeps clean, attaches additive tagged per block', async () => {
  const callImpl = async ({ clean }) =>
    clean === 'Tools are tools.' ? 'Tools are tools. [pause]' : clean;
  const out = await tagBlocks(blocks, { apiKey: 'k', model: 'm', callImpl });
  assert.deepEqual(out.map(b => b.index), [0, 1]);
  assert.equal(out[0].clean, blocks[0].text);
  assert.equal(out[0].tagged, blocks[0].text);          // model returned clean
  assert.equal(out[1].tagged, 'Tools are tools. [pause]');
});

test('tagBlocks falls back to tagged=clean when a word is altered', async () => {
  const warnings = [];
  const callImpl = async () => 'Tools are [pause] instruments.'; // alters a word
  const out = await tagBlocks([blocks[1]], {
    apiKey: 'k', model: 'm', callImpl, onWarn: (m) => warnings.push(m),
  });
  assert.equal(out[0].tagged, out[0].clean);            // safe fallback
  assert.equal(warnings.length, 1);
});

test('tagBlocks builds a word-preserving, delivery-only prompt', async () => {
  let seen = null;
  const callImpl = async (args) => { seen = args; return args.clean; };
  await tagBlocks([blocks[1]], { apiKey: 'k', model: 'm', callImpl });
  assert.match(seen.prompt, /verbatim|do not change|only.*bracket/i);
  assert.match(seen.prompt, /no.*sound.?effect|delivery/i);
  assert.equal(seen.clean, 'Tools are tools.');
});
