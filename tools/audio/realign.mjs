// Regenerate word-level timings for ALREADY-RENDERED narration audio.
//
// Forced-aligns each article's existing narration.mp3 against the CLEAN
// extracted blocks (no tags, no audio re-render) and writes a
// player-compatible narration.json with real { blocks:[{index, words:[...] }] }.
// This re-enables the play-along / auto-scroll / word-highlight experience
// without paying for a TTS re-render.
//
// Usage (from tools/audio/):
//   node --env-file=../../.env realign.mjs                 # all articles with a local mp3
//   node --env-file=../../.env realign.mjs friction-reduction [slug2 ...]
//
// Requires: ELEVENLABS_API_KEY in the environment (.env at repo root).

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import process from 'node:process';

import { extractBlocks } from './lib/extract.js';
import { JOIN_SEPARATOR } from './lib/chunk.js';
import { forcedAlign } from './lib/align.js';
import { mapAlignedWordsLoose } from './lib/align-map.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = resolve(__dirname, '../../articles');
const AUDIO_DIR = resolve(__dirname, '../../audio');

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error('Missing ELEVENLABS_API_KEY. Run with: node --env-file=../../.env realign.mjs');
  process.exit(1);
}

function audioSlugsWithMp3() {
  return readdirSync(AUDIO_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(slug => existsSync(resolve(AUDIO_DIR, slug, 'narration.mp3')));
}

async function realign(slug) {
  const mp3Path = resolve(AUDIO_DIR, slug, 'narration.mp3');
  const jsonPath = resolve(AUDIO_DIR, slug, 'narration.json');
  const htmlPath = resolve(ARTICLES_DIR, slug, 'index.html');

  if (!existsSync(mp3Path)) throw new Error(`no narration.mp3 for ${slug}`);
  if (!existsSync(htmlPath)) throw new Error(`no article HTML for ${slug}`);

  const blocks = extractBlocks(readFileSync(htmlPath, 'utf8'));
  const transcript = blocks.map(b => b.text).join(JOIN_SEPARATOR);
  const audio = readFileSync(mp3Path);

  const sizeMb = (audio.length / 1e6).toFixed(1);
  process.stdout.write(`[${slug}] aligning ${sizeMb}MB against ${blocks.length} blocks… `);

  const result = await forcedAlign({ apiKey, audio, transcript });
  const mapped = mapAlignedWordsLoose(blocks, result.words);

  const totalWords = mapped.blocks.reduce((n, b) => n + b.words.length, 0);
  // Strip the diagnostic `skipped` count before persisting the player manifest.
  const { skipped, ...timings } = mapped;
  writeFileSync(jsonPath, JSON.stringify(timings));
  console.log(`ok — ${mapped.blocks.length} blocks, ${totalWords} words, ${skipped} unspoken, ${mapped.duration}s`);
  return mapped;
}

const args = process.argv.slice(2);
const slugs = args.length ? args : audioSlugsWithMp3();
console.log(`Realigning: ${slugs.join(', ')}\n`);

let failures = 0;
for (const slug of slugs) {
  try {
    await realign(slug);
  } catch (err) {
    failures++;
    console.error(`[${slug}] FAILED: ${err.message}`);
  }
}
process.exit(failures ? 1 : 0);
