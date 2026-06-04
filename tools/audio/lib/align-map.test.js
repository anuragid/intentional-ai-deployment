import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapAlignedWords, mapAlignedWordsLoose } from './align-map.js';

const blocks = [
  { index: 0, text: 'AI creates value.' },   // AI creates value.
  { index: 1, text: 'Tools are tools.' },    // Tools are tools.
];

// Flat aligned words in reading order, monotonic, non-overlapping.
const aligned = [
  { text: 'AI', start: 0.00, end: 0.30 },
  { text: 'creates', start: 0.30, end: 0.80 },
  { text: 'value.', start: 0.80, end: 1.20 },
  { text: 'Tools', start: 1.50, end: 1.90 },
  { text: 'are', start: 1.90, end: 2.10 },
  { text: 'tools.', start: 2.10, end: 2.60 },
];

test('block partition matches tokenizeWords counts and indices', () => {
  const out = mapAlignedWords(blocks, aligned);
  assert.deepEqual(out.blocks.map(b => b.index), [0, 1]);
  assert.equal(out.blocks[0].words.length, 3);
  assert.equal(out.blocks[1].words.length, 3);
});

test('emitted word text matches expected tokens; times monotonic non-overlapping', () => {
  const out = mapAlignedWords(blocks, aligned);
  assert.deepEqual(out.blocks[0].words.map(w => w.text), ['AI', 'creates', 'value.']);
  assert.deepEqual(out.blocks[1].words.map(w => w.text), ['Tools', 'are', 'tools.']);
  const flat = out.blocks.flatMap(b => b.words);
  for (let i = 1; i < flat.length; i++) {
    assert.ok(flat[i].start >= flat[i - 1].start);  // non-decreasing start
    assert.ok(flat[i].end >= flat[i].start);         // non-overlapping within word
  }
});

test('duration = max end, rounded; shape matches the player contract', () => {
  const out = mapAlignedWords(blocks, aligned);
  assert.ok(Math.abs(out.duration - 2.60) < 1e-6);
  assert.ok(Array.isArray(out.blocks));
  for (const b of out.blocks)
    for (const w of b.words)
      assert.deepEqual(Object.keys(w).sort(), ['end', 'start', 'text']);
});

test('re-syncs across minor aligner drift (a split token)', () => {
  // Aligner split "value." into "value" + "." — one extra entry.
  const drifted = [
    { text: 'AI', start: 0, end: 0.3 },
    { text: 'creates', start: 0.3, end: 0.8 },
    { text: 'value', start: 0.8, end: 1.1 },
    { text: '.', start: 1.1, end: 1.2 },
    { text: 'Tools', start: 1.5, end: 1.9 },
    { text: 'are', start: 1.9, end: 2.1 },
    { text: 'tools.', start: 2.1, end: 2.6 },
  ];
  const out = mapAlignedWords(blocks, drifted);
  // block 0 still has 3 words; block 1 starts at "Tools"
  assert.equal(out.blocks[0].words.length, 3);
  assert.equal(out.blocks[1].words[0].text, 'Tools');
});

test('throws with the offending block index when drift cannot re-sync', () => {
  const broken = [{ text: 'AI', start: 0, end: 0.3 }]; // far too few words
  assert.throws(() => mapAlignedWords(blocks, broken), /block 0/);
});

// ---- mapAlignedWordsLoose: tolerates unspoken tokens (citations) ----

const citeBlocks = [
  { index: 0, text: 'Failure is common (Ryseff et al., 2024).' },
  { index: 1, text: 'Tools are tools.' },
];

test('loose: skipped citation tokens get zero-width timing at prior word end', () => {
  // Narrator read "Failure is common" then jumped straight to block 1 — the
  // citation "(Ryseff et al., 2024)." never appears in the aligner output.
  const spoken = [
    { text: 'Failure', start: 0.0, end: 0.4 },
    { text: 'is', start: 0.4, end: 0.6 },
    { text: 'common', start: 0.6, end: 1.0 },
    { text: 'Tools', start: 1.4, end: 1.8 },
    { text: 'are', start: 1.8, end: 2.0 },
    { text: 'tools.', start: 2.0, end: 2.5 },
  ];
  const out = mapAlignedWordsLoose(citeBlocks, spoken);
  const b0 = out.blocks[0].words;
  assert.deepEqual(b0.map(w => w.text),
    ['Failure', 'is', 'common', '(Ryseff', 'et', 'al.,', '2024).']);
  // The four unspoken citation tokens collapse to the end of "common" (1.0).
  for (const w of b0.slice(3)) {
    assert.equal(w.start, 1.0);
    assert.equal(w.end, 1.0);
  }
  assert.equal(out.skipped, 4);
  // Reading order stays non-decreasing across the whole article.
  const flat = out.blocks.flatMap(b => b.words);
  for (let i = 1; i < flat.length; i++) assert.ok(flat[i].start >= flat[i - 1].start);
});

test('loose: whitespace-only aligner entries are ignored', () => {
  const withSpaces = [
    { text: 'AI', start: 0, end: 0.3 }, { text: ' ', start: 0.3, end: 0.32 },
    { text: 'creates', start: 0.32, end: 0.8 }, { text: ' ', start: 0.8, end: 0.82 },
    { text: 'value.', start: 0.82, end: 1.2 },
  ];
  const out = mapAlignedWordsLoose([{ index: 0, text: 'AI creates value.' }], withSpaces);
  assert.deepEqual(out.blocks[0].words.map(w => w.text), ['AI', 'creates', 'value.']);
  assert.equal(out.skipped, 0);
});
