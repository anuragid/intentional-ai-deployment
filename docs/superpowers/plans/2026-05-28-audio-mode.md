# Audio Mode for Articles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-article audio experience — verbatim **Narration** with karaoke-synced word highlighting, plus a two-host **Podcast** — pre-generated via ElevenLabs, served from Firebase Storage, played by a contemplative in-article player.

**Architecture:** Two decoupled halves communicating only through artifacts in Firebase Storage. (A) An offline Node CLI (`tools/audio/`) extracts article prose, calls ElevenLabs (TTS-with-timestamps for narration, Create Podcast for podcast), maps character timestamps to per-word timings, and uploads MP3 + JSON + a manifest. (B) A browser player (`shared/audio-player.js` + `.css`) lazily loads a slug's manifest, plays the chosen mode, and — for narration — highlights the active word using the **CSS Custom Highlight API** (zero DOM mutation, so it never collides with `highlights.js`) while auto-scrolling.

**Tech Stack:** Node ≥ 20 (built-in `node:test`, `fetch`), `node-html-parser` (build-time HTML parse), `firebase-admin` (Storage upload), ElevenLabs REST API, vanilla browser ESM, CSS Custom Highlight API.

---

## Shared Word Contract (read first)

The build tool and the runtime player must tokenize prose **identically**, so a word's timing lines up with the same word in the live DOM. The single source of truth is `shared/audio-tokenize.js`, imported by **both** sides.

- A "narratable block" is an element matching `SELECTOR = 'p, h2, h3, blockquote, li'` inside `.article__prose`, in document order.
- A block's narration text = its visible text **excluding** `sup.footnote-ref` subtrees, with runs of whitespace collapsed to single spaces and trimmed.
- `tokenizeWords(text)` splits that text into word tokens on whitespace, returning `[{ text, charStart, charEnd }]` (offsets into the *collapsed* block text).
- `narration.json` stores, per block, an **ordered** word list `[{ text, start, end }]`. The runtime re-tokenizes the live block, matches by index (verifying `text`), and builds a `Range` for that word by walking the block's text nodes (also skipping footnote sups) counting characters.

Because both sides use the same function on the same logical text, word index *i* refers to the same word everywhere.

## File Structure

**New — build tool (`tools/audio/`):**
- `tools/audio/package.json` — `"type": "module"`, deps, `test`/`build` scripts.
- `tools/audio/.env.example` — required env vars.
- `tools/audio/lib/extract.js` — `extractBlocks(html)` → ordered blocks `[{ index, text }]`.
- `tools/audio/lib/cost.js` — `estimateCost(blocks)` pure helper for `--dry-run`.
- `tools/audio/lib/chunk.js` — `chunkBlocks(blocks, maxChars)` → chunk groups respecting block boundaries.
- `tools/audio/lib/map.js` — `mapNarration(chunks, alignments)` → `narration.json` object (the core algorithm).
- `tools/audio/lib/elevenlabs.js` — `synthesizeWithTimestamps()`, `createPodcast()`, `pollProjectUntilDone()`, `downloadPodcastAudio()` (thin REST wrappers; `fetch` injectable for tests).
- `tools/audio/lib/upload.js` — `uploadArtifacts()`, `writeManifest()` (firebase-admin Storage; bucket injectable).
- `tools/audio/lib/cli.js` — `parseArgs(argv)` pure arg parser.
- `tools/audio/build-audio.mjs` — orchestration entry point.
- `tools/audio/cors.json` — Storage CORS config.
- Tests colocated: `tools/audio/lib/*.test.js`, plus `tools/audio/fixtures/sample-article.html`.

**New — shared / runtime:**
- `shared/audio-tokenize.js` — `SELECTOR`, `collapseWhitespace()`, `blockNarrationText(node)`, `tokenizeWords(text)`. Environment-agnostic ESM (imported by build tool **and** browser).
- `shared/audio-player.js` — player UI, lazy manifest load, mode toggle, rAF highlight loop, auto-scroll.
- `shared/audio-player.css` — player styling (design-system aligned).

**New — config:**
- `storage.rules` — public read for `audio/**`, no client writes.

**Modified:**
- `firebase.json` — register `storage` rules; add `audio/**` to hosting `ignore` is NOT needed (assets live in Storage, not Hosting).
- `articles/*/index.html` (all 5) — link player CSS/JS, add mount point.
- `PROJECT_STATUS.md` — document feature + build command.
- root `.gitignore` — ignore `tools/audio/.env` and `tools/audio/service-account.json`.

---

## Task 1: Scaffold the build tool

**Files:**
- Create: `tools/audio/package.json`
- Create: `tools/audio/.env.example`
- Create: `tools/audio/lib/smoke.test.js`
- Modify: `.gitignore`

- [ ] **Step 1: Create `tools/audio/package.json`**

```json
{
  "name": "audio-build",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "build": "node build-audio.mjs"
  },
  "dependencies": {
    "node-html-parser": "^6.1.13",
    "firebase-admin": "^12.7.0"
  }
}
```

- [ ] **Step 2: Create `tools/audio/.env.example`**

```bash
# ElevenLabs
ELEVENLABS_API_KEY=
ELEVENLABS_NARRATION_VOICE_ID=
ELEVENLABS_PODCAST_HOST_VOICE_ID=
ELEVENLABS_PODCAST_GUEST_VOICE_ID=
ELEVENLABS_MODEL_ID=eleven_multilingual_v2

# Firebase Storage upload (service account JSON, gitignored)
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
FIREBASE_STORAGE_BUCKET=intentional-ai-deployment.firebasestorage.app
```

- [ ] **Step 3: Add a trivial passing test so the runner is wired**

`tools/audio/lib/smoke.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('node:test runner works', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 4: Ignore secrets**

Append to `.gitignore`:

```
tools/audio/.env
tools/audio/service-account.json
```

- [ ] **Step 5: Install deps and run tests**

Run: `cd tools/audio && npm install && npm test`
Expected: PASS — `tests 1 ... pass 1`.

- [ ] **Step 6: Commit**

```bash
git add tools/audio/package.json tools/audio/.env.example tools/audio/lib/smoke.test.js .gitignore
git commit -m "chore(audio): scaffold build tool with node:test"
```

---

## Task 2: Shared tokenizer (`shared/audio-tokenize.js`)

This is imported by both Node and the browser, so it must be pure ESM with no environment assumptions beyond a minimal node interface (`nodeType`, `childNodes`, text via `textContent ?? rawText`, `tagName`, class via `getAttribute`/`classList`).

**Files:**
- Create: `shared/audio-tokenize.js`
- Test: `tools/audio/lib/tokenize.test.js`

- [ ] **Step 1: Write failing tests**

`tools/audio/lib/tokenize.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collapseWhitespace, tokenizeWords } from '../../../shared/audio-tokenize.js';

test('collapseWhitespace collapses runs and trims', () => {
  assert.equal(collapseWhitespace('  a\n  b   c '), 'a b c');
});

test('tokenizeWords splits on whitespace with offsets', () => {
  const toks = tokenizeWords('AI creates value');
  assert.deepEqual(toks.map(t => t.text), ['AI', 'creates', 'value']);
  assert.equal(toks[0].charStart, 0);
  assert.equal(toks[0].charEnd, 2);
  assert.equal(toks[1].charStart, 3);
  assert.equal(toks[2].charEnd, 16);
});

test('tokenizeWords on empty string returns []', () => {
  assert.deepEqual(tokenizeWords(''), []);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd tools/audio && node --test lib/tokenize.test.js`
Expected: FAIL — cannot find module `audio-tokenize.js`.

- [ ] **Step 3: Implement `shared/audio-tokenize.js`**

```js
// Shared by the audio build tool (Node) and the runtime player (browser).
// Pure ESM, no DOM/global assumptions beyond a minimal node interface.

export const SELECTOR = 'p, h2, h3, blockquote, li';

export function collapseWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

// Visible narration text of a block element, excluding footnote-ref sups.
// `node` may be a browser Element or a node-html-parser element.
export function blockNarrationText(node) {
  let out = '';
  for (const child of node.childNodes || []) {
    if (child.nodeType === 3) {                       // text node
      out += child.textContent ?? child.rawText ?? '';
    } else if (child.nodeType === 1) {                // element
      const tag = (child.tagName || '').toLowerCase();
      const cls = child.getAttribute ? (child.getAttribute('class') || '') : '';
      if (tag === 'sup' && /footnote-ref/.test(cls)) continue; // skip footnote markers
      out += blockNarrationText(child);
    }
  }
  return collapseWhitespace(out);
}

export function tokenizeWords(text) {
  const tokens = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ text: m[0], charStart: m.index, charEnd: m.index + m[0].length });
  }
  return tokens;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd tools/audio && node --test lib/tokenize.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add shared/audio-tokenize.js tools/audio/lib/tokenize.test.js
git commit -m "feat(audio): shared prose tokenizer for build + runtime"
```

---

## Task 3: Block extraction (`lib/extract.js`)

**Files:**
- Create: `tools/audio/lib/extract.js`
- Create: `tools/audio/fixtures/sample-article.html`
- Test: `tools/audio/lib/extract.test.js`

- [ ] **Step 1: Create the fixture**

`tools/audio/fixtures/sample-article.html`:

```html
<!DOCTYPE html><html><body class="article-page" data-slug="sample">
<main class="article">
  <section class="article__title-block"><h1 class="article__title">Title</h1></section>
  <div class="article__prose">
    <p>AI creates value.<sup class="footnote-ref"><a href="#fn-1">1</a></sup></p>
    <h2>The Pull</h2>
    <p>Remove the obstacle. Automate the task.</p>
    <figure class="article-embed"><div>should be skipped</div></figure>
    <blockquote>Tools are tools.</blockquote>
  </div>
</main></body></html>
```

- [ ] **Step 2: Write failing tests**

`tools/audio/lib/extract.test.js`:

```js
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
```

- [ ] **Step 3: Run, verify fail**

Run: `cd tools/audio && node --test lib/extract.test.js`
Expected: FAIL — cannot find `./extract.js`.

- [ ] **Step 4: Implement `tools/audio/lib/extract.js`**

```js
import { parse } from 'node-html-parser';
import { SELECTOR, blockNarrationText } from '../../../shared/audio-tokenize.js';

// Returns ordered narratable blocks from an article's HTML string.
export function extractBlocks(html) {
  const root = parse(html);
  const prose = root.querySelector('.article__prose');
  if (!prose) return [];
  const els = prose.querySelectorAll(SELECTOR);
  const blocks = [];
  for (const el of els) {
    // Skip blocks inside figures/embeds (e.g. captions).
    if (el.closest('figure')) continue;
    const text = blockNarrationText(el);
    if (!text) continue;
    blocks.push({ index: blocks.length, text });
  }
  return blocks;
}
```

- [ ] **Step 5: Run, verify pass**

Run: `cd tools/audio && node --test lib/extract.test.js`
Expected: PASS — 2 tests.

> Note: `node-html-parser` text nodes expose `.rawText` and elements expose `.getAttribute`; `blockNarrationText` already handles both. If `.closest` is unavailable on this parser version, replace with an ancestor walk checking `tagName === 'FIGURE'`.

- [ ] **Step 6: Commit**

```bash
git add tools/audio/lib/extract.js tools/audio/lib/extract.test.js tools/audio/fixtures/sample-article.html
git commit -m "feat(audio): extract narratable blocks from article HTML"
```

---

## Task 4: Chunking + cost estimate

ElevenLabs caps input length per request. We chunk on block boundaries so each block stays whole (needed for clean timing maps).

**Files:**
- Create: `tools/audio/lib/chunk.js`
- Create: `tools/audio/lib/cost.js`
- Test: `tools/audio/lib/chunk.test.js`, `tools/audio/lib/cost.test.js`

- [ ] **Step 1: Write failing tests**

`tools/audio/lib/chunk.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkBlocks } from './chunk.js';

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
```

`tools/audio/lib/cost.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateCost } from './cost.js';

test('estimateCost sums characters and reports both modes', () => {
  const est = estimateCost([{ index: 0, text: 'abcde' }, { index: 1, text: 'fg' }]);
  assert.equal(est.narrationChars, 7);
  assert.ok(est.summary.includes('7'));
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd tools/audio && node --test lib/chunk.test.js lib/cost.test.js`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `tools/audio/lib/chunk.js`**

```js
export const JOIN_SEPARATOR = '\n\n';

// Groups blocks into chunks whose joined text length <= maxChars.
// A single oversized block becomes its own chunk (sent as-is).
export function chunkBlocks(blocks, maxChars = 4500) {
  const chunks = [];
  let current = [];
  let len = 0;
  for (const b of blocks) {
    const add = (current.length ? JOIN_SEPARATOR.length : 0) + b.text.length;
    if (current.length && len + add > maxChars) {
      chunks.push(current);
      current = [];
      len = 0;
    }
    current.push(b);
    len += (current.length > 1 ? JOIN_SEPARATOR.length : 0) + b.text.length;
  }
  if (current.length) chunks.push(current);
  return chunks;
}
```

- [ ] **Step 4: Implement `tools/audio/lib/cost.js`**

```js
// Rough one-time cost estimate for --dry-run. Rates are indicative only.
const USD_PER_1K_CHARS = 0.30; // adjust to your ElevenLabs plan

export function estimateCost(blocks) {
  const narrationChars = blocks.reduce((n, b) => n + b.text.length, 0);
  const usd = (narrationChars / 1000) * USD_PER_1K_CHARS;
  return {
    narrationChars,
    estimatedUsd: Number(usd.toFixed(2)),
    summary: `Narration: ${narrationChars} chars (~$${usd.toFixed(2)}). Podcast billed separately by ElevenLabs.`,
  };
}
```

- [ ] **Step 5: Run, verify pass**

Run: `cd tools/audio && node --test lib/chunk.test.js lib/cost.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add tools/audio/lib/chunk.js tools/audio/lib/cost.js tools/audio/lib/chunk.test.js tools/audio/lib/cost.test.js
git commit -m "feat(audio): block chunking and dry-run cost estimate"
```

---

## Task 5: Timing map (`lib/map.js`) — core algorithm

Given the chunks we sent and ElevenLabs' per-character alignment for each chunk, produce `narration.json`: per block, an ordered word list with absolute `start`/`end` times.

**Files:**
- Create: `tools/audio/lib/map.js`
- Test: `tools/audio/lib/map.test.js`

- [ ] **Step 1: Write failing tests**

`tools/audio/lib/map.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapNarration } from './map.js';

// One chunk, two blocks joined by '\n\n'. Build a fake alignment where each
// character takes 0.1s sequentially.
function fakeAlignment(text, t0 = 0) {
  const characters = [...text];
  const character_start_times_seconds = characters.map((_, i) => +(t0 + i * 0.1).toFixed(4));
  const character_end_times_seconds = characters.map((_, i) => +(t0 + (i + 1) * 0.1).toFixed(4));
  return { characters, character_start_times_seconds, character_end_times_seconds };
}

test('mapNarration maps words to absolute times across blocks', () => {
  const blocks = [{ index: 0, text: 'AI wins' }, { index: 1, text: 'Go now' }];
  const chunkText = 'AI wins\n\nGo now';
  const result = mapNarration(
    [{ blocks, text: chunkText, audioDuration: chunkText.length * 0.1 }],
    [fakeAlignment(chunkText)],
  );
  assert.equal(result.blocks.length, 2);
  const ai = result.blocks[0].words[0];
  assert.equal(ai.text, 'AI');
  assert.equal(ai.start, 0);                 // char 0
  assert.ok(Math.abs(ai.end - 0.2) < 1e-6);  // chars 0..1 -> end of char index1
  const go = result.blocks[1].words[0];
  assert.equal(go.text, 'Go');
  // 'Go' starts at char index 9 in chunkText -> 0.9s
  assert.ok(Math.abs(go.start - 0.9) < 1e-6);
});

test('mapNarration offsets a second chunk by accumulated duration', () => {
  const b0 = [{ index: 0, text: 'one' }];
  const b1 = [{ index: 1, text: 'two' }];
  const c0 = { blocks: b0, text: 'one', audioDuration: 0.3 };
  const c1 = { blocks: b1, text: 'two', audioDuration: 0.3 };
  const result = mapNarration([c0, c1], [fakeAlignment('one'), fakeAlignment('two')]);
  // block 1 word 'two' should start at 0.3 (offset) + 0
  assert.ok(Math.abs(result.blocks[1].words[0].start - 0.3) < 1e-6);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd tools/audio && node --test lib/map.test.js`
Expected: FAIL — `./map.js` not found.

- [ ] **Step 3: Implement `tools/audio/lib/map.js`**

```js
import { JOIN_SEPARATOR } from './chunk.js';
import { tokenizeWords } from '../../../shared/audio-tokenize.js';

// For a char offset within a chunk, return the time at that char's start.
function timeAtChar(alignment, charIndex, which) {
  const arr = which === 'end'
    ? alignment.character_end_times_seconds
    : alignment.character_start_times_seconds;
  const clamped = Math.max(0, Math.min(charIndex, arr.length - 1));
  return arr[clamped];
}

// chunks: [{ blocks:[{index,text}], text, audioDuration }]
// alignments: per-chunk ElevenLabs alignment objects (same order)
export function mapNarration(chunks, alignments) {
  const outBlocks = [];
  let timeOffset = 0;
  chunks.forEach((chunk, ci) => {
    const alignment = alignments[ci];
    let blockCharCursor = 0;
    chunk.blocks.forEach((block, bi) => {
      const blockStartInChunk = blockCharCursor;
      const words = tokenizeWords(block.text).map((tok) => {
        const gStart = blockStartInChunk + tok.charStart;
        const gEnd = blockStartInChunk + tok.charEnd - 1; // last char index
        return {
          text: tok.text,
          start: +(timeOffset + timeAtChar(alignment, gStart, 'start')).toFixed(4),
          end: +(timeOffset + timeAtChar(alignment, gEnd, 'end')).toFixed(4),
        };
      });
      outBlocks.push({ index: block.index, words });
      // advance cursor past this block + separator (except after last block)
      blockCharCursor += block.text.length;
      if (bi < chunk.blocks.length - 1) blockCharCursor += JOIN_SEPARATOR.length;
    });
    timeOffset += chunk.audioDuration;
  });
  const duration = outBlocks.length
    ? outBlocks.flatMap(b => b.words).reduce((mx, w) => Math.max(mx, w.end), 0)
    : 0;
  return { duration: +duration.toFixed(4), blocks: outBlocks };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd tools/audio && node --test lib/map.test.js`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/audio/lib/map.js tools/audio/lib/map.test.js
git commit -m "feat(audio): map ElevenLabs char timestamps to per-word timings"
```

---

## Task 6: ElevenLabs client (`lib/elevenlabs.js`)

Thin REST wrappers with an injectable `fetch` so we can unit-test request construction without hitting the network.

**Files:**
- Create: `tools/audio/lib/elevenlabs.js`
- Test: `tools/audio/lib/elevenlabs.test.js`

- [ ] **Step 1: Write failing tests (request construction + narration decode)**

`tools/audio/lib/elevenlabs.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeWithTimestamps, createPodcast } from './elevenlabs.js';

function mockFetch(captured, response) {
  return async (url, opts) => {
    captured.url = url; captured.opts = opts;
    return { ok: true, status: 200, json: async () => response };
  };
}

test('synthesizeWithTimestamps posts to the with-timestamps endpoint and decodes audio', async () => {
  const cap = {};
  const audioB64 = Buffer.from('ID3fake').toString('base64');
  const fetchImpl = mockFetch(cap, {
    audio_base64: audioB64,
    alignment: { characters: ['a'], character_start_times_seconds: [0], character_end_times_seconds: [0.1] },
  });
  const res = await synthesizeWithTimestamps('hello', {
    apiKey: 'k', voiceId: 'V', modelId: 'M',
  }, fetchImpl);

  assert.ok(cap.url.includes('/v1/text-to-speech/V/with-timestamps'));
  assert.equal(cap.opts.headers['xi-api-key'], 'k');
  assert.equal(JSON.parse(cap.opts.body).text, 'hello');
  assert.equal(JSON.parse(cap.opts.body).model_id, 'M');
  assert.ok(Buffer.isBuffer(res.audio));
  assert.equal(res.audio.toString(), 'ID3fake');
  assert.deepEqual(res.alignment.character_end_times_seconds, [0.1]);
});

test('createPodcast posts conversation mode with both voices', async () => {
  const cap = {};
  const fetchImpl = mockFetch(cap, { project: { project_id: 'P1' } });
  const res = await createPodcast({
    apiKey: 'k', modelId: 'M', source: { type: 'text', text: 'article' },
    hostVoiceId: 'H', guestVoiceId: 'G',
  }, fetchImpl);

  assert.ok(cap.url.includes('/v1/studio/podcasts'));
  const body = JSON.parse(cap.opts.body);
  assert.equal(body.mode.type, 'conversation');
  assert.equal(body.mode.conversation.host_voice_id, 'H');
  assert.equal(body.mode.conversation.guest_voice_id, 'G');
  assert.equal(res.projectId, 'P1');
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd tools/audio && node --test lib/elevenlabs.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tools/audio/lib/elevenlabs.js`**

```js
const BASE = 'https://api.elevenlabs.io';

async function call(url, opts, fetchImpl) {
  const f = fetchImpl || fetch;
  const res = await f(url, opts);
  if (!res.ok) {
    const detail = await res.text?.().catch(() => '') ?? '';
    throw new Error(`ElevenLabs ${res.status} for ${url}: ${detail}`);
  }
  return res;
}

// Narration: returns { audio: Buffer, alignment }
export async function synthesizeWithTimestamps(text, { apiKey, voiceId, modelId }, fetchImpl) {
  const url = `${BASE}/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`;
  const res = await call(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: modelId }),
  }, fetchImpl);
  const json = await res.json();
  return { audio: Buffer.from(json.audio_base64, 'base64'), alignment: json.alignment };
}

// Podcast: kicks off async Studio project. Returns { projectId }.
export async function createPodcast({ apiKey, modelId, source, hostVoiceId, guestVoiceId, instructionsPrompt, durationScale }, fetchImpl) {
  const url = `${BASE}/v1/studio/podcasts`;
  const body = {
    model_id: modelId,
    mode: { type: 'conversation', conversation: { host_voice_id: hostVoiceId, guest_voice_id: guestVoiceId } },
    source,
    ...(instructionsPrompt ? { instructions_prompt: instructionsPrompt } : {}),
    ...(durationScale ? { duration_scale: durationScale } : {}),
  };
  const res = await call(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, fetchImpl);
  const json = await res.json();
  return { projectId: json.project?.project_id ?? json.project_id };
}

// Poll a Studio project until conversion finishes. Returns the project JSON.
export async function pollProjectUntilDone({ apiKey, projectId, intervalMs = 5000, timeoutMs = 600000, sleep }, fetchImpl) {
  const wait = sleep || ((ms) => new Promise(r => setTimeout(r, ms)));
  const url = `${BASE}/v1/studio/projects/${projectId}`;
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await call(url, { headers: { 'xi-api-key': apiKey } }, fetchImpl);
    const json = await res.json();
    const state = json.project?.state ?? json.state;
    if (state === 'default' || state === 'done' || state === 'ready') return json;
    if (Date.now() > deadline) throw new Error(`Podcast project ${projectId} timed out (state=${state})`);
    await wait(intervalMs);
  }
}

// Download rendered podcast audio. The Studio export path is version-sensitive;
// confirm against https://elevenlabs.io/docs at implementation time.
// Strategy: list snapshots for the project, then stream the latest snapshot.
export async function downloadPodcastAudio({ apiKey, projectId }, fetchImpl) {
  const snapsUrl = `${BASE}/v1/studio/projects/${projectId}/snapshots`;
  const snapsRes = await call(snapsUrl, { headers: { 'xi-api-key': apiKey } }, fetchImpl);
  const snaps = await snapsRes.json();
  const list = snaps.snapshots ?? snaps;
  const latest = list[list.length - 1];
  const snapId = latest.project_snapshot_id ?? latest.snapshot_id ?? latest.id;
  const streamUrl = `${BASE}/v1/studio/projects/${projectId}/snapshots/${snapId}/stream`;
  const res = await call(streamUrl, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ convert_to_mpeg: true }),
  }, fetchImpl);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd tools/audio && node --test lib/elevenlabs.test.js`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/audio/lib/elevenlabs.js tools/audio/lib/elevenlabs.test.js
git commit -m "feat(audio): ElevenLabs narration + podcast REST client"
```

> **Implementation verification (not a code step):** `downloadPodcastAudio` and `pollProjectUntilDone` use the Studio project/snapshot endpoints, whose exact field names vary by API version. During Task 12's live run, confirm shapes against current ElevenLabs docs and adjust the field accessors if needed. The unit-tested narration path and request construction are stable.

---

## Task 7: Upload + manifest (`lib/upload.js`)

**Files:**
- Create: `tools/audio/lib/upload.js`
- Test: `tools/audio/lib/upload.test.js`

- [ ] **Step 1: Write failing tests with a mock bucket**

`tools/audio/lib/upload.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadArtifacts, buildManifest } from './upload.js';

function mockBucket(store) {
  return {
    file(path) {
      return {
        async save(buf, opts) { store.push({ path, size: buf.length, opts }); },
      };
    },
  };
}

test('buildManifest lists available modes with durations', () => {
  const m = buildManifest('sample', { narration: { duration: 612.4 }, podcast: { duration: 480 } });
  assert.deepEqual(m.slug, 'sample');
  assert.deepEqual(Object.keys(m.modes).sort(), ['narration', 'podcast']);
  assert.equal(m.modes.narration.audio, 'audio/sample/narration.mp3');
  assert.equal(m.modes.narration.timings, 'audio/sample/narration.json');
});

test('uploadArtifacts writes files under audio/<slug>/ with cache headers', async () => {
  const store = [];
  await uploadArtifacts(mockBucket(store), 'sample', [
    { name: 'narration.mp3', buffer: Buffer.from('mp3'), contentType: 'audio/mpeg' },
    { name: 'narration.json', buffer: Buffer.from('{}'), contentType: 'application/json' },
  ]);
  assert.deepEqual(store.map(s => s.path), ['audio/sample/narration.mp3', 'audio/sample/narration.json']);
  assert.match(store[0].opts.metadata.cacheControl, /max-age/);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd tools/audio && node --test lib/upload.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tools/audio/lib/upload.js`**

```js
const CACHE = 'public, max-age=31536000, immutable';

export function buildManifest(slug, modes) {
  const out = { slug, modes: {} };
  for (const [mode, info] of Object.entries(modes)) {
    out.modes[mode] = {
      audio: `audio/${slug}/${mode}.mp3`,
      timings: `audio/${slug}/${mode}.json`,
      duration: info.duration,
    };
  }
  return out;
}

export async function uploadArtifacts(bucket, slug, files) {
  for (const f of files) {
    await bucket.file(`audio/${slug}/${f.name}`).save(f.buffer, {
      contentType: f.contentType,
      metadata: { cacheControl: CACHE },
      resumable: false,
    });
  }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd tools/audio && node --test lib/upload.test.js`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/audio/lib/upload.js tools/audio/lib/upload.test.js
git commit -m "feat(audio): Firebase Storage upload + manifest builder"
```

---

## Task 8: CLI arg parser (`lib/cli.js`)

**Files:**
- Create: `tools/audio/lib/cli.js`
- Test: `tools/audio/lib/cli.test.js`

- [ ] **Step 1: Write failing tests**

`tools/audio/lib/cli.test.js`:

```js
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
```

- [ ] **Step 2: Run, verify fail**

Run: `cd tools/audio && node --test lib/cli.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tools/audio/lib/cli.js`**

```js
const MODES = new Set(['narration', 'podcast', 'both']);

export function parseArgs(argv) {
  const a = { mode: 'both', dryRun: false, article: null };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--article') a.article = argv[++i];
    else if (t === '--mode') a.mode = argv[++i];
    else if (t === '--dry-run') a.dryRun = true;
    else throw new Error(`Unknown argument: ${t}`);
  }
  if (!a.article) throw new Error('Missing required --article <slug|all>');
  if (!MODES.has(a.mode)) throw new Error(`Invalid --mode: ${a.mode} (narration|podcast|both)`);
  return a;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd tools/audio && node --test lib/cli.test.js`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/audio/lib/cli.js tools/audio/lib/cli.test.js
git commit -m "feat(audio): CLI argument parser"
```

---

## Task 9: Orchestration entry point (`build-audio.mjs`)

This wires the tested units together. It performs I/O (filesystem, env, network, firebase-admin) so it is validated with `node --check` + the live run in Task 12, not a unit test.

**Files:**
- Create: `tools/audio/build-audio.mjs`

- [ ] **Step 1: Implement `tools/audio/build-audio.mjs`**

```js
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import process from 'node:process';
import admin from 'firebase-admin';

import { parseArgs } from './lib/cli.js';
import { extractBlocks } from './lib/extract.js';
import { chunkBlocks, JOIN_SEPARATOR } from './lib/chunk.js';
import { estimateCost } from './lib/cost.js';
import { mapNarration } from './lib/map.js';
import {
  synthesizeWithTimestamps, createPodcast, pollProjectUntilDone, downloadPodcastAudio,
} from './lib/elevenlabs.js';
import { uploadArtifacts, buildManifest } from './lib/upload.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = resolve(__dirname, '../../articles');

function env(name, required = true) {
  const v = process.env[name];
  if (required && !v) throw new Error(`Missing env ${name}`);
  return v;
}

function articleSlugs(arg) {
  if (arg !== 'all') return [arg];
  return readdirSync(ARTICLES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);
}

function readArticleHtml(slug) {
  return readFileSync(resolve(ARTICLES_DIR, slug, 'index.html'), 'utf8');
}

async function buildNarration(slug, blocks, cfg) {
  const chunkGroups = chunkBlocks(blocks);
  const audioParts = [];
  const alignments = [];
  const chunks = [];
  for (const group of chunkGroups) {
    const text = group.map(b => b.text).join(JOIN_SEPARATOR);
    const { audio, alignment } = await synthesizeWithTimestamps(text, {
      apiKey: cfg.apiKey, voiceId: cfg.narrationVoiceId, modelId: cfg.modelId,
    });
    const dur = alignment.character_end_times_seconds.at(-1) ?? 0;
    audioParts.push(audio);
    alignments.push(alignment);
    chunks.push({ blocks: group, text, audioDuration: dur });
  }
  const timings = mapNarration(chunks, alignments);
  return { mp3: Buffer.concat(audioParts), json: timings };
}

async function buildPodcast(slug, blocks, cfg) {
  const text = blocks.map(b => b.text).join('\n\n');
  const { projectId } = await createPodcast({
    apiKey: cfg.apiKey, modelId: cfg.modelId,
    source: { type: 'text', text },
    hostVoiceId: cfg.podcastHostVoiceId, guestVoiceId: cfg.podcastGuestVoiceId,
    instructionsPrompt: 'Contemplative, thoughtful two-host discussion. Calm pacing, no hype.',
  });
  await pollProjectUntilDone({ apiKey: cfg.apiKey, projectId });
  const mp3 = await downloadPodcastAudio({ apiKey: cfg.apiKey, projectId });
  return { mp3, json: { duration: 0, transcript: [] } }; // transcript best-effort; fill if project exposes it
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cfg = {
    apiKey: env('ELEVENLABS_API_KEY'),
    modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
    narrationVoiceId: env('ELEVENLABS_NARRATION_VOICE_ID', args.mode !== 'podcast'),
    podcastHostVoiceId: env('ELEVENLABS_PODCAST_HOST_VOICE_ID', args.mode !== 'narration'),
    podcastGuestVoiceId: env('ELEVENLABS_PODCAST_GUEST_VOICE_ID', args.mode !== 'narration'),
  };

  let bucket = null;
  if (!args.dryRun) {
    admin.initializeApp({ storageBucket: env('FIREBASE_STORAGE_BUCKET') });
    bucket = admin.storage().bucket();
  }

  for (const slug of articleSlugs(args.article)) {
    const blocks = extractBlocks(readArticleHtml(slug));
    console.log(`\n[${slug}] ${blocks.length} blocks. ${estimateCost(blocks).summary}`);
    if (args.dryRun) continue;

    const modes = {};
    const files = [];
    if (args.mode === 'narration' || args.mode === 'both') {
      const n = await buildNarration(slug, blocks, cfg);
      files.push(
        { name: 'narration.mp3', buffer: n.mp3, contentType: 'audio/mpeg' },
        { name: 'narration.json', buffer: Buffer.from(JSON.stringify(n.json)), contentType: 'application/json' },
      );
      modes.narration = { duration: n.json.duration };
      console.log(`[${slug}] narration ${n.json.duration}s, ${n.mp3.length} bytes`);
    }
    if (args.mode === 'podcast' || args.mode === 'both') {
      const p = await buildPodcast(slug, blocks, cfg);
      files.push(
        { name: 'podcast.mp3', buffer: p.mp3, contentType: 'audio/mpeg' },
        { name: 'podcast.json', buffer: Buffer.from(JSON.stringify(p.json)), contentType: 'application/json' },
      );
      modes.podcast = { duration: p.json.duration };
      console.log(`[${slug}] podcast ${p.mp3.length} bytes`);
    }
    const manifest = buildManifest(slug, modes);
    files.push({ name: 'manifest.json', buffer: Buffer.from(JSON.stringify(manifest)), contentType: 'application/json' });
    await uploadArtifacts(bucket, slug, files);
    console.log(`[${slug}] uploaded ${files.length} files to audio/${slug}/`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Syntax-check**

Run: `cd tools/audio && node --check build-audio.mjs`
Expected: no output (valid).

- [ ] **Step 3: Dry-run against real articles (no network/secrets needed)**

Run: `cd tools/audio && node build-audio.mjs --article all --dry-run`
Expected: prints block counts + cost summary per article; no uploads.

- [ ] **Step 4: Commit**

```bash
git add tools/audio/build-audio.mjs
git commit -m "feat(audio): build orchestration CLI with dry-run"
```

---

## Task 10: Storage rules, CORS, firebase.json

**Files:**
- Create: `storage.rules`
- Create: `tools/audio/cors.json`
- Modify: `firebase.json`

- [ ] **Step 1: Create `storage.rules`**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /audio/{allPaths=**} {
      allow read: if true;        // public audio assets
      allow write: if false;      // only the build tool (admin SDK) writes
    }
    match /{path=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Create `tools/audio/cors.json`**

```json
[
  {
    "origin": ["https://intentional-ai-deployment.web.app", "https://intentional-ai-deployment.firebaseapp.com", "http://localhost:8080"],
    "method": ["GET", "HEAD"],
    "responseHeader": ["Content-Type", "Range", "Accept-Ranges"],
    "maxAgeSeconds": 3600
  }
]
```

- [ ] **Step 3: Register storage rules in `firebase.json`**

Add a top-level `"storage"` key alongside the existing `"firestore"` block:

```json
  "storage": {
    "rules": "storage.rules"
  },
```

- [ ] **Step 4: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('firebase.json','utf8')); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 5: Commit**

```bash
git add storage.rules tools/audio/cors.json firebase.json
git commit -m "feat(audio): Firebase Storage rules + CORS for audio assets"
```

> CORS is applied once with `gsutil cors set tools/audio/cors.json gs://<bucket>` during deploy (Task 12), and rules deploy with `firebase deploy --only storage`. These are deploy actions — do not run them until the user gives the go-ahead.

---

## Task 11: Runtime player (`shared/audio-player.js` + `.css`)

Built incrementally. The only unit-testable piece is `findActiveWordIndex` (extracted into the same file and exported); the rest is verified in the browser.

**Files:**
- Create: `shared/audio-player.css`
- Create: `shared/audio-player.js`
- Test: `tools/audio/lib/find-active-word.test.js` (imports the exported pure fn)

- [ ] **Step 1: Write failing test for the active-word search**

`tools/audio/lib/find-active-word.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findActiveWordIndex } from '../../../shared/audio-player.js';

const words = [
  { start: 0, end: 0.5 }, { start: 0.5, end: 1.0 }, { start: 1.0, end: 2.0 },
];

test('returns -1 before first word', () => {
  assert.equal(findActiveWordIndex(words, -0.1), -1);
});
test('finds the word covering t', () => {
  assert.equal(findActiveWordIndex(words, 0.6), 1);
  assert.equal(findActiveWordIndex(words, 1.5), 2);
});
test('clamps to last word after the end', () => {
  assert.equal(findActiveWordIndex(words, 99), 2);
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd tools/audio && node --test lib/find-active-word.test.js`
Expected: FAIL — module/exported fn not found.

> Note: `shared/audio-player.js` imports `audio-tokenize.js` (browser-safe) and uses only standard JS at module top-level, so Node can import it for this unit test. All DOM access is inside functions that are not called on import.

- [ ] **Step 3: Implement `shared/audio-player.js`**

```js
import { SELECTOR, blockNarrationText, tokenizeWords } from './audio-tokenize.js';

// ---- Pure: binary search for the word covering time t ----
export function findActiveWordIndex(words, t) {
  if (!words.length || t < words[0].start) return -1;
  let lo = 0, hi = words.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].start <= t) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans;
}

// ---- Everything below runs only in the browser ----
const slug = (typeof document !== 'undefined') && document.body?.dataset?.slug;
const proseEl = (typeof document !== 'undefined') && document.querySelector('.article__prose');
const supported = typeof window !== 'undefined' && 'Highlight' in window && CSS?.highlights;

if (slug && proseEl) init();

async function init() {
  const manifest = await loadManifest(slug);
  if (!manifest) return;                       // no audio → no player
  const ui = buildPlayer(manifest);
  document.body.appendChild(ui.root);
}

async function loadManifest(slug) {
  try {
    const url = await storageUrl(`audio/${slug}/manifest.json`);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Resolve a Storage object path to a download URL via the Firebase config.
async function storageUrl(path) {
  const { default: cfgMod } = { default: null };
  // Public bucket: use the standard download URL form.
  const bucket = (await getBucket());
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

async function getBucket() {
  // Prefer Hosting-served init.json; fall back to local config module.
  try {
    const r = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    if (r.ok) { const c = await r.json(); if (c.storageBucket) return c.storageBucket; }
  } catch {}
  try { const m = await import('./firebase-config.js'); return m.firebaseConfig.storageBucket; } catch {}
  return null;
}

function buildPlayer(manifest) {
  const root = document.createElement('div');
  root.className = 'aw-player';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Article audio player');

  const audio = new Audio();
  audio.preload = 'none';

  const modes = Object.keys(manifest.modes);          // ['narration','podcast']
  let current = modes.includes('narration') ? 'narration' : modes[0];
  let timings = null;                                 // narration word data
  let wordIndex = [];                                 // flattened [{el-less} words + range builder]
  let following = true;

  root.innerHTML = `
    <button class="aw-play" aria-label="Play">▶</button>
    <input class="aw-seek" type="range" min="0" max="1000" value="0" aria-label="Seek">
    <span class="aw-time">0:00</span>
    <select class="aw-speed" aria-label="Playback speed">
      <option value="1">1×</option><option value="1.25">1.25×</option>
      <option value="1.5">1.5×</option><option value="2">2×</option>
    </select>
    ${modes.length > 1 ? `<div class="aw-modes" role="tablist">
      ${modes.map(m => `<button class="aw-mode" data-mode="${m}" role="tab">${m}</button>`).join('')}
    </div>` : ''}
  `;

  const playBtn = root.querySelector('.aw-play');
  const seek = root.querySelector('.aw-seek');
  const timeEl = root.querySelector('.aw-time');

  async function setMode(mode) {
    current = mode;
    const wasPlaying = !audio.paused;
    audio.pause();
    audio.src = await storageUrl(manifest.modes[mode].audio);
    clearHighlight();
    if (mode === 'narration') {
      timings = await (await fetch(await storageUrl(manifest.modes[mode].timings))).json();
      wordIndex = buildWordIndex(timings);
    } else {
      timings = null; wordIndex = [];
    }
    root.querySelectorAll('.aw-mode').forEach(b =>
      b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    if (wasPlaying) audio.play();
  }

  playBtn.addEventListener('click', async () => {
    if (!audio.src) await setMode(current);
    if (audio.paused) { audio.play(); } else { audio.pause(); }
  });
  audio.addEventListener('play', () => { playBtn.textContent = '❚❚'; playBtn.setAttribute('aria-label', 'Pause'); tick(); });
  audio.addEventListener('pause', () => { playBtn.textContent = '▶'; playBtn.setAttribute('aria-label', 'Play'); });
  root.querySelector('.aw-speed').addEventListener('change', e => { audio.playbackRate = +e.target.value; });
  seek.addEventListener('input', () => { if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration; });
  root.querySelectorAll('.aw-mode').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  window.addEventListener('scroll', () => { following = false; }, { passive: true });

  function tick() {
    if (audio.paused) return;
    const t = audio.currentTime;
    if (audio.duration) {
      seek.value = String((t / audio.duration) * 1000);
      timeEl.textContent = fmt(t);
    }
    if (current === 'narration' && wordIndex.length) highlightAt(t);
    requestAnimationFrame(tick);
  }

  return { root };

  // ----- narration highlight via CSS Custom Highlight API -----
  function buildWordIndex(timings) {
    // Map each timing-word to a live DOM word by re-tokenizing blocks in order.
    const blockEls = [...proseEl.querySelectorAll(SELECTOR)].filter(el => !el.closest('figure'));
    const flat = [];
    timings.blocks.forEach((tb) => {
      const el = blockEls[tb.index];
      if (!el) return;
      const tokens = tokenizeWords(blockNarrationText(el));
      tb.words.forEach((w, i) => {
        const tok = tokens[i];
        if (!tok) return;
        flat.push({ el, start: w.start, end: w.end, charStart: tok.charStart, charEnd: tok.charEnd });
      });
    });
    return flat;
  }

  function rangeForWord(w) {
    // Walk text nodes of the block (skipping footnote sups) to find char offsets.
    const range = document.createRange();
    let acc = 0, set = false;
    const walker = document.createTreeWalker(w.el, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        return n.parentElement?.closest('sup.footnote-ref') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    // text in walker is raw; collapse handled by matching tokenized offsets approximately
    while ((node = walker.nextNode())) {
      const len = node.textContent.length;
      if (!set && acc + len > w.charStart) { range.setStart(node, Math.max(0, w.charStart - acc)); set = true; }
      if (set && acc + len >= w.charEnd) { range.setEnd(node, Math.min(len, w.charEnd - acc)); return range; }
      acc += len;
    }
    return set ? range : null;
  }

  let lastIdx = -1;
  function highlightAt(t) {
    const idx = findActiveWordIndex(wordIndex, t);
    if (idx === lastIdx || idx < 0) return;
    lastIdx = idx;
    if (!supported) return;                  // graceful: no highlight, audio still plays
    const w = wordIndex[idx];
    const range = rangeForWord(w);
    if (!range) return;
    const hl = new Highlight(range);
    CSS.highlights.set('aw-active', hl);
    if (following && !prefersReducedMotion()) {
      const rect = range.getBoundingClientRect();
      const target = window.scrollY + rect.top - window.innerHeight / 2;
      window.scrollTo({ top: target, behavior: 'smooth' });
    }
  }

  function clearHighlight() { if (supported) CSS.highlights.delete('aw-active'); lastIdx = -1; }
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
function fmt(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run unit test, verify pass**

Run: `cd tools/audio && node --test lib/find-active-word.test.js`
Expected: PASS — 3 tests.

- [ ] **Step 5: Implement `shared/audio-player.css`**

```css
/* Contemplative audio player — aligns with shared/design-system.css */
.aw-player {
  position: fixed; left: 50%; bottom: 1.5rem; transform: translateX(-50%);
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.5rem 0.9rem; border-radius: 999px;
  background: rgba(16,16,20,0.82); backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: 0 6px 30px rgba(0,0,0,0.35);
  font-family: 'IBM Plex Sans', system-ui, sans-serif; color: #e8e6e0;
  z-index: 50; max-width: min(92vw, 560px);
}
.aw-play { width: 2.1rem; height: 2.1rem; border-radius: 50%; border: none;
  background: #e8e6e0; color: #16161e; cursor: pointer; font-size: 0.8rem; }
.aw-seek { flex: 1; accent-color: #c9a86a; cursor: pointer; }
.aw-time { font-variant-numeric: tabular-nums; font-size: 0.8rem; opacity: 0.8; min-width: 2.6rem; }
.aw-speed { background: transparent; color: inherit; border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px; padding: 0.1rem 0.3rem; }
.aw-modes { display: flex; gap: 0.25rem; }
.aw-mode { text-transform: capitalize; background: transparent; color: inherit;
  border: 1px solid rgba(255,255,255,0.15); border-radius: 999px; padding: 0.15rem 0.6rem;
  font-size: 0.78rem; cursor: pointer; }
.aw-mode[aria-selected="true"] { background: #c9a86a; color: #16161e; border-color: #c9a86a; }

/* Karaoke highlight via CSS Custom Highlight API */
::highlight(aw-active) {
  background: rgba(201,168,106,0.28);
  color: inherit;
  text-decoration: underline;
  text-decoration-color: rgba(201,168,106,0.9);
  text-underline-offset: 0.18em;
}
@media (prefers-reduced-motion: reduce) {
  .aw-player * { scroll-behavior: auto; }
}
```

- [ ] **Step 6: Commit**

```bash
git add shared/audio-player.js shared/audio-player.css tools/audio/lib/find-active-word.test.js
git commit -m "feat(audio): in-article player with CSS Highlight karaoke sync"
```

---

## Task 12: Wire the player into all five articles

**Files:**
- Modify: `articles/before-you-automate/index.html`, `articles/friction-reduction/index.html`, `articles/cost-of-speed/index.html`, `articles/what-ai-cant-see/index.html`, `articles/designing-around-gaps/index.html`

- [ ] **Step 1: Add the stylesheet link** in each article `<head>`, after the existing `highlights.css` line:

```html
  <link rel="stylesheet" href="../../shared/audio-player.css">
```

- [ ] **Step 2: Add the player script** in each article, immediately after the existing `highlights.js` module script near `</body>`:

```html
  <script type="module" src="../../shared/audio-player.js"></script>
```

(The player self-mounts from `document.body.dataset.slug`; no extra markup needed.)

- [ ] **Step 3: Syntax sanity — confirm each file still has matching tags**

Run: `cd "$(git rev-parse --show-toplevel)" && for f in articles/*/index.html; do grep -c 'audio-player' "$f"; done`
Expected: each prints `2` (css + js).

- [ ] **Step 4: Commit**

```bash
git add articles/*/index.html
git commit -m "feat(audio): mount audio player on all five articles"
```

---

## Task 13: Generate audio for real, verify, document

This task spends money and writes to Firebase. **Pause for the user's go-ahead before running anything network/deploy here** (per project convention: build/verify locally, wait for explicit "go" before pushing/deploying).

**Files:**
- Modify: `PROJECT_STATUS.md`

- [ ] **Step 1: Confirm secrets present**

Create `tools/audio/.env` from `.env.example` (real keys, gitignored) and place `service-account.json`. Verify: `cd tools/audio && node -e "import('dotenv/config').catch(()=>{}); console.log(!!process.env.ELEVENLABS_API_KEY)"` (or `source .env`).

- [ ] **Step 2: Dry-run all articles**

Run: `cd tools/audio && node build-audio.mjs --article all --dry-run`
Expected: per-article block counts + cost estimate.

- [ ] **Step 3: Generate one article, narration only (smallest spend), then verify**

Run: `cd tools/audio && node --env-file=.env build-audio.mjs --article friction-reduction --mode narration`
Expected: logs duration + byte size, "uploaded N files".
Then confirm the manifest is publicly readable:
Run: `curl -s "https://firebasestorage.googleapis.com/v0/b/<bucket>/o/$(python3 -c "import urllib.parse;print(urllib.parse.quote('audio/friction-reduction/manifest.json',safe=''))")?alt=media"`
Expected: JSON manifest with a `narration` mode.

> If the podcast download (Task 6 note) needs endpoint adjustments, fix `lib/elevenlabs.js` now against current docs, re-run, and re-commit.

- [ ] **Step 4: Apply CORS + deploy storage rules** (deploy actions — only after go-ahead)

Run: `gsutil cors set tools/audio/cors.json gs://<bucket>` and `firebase deploy --only storage`

- [ ] **Step 5: Browser verification**

Run: `cd "$(git rev-parse --show-toplevel)" && python3 -m http.server 8080`
Open `http://localhost:8080/articles/friction-reduction/`. Verify: player appears; play starts narration; the active word highlights and the page auto-scrolls; speed control works; toggling to Podcast (once generated) swaps audio; manual scroll stops auto-follow. Test with `prefers-reduced-motion` enabled (no smooth scroll). Confirm existing text-selection highlights/reactions still work while audio plays.

- [ ] **Step 6: Generate the rest** (after the single-article result looks right)

Run: `cd tools/audio && node --env-file=.env build-audio.mjs --article all --mode both`

- [ ] **Step 7: Update `PROJECT_STATUS.md`**

Add an "Audio Mode" subsection documenting: the two modes, the build command (`node --env-file=.env tools/audio/build-audio.mjs --article <slug|all> --mode <narration|podcast|both>`), required env vars, and that assets live in Firebase Storage under `audio/{slug}/`.

- [ ] **Step 8: Commit**

```bash
git add PROJECT_STATUS.md
git commit -m "docs(audio): document audio mode build pipeline in PROJECT_STATUS"
```

---

## Self-Review

**Spec coverage:**
- Two modes per article → Tasks 9 (`buildNarration`/`buildPodcast`), 11 (mode toggle). ✓
- Pre-generated static assets → Tasks 1–9. ✓
- ElevenLabs for both → Task 6. ✓
- Word-level karaoke + auto-scroll → Tasks 5 (timings), 11 (highlight + scroll). ✓
- Podcast end-to-end via Create Podcast → Task 6/9. ✓
- Firebase Storage hosting → Tasks 7, 10. ✓
- Lazy load, graceful absence → Task 11 (`loadManifest` returns null → no player). ✓
- Coexistence with highlights.js → CSS Custom Highlight API (no DOM mutation), verified Task 13 Step 5. ✓
- prefers-reduced-motion → Task 11 + CSS. ✓
- Footnotes skipped → `blockNarrationText` (Task 2), verified Task 3. ✓
- Tests for extraction + mapping → Tasks 2,3,5. ✓
- Files list, cost → Task 4, plan File Structure. ✓

**Placeholder scan:** Podcast `transcript` is intentionally `[]` (best-effort per spec §4.5) — not a placeholder; the spec permits omitting it. The Task 6 "implementation verification" note flags version-sensitive Studio endpoints as a *verify* step, with stable unit-tested request construction. No TODO/TBD in code.

**Type consistency:** `narration.json` shape `{ duration, blocks:[{ index, words:[{text,start,end}] }] }` is produced by `mapNarration` (Task 5) and consumed by `buildWordIndex` (Task 11). `manifest.modes[mode].{audio,timings,duration}` produced by `buildManifest` (Task 7), consumed by player `setMode` (Task 11). `findActiveWordIndex(words,t)` defined and tested (Task 11). Consistent. ✓

**Known risk:** `rangeForWord` maps collapsed-whitespace token offsets onto raw DOM text-node offsets; these can drift when prose has irregular inline whitespace. Task 13 Step 5 explicitly verifies highlight alignment in the browser; if drift appears, the fix is to compute offsets against a per-block running text built with the same collapse rule (documented in the Shared Word Contract).
