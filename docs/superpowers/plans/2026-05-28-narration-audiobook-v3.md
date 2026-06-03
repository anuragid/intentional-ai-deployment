# Narration Audiobook (v3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the already-shipped per-article **Narration** mode to an **audiobook-grade** read using ElevenLabs **`eleven_v3`** with sparse, contemplative inline delivery tags (inserted by an LLM "Enhance" replica step in Claude), and rebuild karaoke word timings from the **Forced Alignment API** instead of inline TTS timestamps. Narration only — podcast is out of scope. Pure audiobook: expressive voice only, no background music, no SFX.

**Source of truth:** `docs/superpowers/specs/2026-05-28-narration-audiobook-v3-design.md`.

**Architecture:** The two decoupled halves are unchanged: an offline Node CLI (`tools/audio/`) produces artifacts and uploads them to Firebase Storage; the browser player (`shared/audio-player.js`) lazily consumes them. **Only the narration build path changes** — a new **7-stage pipeline**: extract → tag → synthesize (v3) → concat → forced-align → map → upload. Stages 2, 3, 5, 6 are new/rewritten; the rest reuse existing, tested modules. The player and upload/manifest layer are untouched: `narration.json` keeps the exact `{ duration, blocks:[{ index, words:[{text,start,end}] }] }` shape `buildWordIndex` already consumes.

**Tech Stack:** Node ≥ 20 (built-in `node:test`, `fetch`, `--env-file`), `node-html-parser`, `firebase-admin`, ElevenLabs REST (`eleven_v3` TTS + Forced Alignment), Anthropic Messages REST (Claude tagging), vanilla browser ESM, CSS Custom Highlight API.

---

## The clean / tagged contract (read first)

Everything downstream depends on one invariant: the **clean** text and the **tagged** text are word-for-word identical except for additive bracketed delivery tags.

- `clean` = `extractBlocks(html)[i].text` = `blockNarrationText(el)` (footnote sups stripped, whitespace collapsed). This is the string the **player re-tokenizes** the live DOM into (`buildWordIndex` → `tokenizeWords(blockNarrationText(el))`), and the string sent to **forced alignment**. It never carries tags.
- `tagged` = `clean` + additive bracketed tags (`[pause]`, `[sighs]`, light emphasis). Used **only** for the v3 TTS call.
- Enforcement (not trust): `lib/tag.js` asserts `collapseWhitespace(stripTags(tagged)) === clean` per block; on mismatch it falls back to `tagged = clean` and warns. A stray model edit can therefore never desync downstream word timings.
- The forced-aligner only ever sees `clean`, so its `words[]` contain only spoken words in reading order — the same order `mapAlignedWords` walks the blocks in and the same order the player re-tokenizes. Word *i* refers to the same word everywhere.

The clean transcript sent to alignment = the per-block `clean` text joined by `JOIN_SEPARATOR` (`'\n\n'`) — exactly the join `chunkBlocks` and the old mapping used.

## Real symbols this plan builds on (confirmed in tree)

- `shared/audio-tokenize.js`: `SELECTOR`, `collapseWhitespace(s)`, `blockNarrationText(node)`, `tokenizeWords(text)` → `[{text,charStart,charEnd}]`.
- `tools/audio/lib/chunk.js`: `JOIN_SEPARATOR`, `capBlocks(blocks,maxChars)`, `chunkBlocks(blocks,maxChars=4500)`.
- `tools/audio/lib/extract.js`: `extractBlocks(html)` → `[{index,text}]`.
- `tools/audio/lib/encode.js`: `encodeMp3FromPcm(pcm,opts)`, `probeDurationSeconds(buffer)`, `concatMp3(buffers,opts)`.
- `tools/audio/lib/pcm.js`: `pcmDurationSeconds(byteLength,sampleRate=44100,bytesPerSample=2)`.
- `tools/audio/lib/elevenlabs.js`: `synthesizeWithTimestamps(text,opts,fetchImpl)` (v2 path, kept) + a private `call(url,opts,fetchImpl)` helper; we add `synthesizeV3()`.
- `tools/audio/lib/upload.js`: `buildManifest(slug,modes)`, `uploadArtifacts(bucket,slug,files)`.
- `tools/audio/build-audio.mjs`: `buildNarration(slug,blocks,cfg)` to be rewritten; `cfg` currently `{ apiKey, modelId, narrationOutputFormat, narrationVoiceId, ... }`.
- `shared/audio-player.js`: `buildWordIndex(timings)` iterates `timings.blocks` by `tb.index`, re-tokenizes the live block, matches `tb.words[i]` to token *i*. **No player change.**

## File Structure

**New — build tool:**
- `tools/audio/lib/tag.js` (+ `tag.test.js`) — `stripTags(text)` (pure) + `tagBlocks(blocks, opts)` LLM Enhance-replica producing `{index, clean, tagged}` per block.
- `tools/audio/lib/align.js` (+ `align.test.js`) — `forcedAlign({apiKey,audio,transcript,contentType}, fetchImpl)` Forced Alignment client.
- `tools/audio/lib/align-map.js` (+ `align-map.test.js`) — `mapAlignedWords(blocks, words)` → `narration.json` object.

**Modified:**
- `tools/audio/lib/elevenlabs.js` — add `synthesizeV3()` (v3 plain TTS, no timestamps, no stitching).
- `tools/audio/build-audio.mjs` — rewrite `buildNarration` to the 7-stage v3 flow; add Anthropic config + `eleven_v3` model id; update `--dry-run` cost lines.
- `.env.example` (root) — add `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, narration v3 model + output-format vars.
- `tools/audio/.env.example` — same additions, mirrored.
- `PROJECT_STATUS.md` — document the audiobook narration path (tagging + forced alignment).

**Unchanged (load-bearing, confirmed compatible):** `shared/audio-tokenize.js`, `shared/audio-player.js`, `shared/audio-player.css`; `lib/extract.js`, `lib/chunk.js`, `lib/encode.js`, `lib/pcm.js`, `lib/upload.js`. `lib/map.js` is retired from the v3 path (kept only for the legacy v2 narration / future podcast effort).

---

## Task 1: Config scaffold for the tagging step + env additions

No code logic yet — wire the new env vars the tagging stage will read, in both env templates, so later tasks have a documented home for `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` / the v3 model + format. The Anthropic call uses Node ≥20 `fetch` against the Messages REST API directly — **no new dependency required** (we do not add `@anthropic-ai/sdk`; the direct-fetch approach matches the existing ElevenLabs client style).

**Files:**
- Modify: `.env.example` (root)
- Modify: `tools/audio/.env.example`

- [ ] **Step 1: Add the new vars to root `.env.example`**

Append after the existing `ELEVENLABS_API_KEY` block:

```bash
# Narration audiobook (v3) — TTS model + output format.
# v3 expressive read; ~5000-char-per-request limit; no request stitching.
ELEVENLABS_NARRATION_MODEL_ID=eleven_v3
# Creator tier: mp3_44100_192. Pro tier can switch to pcm_44100.
ELEVENLABS_NARRATION_OUTPUT_FORMAT=mp3_44100_192

# Anthropic (Claude) — the "Enhance" replica that adds sparse v3 delivery tags.
# Used only by the offline audio build pipeline (tools/audio/lib/tag.js).
# Get one at https://console.anthropic.com/ -> API Keys
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-4-8
```

- [ ] **Step 2: Mirror the same additions into `tools/audio/.env.example`**

Add `ELEVENLABS_NARRATION_MODEL_ID=eleven_v3`, `ELEVENLABS_NARRATION_OUTPUT_FORMAT=mp3_44100_192`, `ANTHROPIC_API_KEY=`, `ANTHROPIC_MODEL=claude-opus-4-8` (keep the existing `ELEVENLABS_MODEL_ID` line for the legacy v2 path).

- [ ] **Step 3: Verify no secrets are tracked**

Run: `cd "$(git rev-parse --show-toplevel)" && git check-ignore tools/audio/.env tools/audio/service-account.json && echo ok`
Expected: prints the two paths then `ok` (both ignored).

- [ ] **Step 4: Commit**

```bash
git add .env.example tools/audio/.env.example
git commit -m "chore(audio): env scaffold for v3 narration + Claude tagging"
```

---

## Task 2: `stripTags` + the additive-only invariant (TDD)

The single safety guard for the whole pipeline. `stripTags` removes only bracketed delivery tags; combined with `collapseWhitespace` it must reproduce `clean` exactly. We TDD the pure function and the invariant here, before the LLM module that relies on it.

**Files:**
- Create: `tools/audio/lib/tag.js` (pure `stripTags` only in this task)
- Test: `tools/audio/lib/tag.test.js`

- [ ] **Step 1: Write failing tests**

`tools/audio/lib/tag.test.js`:

```js
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
```

- [ ] **Step 2: Run, verify fail**

Run: `cd tools/audio && node --test lib/tag.test.js`
Expected: FAIL — `stripTags` not exported / module not found.

- [ ] **Step 3: Implement `stripTags` in `tools/audio/lib/tag.js`**

```js
// Remove only bracketed delivery tags (e.g. [pause], [sighs]); leave every
// spoken word and ordinary punctuation untouched. Tags are additive insertions,
// so stripping them must reproduce the clean text (modulo whitespace).
export function stripTags(text) {
  return text.replace(/\[[^\]]*\]/g, '');
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd tools/audio && node --test lib/tag.test.js`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/audio/lib/tag.js tools/audio/lib/tag.test.js
git commit -m "feat(audio): stripTags + additive-only tag invariant"
```

---

## Task 3: `tagBlocks` — Claude "Enhance" replica (module + node --check; live call gated)

Add `tagBlocks` to `tag.js`. It calls Claude **per block** with an injectable `callImpl`, then enforces the §6 invariant from Task 2 (fallback `tagged = clean` on any mismatch). The prompt assembly and the validation/fallback are unit-testable with a mocked `callImpl`; the live network call is I/O (validated by `node --check` + the gated live run in Task 8).

**Files:**
- Modify: `tools/audio/lib/tag.js` (add `tagBlocks`, prompt builder, default REST `callImpl`)
- Modify: `tools/audio/lib/tag.test.js` (add `tagBlocks` tests with mock `callImpl`)

- [ ] **Step 1: Write failing tests (mock the LLM via `callImpl`)**

Append to `tools/audio/lib/tag.test.js`:

```js
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
```

- [ ] **Step 2: Run, verify fail**

Run: `cd tools/audio && node --test lib/tag.test.js`
Expected: FAIL — `tagBlocks` not exported.

- [ ] **Step 3: Implement `tagBlocks` (+ prompt + default REST `callImpl`) in `tag.js`**

```js
import { collapseWhitespace } from '../../../shared/audio-tokenize.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// Sparse, contemplative, delivery-only tagging. The §6 strip-check is the
// real enforcement; the prompt just steers a good first attempt.
export function buildTagPrompt(clean) {
  return [
    'You are an audiobook director adding sparse, contemplative delivery cues',
    'to a single paragraph for an expressive TTS voice.',
    'RULES:',
    '- Return the paragraph VERBATIM. Do not change, add, reorder, or remove any',
    '  spoken word or its punctuation. Tags are ADDITIVE bracketed insertions only.',
    '- Use at most one tag for most paragraphs; a tag every few sentences at most.',
    '- Allowed delivery tags only: [pause], [sighs], [exhales], and light emphasis.',
    '- NO literal sound-effects ([door slams], [applause], music, ambience).',
    '- Quiet, reflective, never performative.',
    'Output ONLY the tagged paragraph, nothing else.',
    '',
    `Paragraph:\n${clean}`,
  ].join('\n');
}

// Default I/O impl: Anthropic Messages REST. Returns the model's text.
async function anthropicCall({ apiKey, model, prompt }, fetchImpl) {
  const f = fetchImpl || fetch;
  const res = await f(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text?.().catch(() => '') ?? '';
    throw new Error(`Anthropic ${res.status}: ${detail}`);
  }
  const json = await res.json();
  return (json.content?.[0]?.text ?? '').trim();
}

// blocks: [{index, text}]  ->  [{index, clean, tagged}]
// callImpl({apiKey, model, clean, prompt}) -> tagged string  (injectable for tests)
export async function tagBlocks(blocks, { apiKey, model, callImpl, onWarn = console.warn } = {}) {
  const call = callImpl || ((args, fetchImpl) => anthropicCall(args, fetchImpl));
  const out = [];
  for (const b of blocks) {
    const clean = b.text;
    const prompt = buildTagPrompt(clean);
    let tagged = clean;
    try {
      const raw = await call({ apiKey, model, clean, prompt });
      // Enforce the additive-only invariant; otherwise fall back safely.
      if (collapseWhitespace(stripTags(raw)) === clean) tagged = raw;
      else onWarn(`[tag] block ${b.index}: tag-strip mismatch, using clean text`);
    } catch (e) {
      onWarn(`[tag] block ${b.index}: ${e.message}; using clean text`);
    }
    out.push({ index: b.index, clean, tagged });
  }
  return out;
}
```

- [ ] **Step 4: Run, verify pass + syntax-check**

Run: `cd tools/audio && node --test lib/tag.test.js && node --check lib/tag.js`
Expected: PASS — 7 tests total (4 from Task 2 + 3 here); `node --check` silent.

- [ ] **Step 5: Commit**

```bash
git add tools/audio/lib/tag.js tools/audio/lib/tag.test.js
git commit -m "feat(audio): Claude Enhance-replica tagger with strip-check fallback"
```

---

## Task 4: `synthesizeV3()` in `elevenlabs.js` (TDD request construction)

A sibling to `synthesizeWithTimestamps`. Plain TTS: **no** `with-timestamps`, **no** `previous_request_ids` (unsupported on v3). Returns audio bytes only. Reuses the module's existing `call()` helper; `fetch` injectable.

**Files:**
- Modify: `tools/audio/lib/elevenlabs.js` (add `synthesizeV3`)
- Test: `tools/audio/lib/elevenlabs-v3.test.js`

- [ ] **Step 1: Write failing tests**

`tools/audio/lib/elevenlabs-v3.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeV3 } from './elevenlabs.js';

function mockFetch(cap, audioBytes) {
  return async (url, opts) => {
    cap.url = url; cap.opts = opts;
    return { ok: true, status: 200, arrayBuffer: async () => Uint8Array.from(audioBytes).buffer };
  };
}

test('synthesizeV3 posts plain TTS with model_id eleven_v3, no timestamps/stitching', async () => {
  const cap = {};
  const res = await synthesizeV3('Remove [pause] the obstacle.', {
    apiKey: 'k', voiceId: 'V', modelId: 'eleven_v3',
    outputFormat: 'mp3_44100_192',
    voiceSettings: { stability: 0.6, similarity_boost: 0.75, style: 0, speed: 0.95, use_speaker_boost: true },
  }, mockFetch(cap, [73, 68, 51])); // "ID3"

  assert.ok(cap.url.includes('/v1/text-to-speech/V'));
  assert.ok(!cap.url.includes('/with-timestamps'));      // plain endpoint
  assert.ok(cap.url.includes('output_format=mp3_44100_192'));
  assert.equal(cap.opts.headers['xi-api-key'], 'k');
  const body = JSON.parse(cap.opts.body);
  assert.equal(body.text, 'Remove [pause] the obstacle.'); // tagged text passes through
  assert.equal(body.model_id, 'eleven_v3');
  assert.ok(!('previous_request_ids' in body));          // v3 has no stitching
  assert.equal(body.voice_settings.speed, 0.95);
  assert.ok(Buffer.isBuffer(res.audio));
  assert.equal(res.audio.toString(), 'ID3');
});

test('synthesizeV3 surfaces a non-OK response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 422, text: async () => 'bad voice_settings' });
  await assert.rejects(
    synthesizeV3('x', { apiKey: 'k', voiceId: 'V', modelId: 'eleven_v3' }, fetchImpl),
    /422.*bad voice_settings/,
  );
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd tools/audio && node --test lib/elevenlabs-v3.test.js`
Expected: FAIL — `synthesizeV3` not exported.

- [ ] **Step 3: Implement `synthesizeV3` in `tools/audio/lib/elevenlabs.js`**

Add below `synthesizeWithTimestamps` (reuse the existing module-private `call`):

```js
// v3 audiobook TTS. Plain POST (no with-timestamps), no request stitching
// (eleven_v3 does not support previous_request_ids). Returns audio bytes only;
// karaoke timings come from the Forced Alignment API, not inline timestamps.
// `text` is the TAGGED chunk; voice_settings is the contemplative profile
// (drop any field v3 rejects — the response error is surfaced verbatim).
export async function synthesizeV3(text, {
  apiKey, voiceId, modelId = 'eleven_v3', outputFormat = 'mp3_44100_192', voiceSettings,
}, fetchImpl) {
  const url = `${BASE}/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`;
  const body = {
    text,
    model_id: modelId,
    ...(voiceSettings ? { voice_settings: voiceSettings } : {}),
  };
  const res = await call(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, fetchImpl);
  const ab = await res.arrayBuffer();
  return { audio: Buffer.from(ab) };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd tools/audio && node --test lib/elevenlabs-v3.test.js`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/audio/lib/elevenlabs.js tools/audio/lib/elevenlabs-v3.test.js
git commit -m "feat(audio): synthesizeV3 plain eleven_v3 TTS (no stitching)"
```

---

## Task 5: `lib/align.js` — Forced Alignment client (TDD request construction + decode)

One call per article aligns the full MP3 against the **clean** transcript. Multipart `file` (audio) + `text` (tag-free). Response: `{ characters:[{text,start,end}], words:[{text,start,end,loss}], loss }`. `fetch` injectable; we assert the multipart carries `file` + `text` and that `text` is tag-free.

**Files:**
- Create: `tools/audio/lib/align.js`
- Test: `tools/audio/lib/align.test.js`

- [ ] **Step 1: Write failing tests**

`tools/audio/lib/align.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forcedAlign } from './align.js';

function mockFetch(cap, response) {
  return async (url, opts) => {
    cap.url = url; cap.opts = opts;
    return { ok: true, status: 200, json: async () => response };
  };
}

const RESPONSE = {
  characters: [{ text: 'A', start: 0.0, end: 0.1 }],
  words: [{ text: 'AI', start: 0.0, end: 0.3, loss: 0.02 }],
  loss: 0.05,
};

test('forcedAlign posts multipart file + tag-free text to /v1/forced-alignment', async () => {
  const cap = {};
  const transcript = 'AI creates value.\n\nTools are tools.'; // NO tags
  const res = await forcedAlign({
    apiKey: 'k', audio: Buffer.from('ID3audio'), transcript, contentType: 'audio/mpeg',
  }, mockFetch(cap, RESPONSE));

  assert.ok(cap.url.includes('/v1/forced-alignment'));
  assert.equal(cap.opts.headers['xi-api-key'], 'k');
  assert.ok(cap.opts.body instanceof FormData);            // multipart
  assert.equal(cap.opts.body.get('text'), transcript);
  assert.ok(!/\[[^\]]*\]/.test(cap.opts.body.get('text'))); // tag-free
  assert.ok(cap.opts.body.has('file'));
  // never set content-type by hand for FormData (boundary is auto)
  assert.ok(!cap.opts.headers['content-type']);
  assert.deepEqual(res.words[0], { text: 'AI', start: 0.0, end: 0.3, loss: 0.02 });
  assert.equal(res.loss, 0.05);
});

test('forcedAlign surfaces a non-OK response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 400, text: async () => 'bad audio' });
  await assert.rejects(
    forcedAlign({ apiKey: 'k', audio: Buffer.from('x'), transcript: 't' }, fetchImpl),
    /400.*bad audio/,
  );
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd tools/audio && node --test lib/align.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tools/audio/lib/align.js`**

```js
const BASE = 'https://api.elevenlabs.io';

// Forced Alignment: align an audio file against a plain (tag-free) transcript.
// Returns { characters[], words:[{text,start,end,loss}], loss }. Model-agnostic;
// one call handles a full 10-15 min file. `audio` is a Buffer of the encoded MP3
// (or PCM-derived MP3); `transcript` is the CLEAN blocks joined by JOIN_SEPARATOR.
export async function forcedAlign({ apiKey, audio, transcript, contentType = 'audio/mpeg' }, fetchImpl) {
  const f = fetchImpl || fetch;
  const form = new FormData();
  form.append('file', new Blob([audio], { type: contentType }), 'narration.mp3');
  form.append('text', transcript);                 // NO tags — must match clean
  const res = await f(`${BASE}/v1/forced-alignment`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },             // let FormData set content-type+boundary
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text?.().catch(() => '') ?? '';
    throw new Error(`ElevenLabs forced-alignment ${res.status}: ${detail}`);
  }
  return await res.json();
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd tools/audio && node --test lib/align.test.js`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/audio/lib/align.js tools/audio/lib/align.test.js
git commit -m "feat(audio): forced-alignment REST client (tag-free transcript)"
```

---

## Task 6: `lib/align-map.js` — aligned words → narration.json (TDD, core algorithm)

Walk the flat aligned `words[]` back onto blocks in order. For each block, `tokenizeWords(block.text)` gives the expected words; consume that many entries off a flat cursor, verifying word text (case/punct-normalized), re-syncing on minor aligner drift within a small window, failing loudly past a threshold. Emits the exact `{duration, blocks:[{index, words:[{text,start,end}]}]}` shape the player consumes.

**Files:**
- Create: `tools/audio/lib/align-map.js`
- Test: `tools/audio/lib/align-map.test.js`

- [ ] **Step 1: Write failing tests**

`tools/audio/lib/align-map.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapAlignedWords } from './align-map.js';

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
```

- [ ] **Step 2: Run, verify fail**

Run: `cd tools/audio && node --test lib/align-map.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `tools/audio/lib/align-map.js`**

```js
import { tokenizeWords } from '../../../shared/audio-tokenize.js';

const RESYNC_WINDOW = 6;   // entries to scan when re-syncing on aligner drift
const round = (n) => +Number(n).toFixed(4);
// Case/punctuation-insensitive compare for verifying word identity.
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// blocks: [{index, text}] (the CLEAN text sent to alignment, same order)
// words:  flat aligned [{text,start,end,...}] in reading order
// -> { duration, blocks:[{index, words:[{text,start,end}]}] }
export function mapAlignedWords(blocks, words) {
  const outBlocks = [];
  let cursor = 0;
  for (const block of blocks) {
    const expected = tokenizeWords(block.text);
    const emitted = [];
    for (const tok of expected) {
      const want = norm(tok.text);
      let i = cursor;
      // Re-sync: skip up to RESYNC_WINDOW aligner entries to find the exact word.
      while (i < words.length && i < cursor + RESYNC_WINDOW && norm(words[i].text) !== want) i++;
      if (i >= words.length || norm(words[i].text) !== want) {
        throw new Error(`align-map: cannot match word "${tok.text}" in block ${block.index} (drift exceeded window)`);
      }
      const w = words[i];
      emitted.push({ text: tok.text, start: round(w.start), end: round(w.end) });
      cursor = i + 1;
    }
    outBlocks.push({ index: block.index, words: emitted });
  }
  const duration = outBlocks.length
    ? round(outBlocks.flatMap(b => b.words).reduce((mx, w) => Math.max(mx, w.end), 0))
    : 0;
  return { duration, blocks: outBlocks };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `cd tools/audio && node --test lib/align-map.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add tools/audio/lib/align-map.js tools/audio/lib/align-map.test.js
git commit -m "feat(audio): map aligned words to narration.json (drift re-sync)"
```

---

## Task 7: Rewrite `buildNarration` to the 7-stage v3 flow (`node --check` + dry-run)

Wire the tested units into `build-audio.mjs`: `tagBlocks` → `chunkBlocks(taggedBlocks, V3_MAX_CHARS)` → `synthesizeV3` per chunk (sequential) → concat (PCM-encode-once or `concatMp3`) → `forcedAlign(full mp3, full clean transcript)` → quality gate on `loss` + duration cross-check → `mapAlignedWords(cleanBlocks, words)`. `cfg` gains `anthropicApiKey`, `anthropicModel`, `narrationModelId` (`eleven_v3`). This is I/O — validated by `node --check` + the gated live run, not a unit test.

**Files:**
- Modify: `tools/audio/build-audio.mjs`

- [ ] **Step 1: Add imports + constants**

Add to the imports block:

```js
import { tagBlocks } from './lib/tag.js';
import { synthesizeV3 } from './lib/elevenlabs.js';   // alongside existing elevenlabs imports
import { forcedAlign } from './lib/align.js';
import { mapAlignedWords } from './lib/align-map.js';
```

Add near the existing narration constants:

```js
// v3's per-request limit is ~5000 chars; cap on the TAGGED length (tags inflate it).
const V3_MAX_CHARS = 4500;
const NARRATION_MODEL_ID = process.env.ELEVENLABS_NARRATION_MODEL_ID || 'eleven_v3';
const ALIGNMENT_LOSS_MAX = 0.5;     // per-article quality gate (tune on first real run)
```

(Keep `NARRATION_VOICE_SETTINGS`, `NARRATION_OUTPUT_FORMAT`. Set the default `NARRATION_OUTPUT_FORMAT` to `'mp3_44100_192'` per the spec.)

- [ ] **Step 2: Rewrite `buildNarration`**

Replace the existing `buildNarration` body with the 7-stage flow:

```js
async function buildNarration(slug, blocks, cfg) {
  const fmt = cfg.narrationOutputFormat;
  const isPcm = fmt.startsWith('pcm');
  const bitrate = `${fmt.match(/mp3_\d+_(\d+)/)?.[1] ?? '192'}k`;

  // (1) extract already done by caller -> `blocks` are the CLEAN blocks.
  // (2) tag: clean -> tagged (additive only; strip-check fallback inside).
  const tagged = await tagBlocks(blocks, { apiKey: cfg.anthropicApiKey, model: cfg.anthropicModel });

  // (3) synthesize v3: chunk the TAGGED text on block boundaries; no stitching.
  const taggedBlocks = tagged.map(t => ({ index: t.index, text: t.tagged }));
  const chunkGroups = chunkBlocks(taggedBlocks, V3_MAX_CHARS);
  const audioParts = [];
  for (const group of chunkGroups) {
    const text = group.map(b => b.text).join(JOIN_SEPARATOR);
    const { audio } = await synthesizeV3(text, {
      apiKey: cfg.apiKey, voiceId: cfg.narrationVoiceId, modelId: cfg.narrationModelId,
      outputFormat: fmt, voiceSettings: NARRATION_VOICE_SETTINGS,
    });
    audioParts.push(audio);
  }

  // (4) concat: gapless single file + true encoded duration.
  const mp3 = isPcm
    ? await encodeMp3FromPcm(Buffer.concat(audioParts), { sampleRate: 44100, channels: 1, bitrate: '192k' })
    : await concatMp3(audioParts, { bitrate });
  const encodedDuration = isPcm
    ? pcmDurationSeconds(Buffer.concat(audioParts).length)
    : await probeDurationSeconds(mp3);

  // (5) align: full mp3 vs full CLEAN transcript (tag-free).
  const cleanBlocks = tagged.map(t => ({ index: t.index, text: t.clean }));
  const transcript = cleanBlocks.map(b => b.text).join(JOIN_SEPARATOR);
  const alignment = await forcedAlign({ apiKey: cfg.apiKey, audio: mp3, transcript, contentType: 'audio/mpeg' });

  // quality gate: reject drifting karaoke rather than ship it.
  if (typeof alignment.loss === 'number' && alignment.loss > ALIGNMENT_LOSS_MAX) {
    throw new Error(`[${slug}] forced-alignment loss ${alignment.loss} > ${ALIGNMENT_LOSS_MAX}`);
  }

  // (6) map: aligned words -> narration.json (player-compatible shape).
  const timings = mapAlignedWords(cleanBlocks, alignment.words);
  const drift = Math.abs(timings.duration - encodedDuration);
  if (drift > 2.0) {
    console.warn(`[${slug}] alignment max-end ${timings.duration}s vs encoded ${encodedDuration.toFixed(2)}s (drift ${drift.toFixed(2)}s)`);
  }
  timings.duration = round4(encodedDuration); // trust the encoded file for total length

  return { mp3, json: timings };
}
```

Add a small `round4` helper near the top if not present: `const round4 = (n) => +Number(n).toFixed(4);`.

- [ ] **Step 3: Extend `cfg` in `main()`**

In the `cfg = { ... }` block, add:

```js
      narrationModelId: NARRATION_MODEL_ID,
      anthropicApiKey: env('ANTHROPIC_API_KEY', args.mode !== 'podcast'),
      anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
```

(Keep `apiKey`, `narrationOutputFormat`, `narrationVoiceId`. The legacy `modelId` line may stay for any retained v2/podcast path.)

- [ ] **Step 4: Update the `--dry-run` cost summary**

In the per-slug dry-run log, add the two new v3 line items so the operator sees the new spend before authorizing it:

```js
    if (args.dryRun) {
      const taggedCharsNote = 'tagged-char count ~= clean + a few tags/block';
      console.log(`[${slug}] v3 narration: ~${estimateCost(blocks).narrationChars} clean chars (${taggedCharsNote}); + 1 forced-alignment call (paid, per-file); + 1 Claude tagging pass per block.`);
      continue;
    }
```

- [ ] **Step 5: Syntax-check**

Run: `cd tools/audio && node --check build-audio.mjs && node --check lib/tag.js && node --check lib/align.js && node --check lib/align-map.js`
Expected: silent (all valid).

- [ ] **Step 6: Full unit suite still green**

Run: `cd tools/audio && node --test`
Expected: PASS — all suites (tag, elevenlabs-v3, align, align-map, plus the pre-existing tokenize/extract/chunk/cost/map/upload/cli/encode/pcm tests).

- [ ] **Step 7: Dry-run against real articles (no network/secrets)**

Run: `cd tools/audio && node build-audio.mjs --article all --mode narration --dry-run`
Expected: per-article block counts + the v3 cost line (clean chars, forced-alignment, Claude tagging); no uploads, no network.

- [ ] **Step 8: Commit**

```bash
git add tools/audio/build-audio.mjs
git commit -m "feat(audio): rewrite buildNarration to v3 7-stage pipeline"
```

---

## Task 8: GATED live generation + browser verify + PROJECT_STATUS

This task **spends ElevenLabs + Anthropic credits and writes to Firebase**. Per project convention, **pause for the user's explicit go-ahead before running anything that spends credits or deploys.** Build and verify locally; do not run Steps 3+ until the user says go.

**Files:**
- Modify: `PROJECT_STATUS.md`

- [ ] **Step 1: Confirm secrets present (local, no spend)**

Create `tools/audio/.env` (or root `.env`) from the template with real `ELEVENLABS_API_KEY`, `ELEVENLABS_NARRATION_VOICE_ID`, `ANTHROPIC_API_KEY`, and place `service-account.json`.
Run: `cd "$(git rev-parse --show-toplevel)" && node -e "for (const k of ['ELEVENLABS_API_KEY','ELEVENLABS_NARRATION_VOICE_ID','ANTHROPIC_API_KEY']) console.log(k, !!process.env[k])" --env-file=.env 2>/dev/null || node --env-file=.env -e "console.log(!!process.env.ELEVENLABS_API_KEY, !!process.env.ANTHROPIC_API_KEY)"`
Expected: all `true`.

- [ ] **Step 2: Dry-run all articles (no spend)**

Run: `cd tools/audio && node build-audio.mjs --article all --mode narration --dry-run`
Expected: block counts + v3 cost lines per article.

> **GATE — STOP HERE. Do not run Steps 3+ until the user gives an explicit go-ahead.** Steps 3, 6, and the deploy spend money / write to Firebase.

- [ ] **Step 3: Generate ONE article locally (`--local-out`), verify karaoke in the browser**

Run: `cd tools/audio && node --env-file=../../.env build-audio.mjs --article friction-reduction --mode narration --local-out ./out`
Expected: logs "narration <duration>s, <bytes> bytes" and "wrote N files to ./out/friction-reduction".
Then serve and verify with the local artifacts (`?awLocal`):
Run: `cd "$(git rev-parse --show-toplevel)" && python3 -m http.server 8080`
Open `http://localhost:8080/articles/friction-reduction/`. Verify: player appears; play starts the v3 audiobook read; the active word highlights word-by-word and **stays lit through `[pause]`/`[sighs]`** (natural dwell); auto-scroll follows; scrub + speed work; coexistence with `highlights.js` selection/reactions intact; `prefers-reduced-motion` honored. Spot-check the read sounds like a calm audiobook (no gimmickry) and chunk seams are inaudible.

> If alignment `loss` trips the gate or seams are audible, tune `ALIGNMENT_LOSS_MAX` / merge blocks into fewer chunks (bounded by ~5k), re-run this one article, re-verify. Commit any tuning before proceeding.

- [ ] **Step 4: Generate one article to Firebase + confirm public read** (spend + write)

Run: `cd tools/audio && node --env-file=../../.env build-audio.mjs --article friction-reduction --mode narration`
Expected: "uploaded N files to audio/friction-reduction/".
Run: `curl -s "https://firebasestorage.googleapis.com/v0/b/$(node -e "console.log(process.env.FIREBASE_STORAGE_BUCKET)" --env-file=../../.env)/o/$(python3 -c "import urllib.parse;print(urllib.parse.quote('audio/friction-reduction/manifest.json',safe=''))")?alt=media"`
Expected: JSON manifest with a `narration` mode.

- [ ] **Step 5: Generate the remaining four** (after the single-article result looks right)

Run: `cd tools/audio && node --env-file=../../.env build-audio.mjs --article all --mode narration`
Expected: each of the five logs duration + bytes + upload.

- [ ] **Step 6: Update `PROJECT_STATUS.md`**

Document the audiobook narration path: `eleven_v3` expressive TTS with sparse Claude-inserted delivery tags, karaoke timings from the Forced Alignment API (not inline timestamps), the clean/tagged contract, and the build command:
`node --env-file=.env tools/audio/build-audio.mjs --article <slug|all> --mode narration`. Note the new env vars (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ELEVENLABS_NARRATION_MODEL_ID=eleven_v3`, `ELEVENLABS_NARRATION_OUTPUT_FORMAT=mp3_44100_192`).

- [ ] **Step 7: Commit**

```bash
git add PROJECT_STATUS.md
git commit -m "docs(audio): document v3 audiobook narration pipeline"
```

---

## Self-Review

**Spec coverage (spec section → task):**
- §4.1 Extract (unchanged) → reused as-is in Task 7 (caller passes clean blocks). ✓
- §4.2 Tag stage `lib/tag.js`, per-block Claude, additive-only invariant + `tagged=clean` fallback → Tasks 2 (`stripTags` + invariant) & 3 (`tagBlocks`). ✓
- §4.3 `synthesizeV3` plain `POST /v1/text-to-speech/{voice}`, `model_id:eleven_v3`, no `with-timestamps`, no `previous_request_ids`, injectable fetch → Task 4. ✓
- §4.4 Concat (unchanged), true encoded duration via `probeDurationSeconds`/`pcmDurationSeconds`, `mp3_44100_192`/`pcm_44100` → Task 7 Steps 1–2. ✓
- §4.5 Forced Alignment `POST /v1/forced-alignment`, multipart `file`+`text`, tag-free text, response `{characters,words,loss}`, `loss` gate → Tasks 5 (client) & 7 (gate). ✓
- §4.6 `mapAlignedWords`: per-block tokenized walk, word-text verify, drift re-sync, exact player shape, `duration` cross-checked vs encoded → Task 6 + Task 7 duration cross-check. ✓
- §4.7 Upload (unchanged) → reused in `main()` (untouched). ✓
- §4.8 `buildNarration` 7-stage rewrite, `cfg` gains `anthropicApiKey`/`anthropicModel`/v3 model, `--dry-run` adds alignment + Claude line items → Task 7. ✓
- §5 No player change; `[pause]`/`[sighs]` read as a natural dwell → confirmed (no player file touched), verified Task 8 Step 3. ✓
- §6 Error handling: strip-check fallback (Task 3), loss gate + duration cross-check (Task 7), mapper drift fail-loud (Task 6), missing-keys failure (Task 7 `env(...)`). ✓
- §7 Unit tests for `stripTags`/invariant, `forcedAlign` request+tag-free+error, `mapAlignedWords` monotonicity/partition/text-match/shape/re-sync; tagging + live generation validated by `node --check` + gated live run, not unit tests → Tasks 2,3,4,5,6,7,8. ✓
- §8 Files Changed (new tag/align/align-map + tests; edit elevenlabs/build-audio/.env.example/PROJECT_STATUS; unchanged player/upload/extract/chunk/encode/pcm; map.js retired from v3 path) → matches Tasks 1–8 file lists. ✓
- §9 Cost: `--dry-run` prints tagged-char note + flags alignment + Claude line items → Task 7 Step 4. ✓
- Env additions in BOTH `.env.example` files → Task 1. ✓

**Real-symbol check:** uses confirmed exports — `synthesizeWithTimestamps`/private `call` (reused by `synthesizeV3`), `chunkBlocks`/`JOIN_SEPARATOR`, `concatMp3`/`encodeMp3FromPcm`/`probeDurationSeconds`, `pcmDurationSeconds`, `tokenizeWords`/`collapseWhitespace`/`blockNarrationText`, `buildManifest`/`uploadArtifacts`, player `buildWordIndex` (iterates `timings.blocks[].index` + `words[i]`). New exports: `stripTags`, `tagBlocks`, `buildTagPrompt`, `synthesizeV3`, `forcedAlign`, `mapAlignedWords`.

**Ordering check:** every later task builds only on tested, committed units — Task 2 (invariant) precedes Task 3 (tagger that depends on it); 4/5/6 are independent tested clients; Task 7 wires them; Task 8 is the only spend, and it is gated.

**Placeholder scan:** no TODO/TBD. `ANTHROPIC_MODEL` default `claude-opus-4-8` is the current model id (override via env if needed at run time). `ALIGNMENT_LOSS_MAX=0.5` is an explicit, tune-on-first-run threshold per spec §6 — flagged, not a placeholder. The duration drift warn threshold (2.0s) and `RESYNC_WINDOW` (6) are documented tunables.

**Known risk:** v3 lacks stitching, so prosody can drift across chunk seams; mitigated by cutting only on block boundaries + gapless concat, with the "merge blocks into fewer/larger chunks" fallback noted in Task 8 Step 3. Forced-alignment accuracy is gated by `loss` + the duration cross-check + the mapper's text-match re-sync; fine drift is acceptable for a contemplative dwell-style highlight.
