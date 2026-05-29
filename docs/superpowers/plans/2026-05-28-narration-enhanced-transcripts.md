# Narration Enhanced Transcripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the v3 narration read like a premium audiobook (breathing, pausing, gentle emphasis) at zero recurring cost, by replacing the live-API tagging step with committed "enhanced transcripts" and fixing the v3 voice settings that flatten delivery.

**Architecture:** A new pure module `lib/enhance.js` loads a committed per-article JSON artifact (`narration/<slug>.json`) and aligns its `enhanced` text to the live article blocks, guarded by a word-sequence invariant (`sameWords`) that lets the director add tags/ellipses/caps but never change the spoken-word sequence. `build-audio.mjs` swaps its live-API tagger for this loader and uses the doc-recommended v3 voice profile. The five transcripts are hand-authored once; a test proves they never desync karaoke.

**Tech Stack:** Node.js ESM, `node:test`, `node-html-parser` (existing), ElevenLabs `eleven_v3` TTS + Forced Alignment.

**Spec:** `docs/superpowers/specs/2026-05-28-narration-enhanced-transcripts-design.md`

**Article slugs (the five):** `before-you-automate`, `cost-of-speed`, `designing-around-gaps`, `friction-reduction`, `what-ai-cant-see`.

**Run tests from `tools/audio/`:** `node --test` (all) or `node --test lib/enhance.test.js` (one file).

---

## File Structure

- `tools/audio/lib/enhance.js` (NEW) — `stripTags`, `normalizeWords`, `sameWords`, `loadEnhanced`. Pure; injectable I/O for tests.
- `tools/audio/lib/enhance.test.js` (NEW) — unit tests for the above.
- `tools/audio/scaffold-narration.mjs` (NEW) — one-time helper: emit `narration/<slug>.json` with `enhanced = clean` from live extraction (valid by construction), ready for hand-authoring.
- `tools/audio/narration/<slug>.json` × 5 (NEW) — committed enhanced transcripts.
- `tools/audio/narration/narration-artifacts.test.js` (NEW) — proves every artifact stays word-synced to its live article.
- `tools/audio/build-audio.mjs` (MODIFY) — use `loadEnhanced`; v3 voice settings; drop Anthropic config; update `--dry-run`.
- `tools/audio/.env.example` (MODIFY) — remove `ANTHROPIC_*`.
- `tools/audio/lib/tag.js`, `tools/audio/lib/tag.test.js` (DELETE) — live-API tagger retired.
- `PROJECT_STATUS.md` (MODIFY) — document the committed-transcript director step.

---

## Task 1: `lib/enhance.js` — text helpers (`stripTags`, `normalizeWords`, `sameWords`)

**Files:**
- Create: `tools/audio/lib/enhance.js`
- Test: `tools/audio/lib/enhance.test.js`

- [ ] **Step 1: Write the failing test**

Create `tools/audio/lib/enhance.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tools/audio && node --test lib/enhance.test.js`
Expected: FAIL — `Cannot find module './enhance.js'` (or "stripTags is not a function").

- [ ] **Step 3: Write minimal implementation**

Create `tools/audio/lib/enhance.js`:

```js
import { collapseWhitespace } from '../../../shared/audio-tokenize.js';

// Remove only bracketed delivery tags (e.g. [sighs], [pause]). Leave spoken
// words, ellipses, capitalization, and ordinary punctuation untouched.
export function stripTags(text) {
  return text.replace(/\[[^\]]*\]/g, '');
}

// The spoken-word sequence of a string: strip tags, lowercase, turn every
// non-letter/non-digit (punctuation, ellipses, dashes) into a separator,
// collapse whitespace, split. Two strings with an equal result carry the same
// words in the same order regardless of tags, caps, ellipses, or punctuation.
export function normalizeWords(text) {
  const noTags = stripTags(text).toLowerCase();
  const wordsOnly = noTags.replace(/[^\p{L}\p{N}\s]+/gu, ' ');
  const collapsed = collapseWhitespace(wordsOnly);
  return collapsed ? collapsed.split(' ') : [];
}

export function sameWords(a, b) {
  const wa = normalizeWords(a);
  const wb = normalizeWords(b);
  if (wa.length !== wb.length) return false;
  for (let i = 0; i < wa.length; i++) if (wa[i] !== wb[i]) return false;
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tools/audio && node --test lib/enhance.test.js`
Expected: PASS (6 tests passing).

- [ ] **Step 5: Commit**

```bash
git add tools/audio/lib/enhance.js tools/audio/lib/enhance.test.js
git commit -m "feat(audio): enhance.js text helpers (stripTags, normalizeWords, sameWords)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `lib/enhance.js` — `loadEnhanced` artifact loader

**Files:**
- Modify: `tools/audio/lib/enhance.js`
- Test: `tools/audio/lib/enhance.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tools/audio/lib/enhance.test.js`:

```js
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
    { index: 1, clean: 'old text', enhanced: 'Tools are instruments.' }, // altered word
  ]});
  const out = loadEnhanced('s', liveBlocks, { readImpl, onWarn: (m) => warnings.push(m) });
  assert.equal(out[0].tagged, 'Remove the obstacle…');
  assert.equal(out[1].tagged, out[1].clean);   // stale -> clean
  assert.equal(warnings.length, 1);            // one per-block warning
});

test('loadEnhanced falls back per-block when an index is missing from the artifact', () => {
  const warnings = [];
  const readImpl = () => JSON.stringify({ slug: 's', blocks: [
    { index: 0, clean: 'Remove the obstacle.', enhanced: 'Remove the obstacle…' },
  ]});
  const out = loadEnhanced('s', liveBlocks, { readImpl, onWarn: (m) => warnings.push(m) });
  assert.equal(out[1].tagged, out[1].clean);   // block 1 absent -> clean
  assert.equal(warnings.length, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tools/audio && node --test lib/enhance.test.js`
Expected: FAIL — `loadEnhanced is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to the top of `tools/audio/lib/enhance.js` (imports):

```js
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
```

Add after the existing imports (before `stripTags`):

```js
const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = resolve(__dirname, '../narration');
```

Add at the end of `tools/audio/lib/enhance.js`:

```js
// Load the committed enhanced transcript for `slug` and align it to the LIVE
// article blocks. Returns [{ index, clean, tagged }] where `clean` is always
// the live block text (so downstream alignment + DOM mapping use the current
// article). A missing file, missing index, or word-altered (stale) entry falls
// that block back to `tagged = clean` (+ warning) so a build never desyncs the
// karaoke highlight.
export function loadEnhanced(slug, blocks, { dir = DEFAULT_DIR, onWarn = console.warn, readImpl } = {}) {
  const read = readImpl || ((p) => readFileSync(p, 'utf8'));
  const byIndex = new Map();
  try {
    const data = JSON.parse(read(resolve(dir, `${slug}.json`)));
    for (const b of (data.blocks || [])) byIndex.set(b.index, b);
  } catch (e) {
    onWarn(`[enhance] ${slug}: no usable artifact (${e.message}); using clean text`);
  }
  return blocks.map((b) => {
    const entry = byIndex.get(b.index);
    if (entry && typeof entry.enhanced === 'string' && sameWords(entry.enhanced, b.text)) {
      return { index: b.index, clean: b.text, tagged: entry.enhanced };
    }
    if (byIndex.size) onWarn(`[enhance] ${slug} block ${b.index}: missing/stale enhanced text; using clean`);
    return { index: b.index, clean: b.text, tagged: b.text };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tools/audio && node --test lib/enhance.test.js`
Expected: PASS (10 tests passing total).

- [ ] **Step 5: Commit**

```bash
git add tools/audio/lib/enhance.js tools/audio/lib/enhance.test.js
git commit -m "feat(audio): loadEnhanced reads committed transcripts with stale-safe fallback

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Scaffold helper + artifact-validation test

This creates the five `enhanced = clean` artifacts (valid by construction) and the test that guards them. Authoring the actual expressive text is Task 4.

**Files:**
- Create: `tools/audio/scaffold-narration.mjs`
- Create: `tools/audio/narration/narration-artifacts.test.js`
- Create (generated): `tools/audio/narration/<slug>.json` × 5

- [ ] **Step 1: Write the scaffold helper**

Create `tools/audio/scaffold-narration.mjs`:

```js
// One-time helper: scaffold tools/audio/narration/<slug>.json from live
// article extraction with `enhanced = clean` (valid by construction). Then
// hand-author the `enhanced` fields per the design's §5 authoring guide.
// Usage:  node scaffold-narration.mjs [slug|all] [--force]
// Refuses to overwrite an existing artifact unless --force is passed.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { extractBlocks } from './lib/extract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = resolve(__dirname, '../../articles');
const OUT_DIR = resolve(__dirname, 'narration');

const args = process.argv.slice(2);
const force = args.includes('--force');
const slugArg = args.find((a) => !a.startsWith('--')) || 'all';
const slugs = slugArg === 'all'
  ? readdirSync(ARTICLES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [slugArg];

mkdirSync(OUT_DIR, { recursive: true });
for (const slug of slugs) {
  const out = resolve(OUT_DIR, `${slug}.json`);
  if (existsSync(out) && !force) { console.log(`skip ${slug} (exists; --force to overwrite)`); continue; }
  const html = readFileSync(resolve(ARTICLES_DIR, slug, 'index.html'), 'utf8');
  const blocks = extractBlocks(html).map((b) => ({ index: b.index, clean: b.text, enhanced: b.text }));
  writeFileSync(out, JSON.stringify({ slug, blocks }, null, 2) + '\n');
  console.log(`wrote ${out} (${blocks.length} blocks)`);
}
```

- [ ] **Step 2: Run the scaffold for all five articles**

Run: `cd tools/audio && node scaffold-narration.mjs all`
Expected: five `wrote .../narration/<slug>.json (N blocks)` lines, one per article.

- [ ] **Step 3: Write the artifact-validation test**

Create `tools/audio/narration/narration-artifacts.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { extractBlocks } from '../lib/extract.js';
import { sameWords } from '../lib/enhance.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = resolve(__dirname, '../../../articles');
const NARRATION_DIR = __dirname;

const artifacts = readdirSync(NARRATION_DIR).filter((f) => f.endsWith('.json'));

test('there is a narration artifact for every article', () => {
  const articleSlugs = readdirSync(ARTICLES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const artifactSlugs = artifacts.map((f) => f.replace(/\.json$/, '')).sort();
  assert.deepEqual(artifactSlugs, articleSlugs);
});

test('every enhanced block stays word-synced to its live article block', () => {
  for (const file of artifacts) {
    const slug = file.replace(/\.json$/, '');
    const data = JSON.parse(readFileSync(resolve(NARRATION_DIR, file), 'utf8'));
    const live = extractBlocks(readFileSync(resolve(ARTICLES_DIR, slug, 'index.html'), 'utf8'));
    const byIndex = new Map(data.blocks.map((b) => [b.index, b]));
    for (const b of live) {
      const entry = byIndex.get(b.index);
      assert.ok(entry, `${slug}: missing enhanced block ${b.index}`);
      assert.ok(sameWords(entry.enhanced, b.text),
        `${slug} block ${b.index}: enhanced words drift from the article`);
    }
  }
});
```

- [ ] **Step 4: Run the validation test to verify it passes**

Run: `cd tools/audio && node --test narration/narration-artifacts.test.js`
Expected: PASS (2 tests). `enhanced = clean` is trivially word-synced, and all five slugs are present.

- [ ] **Step 5: Commit**

```bash
git add tools/audio/scaffold-narration.mjs tools/audio/narration/
git commit -m "feat(audio): scaffold narration transcripts + artifact-sync test

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Author the five enhanced transcripts (the expressiveness work)

This is generative authoring, not codegen. Apply the design's §5 authoring guide to the `enhanced` field of each block, one article at a time. The validation test from Task 3 is the objective gate; the manual listen (Task 7) is the quality gate.

**Authoring rules (from spec §5):**
- **Ellipses `…` are the primary pause lever** — at genuine reflective beats / breath points. (v3 has no SSML break tags.)
- **`[sighs]` / `[exhales]` sparingly** — only where the prose itself turns or settles.
- **`[curious]` / `[thoughtful]`** occasionally, where a sentence genuinely shifts register.
- **Caps on at most one pivotal word** per passage. Never shout.
- Most paragraphs get one light touch; some get none. Breathe, never perform.
- **Forbidden:** SFX/music/ambience tags, multi-voice, anything that implies acting.
- **Hard invariant:** `sameWords(enhanced, clean)` must hold for every block — add only tags/ellipses/caps/`?`/`!`; never add, drop, or reorder a spoken word.

**Worked example** (illustrative — shows the touch, not a rule to apply verbatim):
```
clean:    "Calibrated friction: seams matched to stakes. The goal is not to remove every obstacle."
enhanced: "Calibrated friction… seams matched to stakes. [exhales] The goal is not to remove EVERY obstacle."
```

**Files:**
- Modify: `tools/audio/narration/before-you-automate.json`
- Modify: `tools/audio/narration/cost-of-speed.json`
- Modify: `tools/audio/narration/designing-around-gaps.json`
- Modify: `tools/audio/narration/friction-reduction.json`
- Modify: `tools/audio/narration/what-ai-cant-see.json`

Repeat Steps 1–4 below **once per article** (five passes). Do them one article at a time so a failure is isolated.

- [ ] **Step 1: Read the article's scaffolded artifact**

Read `tools/audio/narration/<slug>.json`. Each block has `clean` (the source) and `enhanced` (currently `= clean`).

- [ ] **Step 2: Edit each block's `enhanced` field per the authoring rules**

Only edit `enhanced`. Leave `clean` and `index` untouched. Keep `enhanced`'s spoken words identical to `clean`; add only delivery cues. Keep the file valid JSON (`json.stringify`-style, 2-space indent, trailing newline preserved).

- [ ] **Step 3: Run the validation test for this article**

Run: `cd tools/audio && node --test narration/narration-artifacts.test.js`
Expected: PASS. If a block fails with "enhanced words drift," you changed/added/removed a spoken word — fix that block so only tags/ellipses/caps/punctuation differ.

- [ ] **Step 4: Commit this article**

```bash
git add tools/audio/narration/<slug>.json
git commit -m "feat(audio): author enhanced narration transcript for <slug>

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: After all five — run the full audio test suite**

Run: `cd tools/audio && node --test`
Expected: PASS — all suites (enhance, artifacts, align, align-map, chunk, etc.) green.

---

## Task 5: Wire `loadEnhanced` into the build + fix v3 voice settings

**Files:**
- Modify: `tools/audio/build-audio.mjs`

- [ ] **Step 1: Swap the import**

In `tools/audio/build-audio.mjs`, replace line 18:

```js
import { tagBlocks } from './lib/tag.js';
```

with:

```js
import { loadEnhanced } from './lib/enhance.js';
```

- [ ] **Step 2: Fix the v3 voice settings**

Replace the `NARRATION_VOICE_SETTINGS` block (lines 25-28):

```js
// Steady, contemplative read (see plan amendment A4).
const NARRATION_VOICE_SETTINGS = {
  stability: 0.6, similarity_boost: 0.75, style: 0, speed: 0.95, use_speaker_boost: true,
};
```

with:

```js
// v3 contemplative read. Stability 0.5 = "Natural": responsive to delivery
// cues without v3's high-stability flatness. v3 paces via tags/punctuation,
// not a `speed` setting; `style`/`speed` are dropped (verified on first run).
const NARRATION_VOICE_SETTINGS = {
  stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true,
};
```

- [ ] **Step 3: Swap the stage-2 tagging for the loader**

Replace lines 64-70 (the optional-tagging block):

```js
  // (2) tag (OPTIONAL): only when an Anthropic key is provided. v3 narrates well
  // directly, so tagging is opt-in expressiveness, not required. Without it,
  // tagged === clean and the prose goes straight to v3.
  const tagged = cfg.anthropicApiKey
    ? await tagBlocks(blocks, { apiKey: cfg.anthropicApiKey, model: cfg.anthropicModel })
    : blocks.map(b => ({ index: b.index, clean: b.text, tagged: b.text }));

  // (3) synthesize v3: chunk the TAGGED text on block boundaries; no stitching.
  const taggedBlocks = tagged.map(t => ({ index: t.index, text: t.tagged }));
```

with:

```js
  // (2) enhance: load the committed expressive transcript for this article.
  // Per-block fallback to clean text on a missing/stale artifact (never desyncs).
  const enhanced = loadEnhanced(slug, blocks);

  // (3) synthesize v3: chunk the ENHANCED text on block boundaries; no stitching.
  const taggedBlocks = enhanced.map(t => ({ index: t.index, text: t.tagged }));
```

- [ ] **Step 4: Update the clean-blocks reference for alignment**

Replace line 91:

```js
  const cleanBlocks = tagged.map(t => ({ index: t.index, text: t.clean }));
```

with:

```js
  const cleanBlocks = enhanced.map(t => ({ index: t.index, text: t.clean }));
```

- [ ] **Step 5: Remove the Anthropic config from `cfg`**

Delete lines 142-143:

```js
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || null, // optional: enables tag "Enhance"
      anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
```

- [ ] **Step 6: Update the `--dry-run` cost line**

Replace lines 164-165:

```js
      const taggedCharsNote = 'tagged-char count ~= clean + a few tags/block';
      console.log(`[${slug}] v3 narration: ~${estimateCost(blocks).narrationChars} clean chars (${taggedCharsNote}); + 1 forced-alignment call (paid, per-file); + 1 Claude tagging pass per block.`);
```

with:

```js
      console.log(`[${slug}] v3 narration: ~${estimateCost(blocks).narrationChars} clean chars (enhanced adds a few tags/block); + 1 forced-alignment call (paid, per-file). No LLM tagging cost (committed transcripts).`);
```

- [ ] **Step 7: Verify the build script parses and dry-run works**

Run: `cd tools/audio && node --check build-audio.mjs && node build-audio.mjs --article cost-of-speed --mode narration --dry-run`
Expected: no syntax error; prints block count, cost summary, and the new dry-run line with no "Claude tagging" mention and no missing-env error (dry-run needs no keys).

- [ ] **Step 8: Commit**

```bash
git add tools/audio/build-audio.mjs
git commit -m "feat(audio): build reads committed transcripts; v3 Natural voice settings

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Retire the live-API tagger and Anthropic config

**Files:**
- Delete: `tools/audio/lib/tag.js`, `tools/audio/lib/tag.test.js`
- Modify: `tools/audio/.env.example`

- [ ] **Step 1: Delete the retired tagger and its test**

```bash
cd "/Users/idstuart/Documents/Semester 4/Independent Study/intentional-ai-deployment"
git rm tools/audio/lib/tag.js tools/audio/lib/tag.test.js
```

- [ ] **Step 2: Remove the Anthropic block from `.env.example`**

In `tools/audio/.env.example`, delete these three lines:

```
# Anthropic (Claude) — "Enhance" replica that adds sparse v3 delivery tags.
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-opus-4-8
```

(Leave the `# Firebase Storage upload` block and everything else intact.)

- [ ] **Step 3: Verify no dangling references remain**

Run: `cd tools/audio && grep -rn "tag.js\|tagBlocks\|ANTHROPIC\|anthropic" *.mjs lib/*.js .env.example`
Expected: no output (exit code 1). If anything prints, remove it.

- [ ] **Step 4: Run the full suite to confirm nothing imported the deleted module**

Run: `cd tools/audio && node --test`
Expected: PASS — all suites green, no "Cannot find module './tag.js'".

- [ ] **Step 5: Commit**

```bash
git add -A tools/audio
git commit -m "chore(audio): retire live-API tagger and ANTHROPIC config

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Update PROJECT_STATUS.md + manual listen acceptance

**Files:**
- Modify: `PROJECT_STATUS.md`

- [ ] **Step 1: Document the director step in PROJECT_STATUS.md**

Find the narration/audio section of `PROJECT_STATUS.md` and add a short paragraph stating: narration expressiveness now comes from committed per-article transcripts in `tools/audio/narration/<slug>.json` (authored once, no recurring LLM cost); the build reads them via `lib/enhance.js`; karaoke stays in sync via the `sameWords` word-sequence invariant, enforced by `narration/narration-artifacts.test.js`; v3 voice settings use `stability: 0.5` (Natural). If no clear audio section exists, add a `## Narration (audiobook v3)` subsection near the other audio notes.

- [ ] **Step 2: Pre-flight — confirm the v3 voice (operator check)**

Confirm `ELEVENLABS_NARRATION_VOICE_ID` points at an expressive IVC or designed voice suited to calm reading — not a PVC or a flat/robust voice (spec §4.4). This is the single biggest v3 lever and lives in env, not code. If unsure, note it for the user to confirm before the real build.

- [ ] **Step 3: Build one article locally for the listen test**

Run (requires real `ELEVENLABS_API_KEY` + `ELEVENLABS_NARRATION_VOICE_ID`; writes to disk, no Firebase):
`cd tools/audio && node build-audio.mjs --article cost-of-speed --mode narration --local-out ./_local`
Expected: writes `_local/cost-of-speed/{narration.mp3, narration.json, manifest.json}`; logs duration + byte size; no missing-key or alignment-loss error.

- [ ] **Step 4: Listen + verify karaoke**

Play `_local/cost-of-speed/narration.mp3`. Acceptance:
- The read clearly breathes and pauses — no longer monotone (primary check vs. the original complaint).
- Expressive but never performative (the "quiet awe" bar).
- Then serve the site (`python3 -m http.server 8080`) and verify with `?awLocal` that the karaoke highlight advances word-by-word, stays lit through pauses/sighs, and auto-scroll follows. (Do not commit `_local/`.)

- [ ] **Step 5: Commit the docs**

```bash
git add PROJECT_STATUS.md
git commit -m "docs: document committed-transcript narration director step

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Done When

- `cd tools/audio && node --test` is fully green (enhance, artifacts, align, align-map, chunk, …).
- All five `narration/<slug>.json` exist, are word-synced (artifact test), and carry real delivery cues (not `enhanced = clean`).
- `build-audio.mjs` reads `loadEnhanced`, uses `stability: 0.5` with no `speed`/`style`, and has no Anthropic references.
- `lib/tag.js` / `tag.test.js` are gone; `.env.example` has no `ANTHROPIC_*`; `grep` for dangling refs is clean.
- A manual listen on one article confirms the read breathes and karaoke stays in sync.
- `_local/` is not committed.
```
