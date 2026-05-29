# Narration — Enhanced Transcripts (free v3 expressiveness) — Design

> **Date:** 2026-05-28
> **Status:** Approved (brainstorming) — pending implementation plan
> **Scope:** Make the per-article **Narration** read sound like a premium audiobook instead of a flat, word-by-word recitation, **without any recurring API cost**. Replace the live-API tagging step with **version-controlled "enhanced transcripts"** authored once (committed to git), loosen the karaoke-alignment guard so the director may use punctuation/caps/ellipses (not just bracket tags), and fix the v3 voice settings that are currently flattening delivery. **Narration only. Pure audiobook — expressive single voice, no music, no SFX.**

---

## 1. Goal & Problem

The shipped v3 narration pipeline (see `2026-05-28-narration-audiobook-v3-design.md`) produces a **robotic, monotone read** — it "just reads each word." Three root causes, all confirmed against ElevenLabs' v3 best-practices doc:

1. **The expressiveness layer is off by default.** `buildNarration` only tags when `ANTHROPIC_API_KEY` is set; otherwise bare prose goes to v3, which then reads it bare. v3 **renders** cues in the input text — it does not invent them. No cues in → flat read out.
2. **Stability is too high.** Voice settings use `stability: 0.6`. The doc states stability is *the* most important v3 setting and that high/Robust stability is "less responsive to directional prompts… similar to v2" (i.e. flat). Expressive reads want **Natural (0.5)**.
3. **Unsupported voice-settings fields.** `speed: 0.95` and `style: 0` are sent, but v3 controls pace via tags/punctuation, not a `speed` setting; the v3 `voice_settings` shape was never verified.

**Constraint (user decision):** no recurring spend on tagging. We will **not** call a paid LLM at build time. Because there are only five articles and the build is one-time/idempotent, the "director" step is reframed as a **one-time authoring task** producing committed artifacts — free, reviewable, hand-tunable, reproducible.

The result must clear the project bar: "quiet awe like stargazing," contemplative, never performative. The voice may breathe, pause, and lean on a word; it must never act.

## 2. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Director step | **Committed enhanced transcripts** (`tools/audio/narration/<slug>.json`), authored once, read at build | Zero recurring cost; reviewable; hand-tunable; reproducible. Replaces the live-API `lib/tag.js`. |
| Expressiveness scope | **Tags + punctuation + caps + ellipses** | v3's most natural levers (`…` for breath, `CAPS`/`?`/`!` for emphasis) require changing punctuation/case, not only inserting bracket tags. |
| Alignment guard | **Word-sequence invariant** (`sameWords`), not exact-string | Director may add tags/ellipses/caps but never add, drop, or reorder a spoken word → karaoke stays exact. |
| Stability | **`0.5` (Natural)** | Responsive to directional cues without v3's high-stability flatness. |
| Other voice settings | Keep `similarity_boost: 0.75`, `use_speaker_boost: true`; **drop `speed` and `style`** | v3 paces via tags/punctuation; unsupported fields verified/dropped on first real run. |
| Sound design | **Pure expressive voice — no music, no SFX, no literal sound-effect tags** | Reflective essay series; the quiet-awe bar. |
| Stages 1, 4, 5, 6, 7 | **Unchanged** | Only the director step (2) and voice settings change. The clean transcript still drives alignment + DOM mapping. |
| Live-API tagger | **Retired** (`lib/tag.js` / `tag.test.js` deleted; `ANTHROPIC_*` config removed) | Ruled out by the no-recurring-cost decision; no dead code. |

## 3. Architecture

The 7-stage pipeline is preserved. Only **stage 2** changes implementation (live API → committed artifact loader) and the **voice settings** in stage 3 change. The contract that makes karaoke work — *the clean transcript is what alignment and the live DOM both tokenize* — is unchanged.

```
 articles/<slug>/index.html
        │
   (1) extract            lib/extract.js            (UNCHANGED)
        │   blocks: [{ index, text(=clean) }]
        ▼
   (2) enhance            lib/enhance.js   (NEW — replaces lib/tag.js)
        │   loadEnhanced(slug, blocks) reads tools/audio/narration/<slug>.json
        │   → blocks: [{ index, clean, tagged }]   (tagged = committed enhanced text)
        │   per-block word-sequence check; fall back to clean on miss/stale
        ▼
   (3) synthesize (v3)    lib/elevenlabs.js: synthesizeV3()   (UNCHANGED code;
        │   chunk TAGGED text < ~4500 chars on block boundaries; no stitching
        │   voice_settings = { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true }
        ▼
   (4) concat             lib/encode.js             (UNCHANGED)
        ▼
   (5) align              lib/align.js: forcedAlign()   (UNCHANGED)
        │   POST /v1/forced-alignment  { file: narration.mp3, text: full CLEAN transcript }
        ▼
   (6) map                lib/align-map.js: mapAlignedWords()   (UNCHANGED)
        │   → narration.json { duration, blocks:[{index, words:[{text,start,end}]}] }
        ▼
   (7) upload             lib/upload.js             (UNCHANGED)
```

**Why stages 5 & 6 need no change.** The audio already contained non-word sounds before (the old `tagged` text carried `[pause]`/`[sighs]`), and alignment already ran against the **clean** transcript. A sigh or a held pause is simply extra audio in an inter-word gap, which the forced aligner already handles. Enhanced text differs from clean only in bracket tags, punctuation, and capitalization — **none of which are spoken words** — so the clean transcript still aligns to the audio and `mapAlignedWords` still maps it onto the live DOM exactly.

## 4. Components

### 4.1 Artifact: `tools/audio/narration/<slug>.json`

One committed file per article, authored once.

```json
{
  "slug": "the-friction-spectrum",
  "blocks": [
    {
      "index": 0,
      "clean": "Calibrated friction: seams matched to stakes.",
      "enhanced": "Calibrated friction… [exhales] seams matched to stakes."
    }
  ]
}
```

- `clean` — the block's original `blockNarrationText`, stored for human review/diffing (not strictly required by the loader, but makes the artifact self-documenting and reviewable).
- `enhanced` — the director's version: `clean` plus additive `[tags]`, ellipses, caps, and `?`/`!`, with the spoken-word sequence preserved.
- Block `index` matches `extractBlocks` order.

### 4.2 Module: `lib/enhance.js`

Pure, testable; no network. Public surface:

- `stripTags(text)` → removes only bracketed `[...]` tags; leaves words, ellipses, caps, punctuation.
- `normalizeWords(text)` → strip tags → lowercase → remove punctuation → collapse whitespace → `split` into a word array. (Punctuation removal must treat `…` and `...` and standard ASCII punctuation as separators so they never become or split words.)
- `sameWords(a, b)` → `normalizeWords(a)` deep-equals `normalizeWords(b)`.
- `loadEnhanced(slug, blocks, { dir, onWarn })` → `[{ index, clean, tagged }]`:
  - Read `<dir>/<slug>.json` (default `dir = tools/audio/narration`). If missing → every block falls back to `tagged = clean` + one warning.
  - For each **live** block (from `extractBlocks`), find the artifact entry by `index`.
  - Accept the entry's `enhanced` as `tagged` **iff** `sameWords(stripTags(enhanced), liveBlock.text)`. Otherwise `tagged = liveBlock.text` (clean) + per-block warning (artifact missing the index, or stale vs. a changed article).
  - `clean` in the returned tuple is always the **live** block text, so downstream alignment/DOM mapping is always against the current article.

### 4.3 `build-audio.mjs` edits

- Stage 2: replace the `cfg.anthropicApiKey ? tagBlocks(...) : passthrough` branch with `const enhanced = loadEnhanced(slug, blocks)`.
- Remove `anthropicApiKey` / `anthropicModel` from `cfg` and the `tagBlocks` import; import `loadEnhanced`.
- Voice settings:
  ```js
  const NARRATION_VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true };
  ```
- `--dry-run`: drop the "Claude tagging pass per block" line; report enhanced-vs-clean char delta per article from the committed artifacts instead.

### 4.4 Config checkpoint (operator action, not code)

`ELEVENLABS_NARRATION_VOICE_ID` is, per the doc, the single most important v3 lever. Confirm it points at an **expressive IVC or designed voice** suited to calm, contemplative reading — **not** a PVC (the doc notes PVCs are not yet optimized for v3) and not a flat/robust voice. If the current voice is wrong, no amount of tagging will sound like an audiobook. This is called out in the plan as a pre-flight check before the first real build.

## 5. The Enhancement Voice (authoring guide)

Authored to "quiet awe like stargazing, never performative":

- **Ellipses (`…`) are the primary pause lever** — placed at genuine reflective beats and natural breath points. v3 has no SSML break tags; ellipses are the most natural and reliable pause control.
- **`[sighs]` / `[exhales]` sparingly** — only where the prose itself turns or settles, never decoratively.
- **`[curious]` / `[thoughtful]`** occasionally, only where a sentence genuinely shifts register.
- **Caps on at most one pivotal word** per passage, for gentle emphasis. Never shout.
- Cadence: most paragraphs get one light touch; some get none. The read should *breathe*, never *perform*.
- **Forbidden:** literal SFX tags (`[applause]`, `[door slams]`), music, ambience, multi-voice, and any tag that implies acting over reading.
- **Invariant the author must hold:** the spoken-word sequence of `enhanced` (after `stripTags`) must equal `clean` word-for-word — same words, same order. Only tags/ellipses/caps/`?`/`!` may be added. The artifact-validation test (§7) enforces this; the guide is just the intent.

## 6. Error Handling

- **Missing artifact** → all blocks fall back to `clean`; one warning. Build still succeeds (flat read), never desynced.
- **Missing/extra block index, or stale entry** (article changed) → that block falls back to `clean`; per-block warning. Caught by `sameWords`.
- **Word-sequence mismatch** on any block → fall back to `clean` for that block; warning. This is the single guard keeping karaoke exact.
- **Alignment loss gate** (`loss > 0.5`) and **duration cross-check** → unchanged from the v3 design.
- **v3 voice_settings shape** → if v3 rejects a field, the existing `call()` surfaces the error verbatim; drop the field and retry. Audio still generates.
- **Missing `ELEVENLABS_API_KEY`** for a real run → clear failure, per-slug isolation. No Anthropic key is required anymore.

## 7. Testing

**Unit (`node:test`):**
- `lib/enhance.test.js`:
  - `stripTags` removes only `[...]`; leaves ellipses, caps, punctuation, words.
  - `normalizeWords` / `sameWords` are insensitive to caps, punctuation, and ellipses, but **detect** an added word, a removed word, and a reordered word.
  - `loadEnhanced`: happy path returns `tagged = enhanced`; missing file → all clean + warn; mismatched/stale block → that block clean + warn; live `clean` always reflects the passed-in blocks, not the artifact.
- **Artifact-validation test** (e.g. `tools/audio/narration/narration-artifacts.test.js`): for every committed `<slug>.json`, run `extractBlocks` on the live article and assert `sameWords(stripTags(enhanced), liveBlock.text)` for every block. **This makes a desynced-karaoke build impossible to commit.**
- Existing `align.test.js`, `align-map.test.js` — unchanged, must still pass.

**Manual (browser, `http://localhost:8080/`):** build one article with `--local-out`, serve, verify with `?awLocal`:
- The read clearly breathes/pauses — no longer monotone (the primary acceptance check).
- Karaoke highlight advances word-by-word, stays lit through pauses/sighs, auto-scroll follows.
- Scrub/speed work; coexists with `highlights.js`; `prefers-reduced-motion` respected.
- Spot-check the quiet-awe bar: expressive but never performative; chunk seams inaudible.

## 8. Files Changed

**New**
- `tools/audio/lib/enhance.js` (+ `enhance.test.js`) — artifact loader, `stripTags`, `normalizeWords`, `sameWords`.
- `tools/audio/narration/<slug>.json` × 5 — committed enhanced transcripts (one per article).
- `tools/audio/narration/narration-artifacts.test.js` — validates every artifact against live extraction.

**Edit**
- `tools/audio/build-audio.mjs` — stage 2 uses `loadEnhanced`; voice settings (`stability 0.5`, drop `speed`/`style`); remove Anthropic config + import; update `--dry-run` lines.
- `tools/audio/.env.example` — remove `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`.
- `PROJECT_STATUS.md` — document the committed-transcript director step and the no-recurring-cost decision.

**Delete**
- `tools/audio/lib/tag.js`, `tools/audio/lib/tag.test.js` — live-API tagger retired.

**Unchanged** (load-bearing, confirmed compatible)
- `shared/audio-player.js`, `shared/audio-tokenize.js`, `shared/audio-player.css` — `narration.json` shape preserved.
- `lib/extract.js`, `lib/chunk.js`, `lib/encode.js`, `lib/pcm.js`, `lib/align.js`, `lib/align-map.js`, `lib/upload.js`, `synthesizeV3()` — reused as-is.

## 9. Cost

Per article, one-time: **v3 TTS** at 1 credit/char on the enhanced text (tags/ellipses add a small char overhead) + **one Forced Alignment** call per file (paid; existing). **No LLM tagging cost** — the director step is committed authoring. `--dry-run` prints the enhanced-char total and the alignment line item only.

## 10. Risks / Tradeoffs

- **Artifact staleness.** If an article's prose changes, its enhanced file goes stale. Mitigated by the `sameWords` per-block fallback (stale blocks read clean, never desync) and the artifact-validation test that fails CI/local checks before a stale artifact can ship a bad build.
- **Authoring quality is the product.** The whole improvement rests on the five hand-authored transcripts hitting the quiet-awe bar. Mitigated by the explicit authoring guide (§5) and a manual listen acceptance check (§7).
- **v3 voice-settings shape.** `stability: 0.5` and dropping `speed`/`style` is the doc-recommended profile but unverified against the live API; confirm on first real run and drop any rejected field.
- **Voice selection out of our code.** The biggest single lever (the voice itself) is an env var. If it's a flat/PVC voice, tagging can't rescue it — hence the §4.4 pre-flight checkpoint.
- **Loosened guard.** Moving from exact-string to word-sequence equality is a deliberate widening. It is still strict on the only thing karaoke depends on (the spoken-word sequence) and is enforced by tests on the real artifacts, not by trust.

## 11. Out of Scope

- **Podcast** (two-host) — separate, later effort.
- **Background music, SFX, ambience, literal sound-effect tags, multi-voice/character voices** — pure audiobook, expressive voice only.
- **Runtime/on-demand TTS, user-selectable voices, multi-language, downloadable audio, listen analytics, reading footnotes aloud** — revisit only if requested.
- **Re-authoring the article prose itself** — the director only adds delivery cues; it never rewrites the essays.
