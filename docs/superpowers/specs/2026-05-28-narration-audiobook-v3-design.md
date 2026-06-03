# Audio v2 — Narration (Audiobook) — Design

> **Date:** 2026-05-28
> **Status:** Approved (brainstorming) — pending implementation plan
> **Scope:** Upgrade the per-article **Narration** mode to an **audiobook-grade** read using ElevenLabs **`eleven_v3`** with sparse, contemplative inline delivery tags (inserted by an LLM "Enhance" replica), and rebuild karaoke word timings from the **Forced Alignment API** instead of inline TTS timestamps. **Narration only — podcast is explicitly deferred to a separate, later effort.** Pure audiobook: expressive voice only, **no background music, no SFX.**

---

## 1. Goal

Let a reader open any of the five articles, hit play on **Narration**, and hear a read that feels like a premium audiobook — a single expressive voice, breathing where the prose breathes, pausing where the prose pauses — while karaoke-style word highlighting illuminates each spoken word and auto-scrolls the page.

This is a quality upgrade to the **already-shipped** narration pipeline, which currently uses `eleven_multilingual_v2` via `synthesizeWithTimestamps` (inline character timestamps) → `map.js`. The v3 path trades inline timestamps (unreliable on v3) for the model-agnostic **Forced Alignment API**, and adds an LLM tagging step for expressiveness.

It must clear the project's quality bar: "quiet awe like stargazing," contemplative, never gimmicky. The voice may sigh or pause; it must never perform. **Delivery tags only — no literal sound effects** for this reflective essay series.

## 2. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Scope | **Narration only** | Podcast is a separate, later effort — out of scope here. |
| Quality target | **Audiobook** | A premium, expressive single-voice read. |
| Sound design | **Pure audiobook — expressive voice ONLY** | No background music, no SFX (user choice). |
| TTS model | **`eleven_v3`** (`model_id: "eleven_v3"`) in the chosen Library voice (`ELEVENLABS_NARRATION_VOICE_ID`) | GA via standard `POST /v1/text-to-speech/{voice_id}`; 1 credit/char (same as v2); richer expressiveness than v2. |
| Expressiveness | **Sparse inline v3 audio tags** (`[pause]`, `[sighs]`, light emphasis) inserted by an **LLM "Enhance" replica step (Claude)** | There is **no** ElevenLabs Enhance API; we insert tags ourselves. v3 renders tags inline in one pass. Tags are **delivery-only** (pacing/breath/emphasis), never literal SFX. |
| Karaoke timings | **Forced Alignment API** (`POST /v1/forced-alignment`) | v3 inline `with-timestamps` is unreliable/unconfirmed. Forced alignment is model-agnostic; one call aligns a full 10–15 min file against a plain transcript. |
| Alignment/highlight contract | Align and highlight the **tag-free** text from `blockNarrationText`; tagged text is used **only** for the TTS call | Keeps `clean` text (alignment + DOM mapping) and `tagged` text (TTS) word-for-word identical except for additive bracket tags. |
| Chunking / stitching | Chunk **tagged** text on block/paragraph boundaries under **~5,000 chars**; **no request-stitching** (`previous_request_ids` unavailable on v3) | v3's per-request limit is ~5k chars and it does not support stitching; mitigate seams by cutting at natural breaks + gapless `concatMp3`. |
| Output format | **`mp3_44100_192`** (Creator tier); configurable to `pcm_44100` on Pro via existing `ELEVENLABS_NARRATION_OUTPUT_FORMAT` | Reuses the existing format switch in `build-audio.mjs`. |
| Upload / manifest / player | **Unchanged** (`lib/upload.js`, `shared/audio-player.js`) | We emit the same `narration.json` shape the player already consumes. |

## 3. Architecture

The two decoupled halves are unchanged: an offline Node CLI (`tools/audio/`) produces artifacts and uploads them to Firebase Storage; the browser player (`shared/audio-player.js`) lazily consumes them. **Only the narration build path changes.** The player and the upload/manifest layer are untouched.

The new narration build is a **7-stage pipeline**. Stages 2, 3, 5, and 6 are new or rewritten; the rest reuse existing, tested modules.

```
 articles/<slug>/index.html
        │
   (1) extract            lib/extract.js  (UNCHANGED — shared tokenizer)
        │   blocks: [{ index, text(=clean) }]
        ▼
   (2) tag                lib/tag.js      (NEW — LLM "Enhance" replica, Claude)
        │   blocks: [{ index, clean, tagged }]   (tagged = clean + additive bracket tags)
        ▼
   (3) synthesize (v3)    lib/elevenlabs.js: synthesizeV3()  (NEW)
        │   chunk TAGGED text < ~5k chars on block boundaries; no stitching
        │   per-chunk MP3 (or PCM)
        ▼
   (4) concat             lib/encode.js: concatMp3 / encodeMp3FromPcm  (UNCHANGED)
        │   one gapless narration.mp3  +  true total duration (ffprobe / PCM samples)
        ▼
   (5) align              lib/align.js: forcedAlign()  (NEW)
        │   POST /v1/forced-alignment  { file: narration.mp3, text: full CLEAN transcript }
        │   → { characters[], words:[{text,start,end,loss}], loss }
        ▼
   (6) map                lib/align-map.js: mapAlignedWords()  (NEW — replaces char-mapping)
        │   walk flat aligned words[] back onto blocks/words in order
        │   → narration.json  { duration, blocks:[{index, words:[{text,start,end}]}] }
        ▼
   (7) upload             lib/upload.js  (UNCHANGED)
                          audio/<slug>/{narration.mp3, narration.json, manifest.json}
```

The contract that makes (5)+(6) work: the alignment `text` is the **clean** blocks joined with `JOIN_SEPARATOR` — exactly the string the old char-mapping used — so the returned `words[]` come back in the same reading order the player re-tokenizes the live DOM into. The tagged text never reaches alignment or the DOM.

## 4. Build Pipeline (`tools/audio/`)

Run per article on demand, idempotent, never in the browser. Reads `ELEVENLABS_API_KEY` (and, for stage 2, an Anthropic key — see §4.2) from the environment.

### 4.1 Stage 1 — Extract (unchanged)

`lib/extract.js` → `extractBlocks(html)` → `[{ index, text }]` where `text` is `blockNarrationText(el)` (footnote-ref sups stripped, whitespace collapsed). This `text` is the **`clean`** variant throughout the rest of the pipeline. No change.

### 4.2 Stage 2 — Tag (NEW): `lib/tag.js`

An LLM "Enhance" replica that turns each block's `clean` text into a `tagged` variant carrying sparse v3 delivery tags. There is no ElevenLabs Enhance endpoint; we own this step.

- **Signature:** `await tagBlocks(blocks, { apiKey, model, callImpl })` → `[{ index, clean, tagged }]`. `callImpl` (the LLM call) is injectable so the prompt-assembly and the tag-validation can be unit-tested without the network.
- **Model:** Claude (Anthropic SDK / Messages API). Key from `ANTHROPIC_API_KEY`; model id configurable via `ANTHROPIC_MODEL` (default a current Claude model). Reuses the project's Firebase-agnostic env pattern in `build-audio.mjs`.
- **Per-block call** (not whole-article) so a tag in one block can never shift another block's word alignment, and so the strict invariant in §6 is checked per block.
- **Hard invariant — tags are ADDITIVE ONLY.** The LLM may insert bracketed tags (`[pause]`, `[sighs]`, `[whispers]`-class delivery cues) between/around words and may not change, reorder, add, or remove any spoken word. After the call, `lib/tag.js` runs `stripTags(tagged)` and asserts it equals `clean` (after `collapseWhitespace`). If they differ, the block **falls back to `tagged = clean`** (un-tagged but safe) and logs a warning. This guarantees `clean` and `tagged` stay word-aligned no matter what the model returns.
- **Tagging strategy / prompt principles:**
  - Sparse — most blocks get **zero or one** tag; a tag every few sentences at most.
  - Contemplative — `[pause]` at reflective beats, a soft `[sighs]`/`[exhales]` only where the prose itself turns; gentle emphasis on a single pivotal word.
  - Delivery-only — **no literal sound-effect tags** (no `[door slams]`, `[applause]`, etc.). This is a quiet essay, not a drama.
  - Word-preserving — the prompt states explicitly that the spoken words must be returned verbatim; tags are bracketed insertions only. The §6 strip-check is the enforcement, not the prompt's good behavior.

### 4.3 Stage 3 — Synthesize with v3 (NEW): `synthesizeV3()` in `lib/elevenlabs.js`

A new sibling to `synthesizeWithTimestamps` (the v2 function stays for the legacy path / podcast effort). Plain TTS, **no** `with-timestamps`, **no** `previous_request_ids`.

```
POST /v1/text-to-speech/{voiceId}?output_format={fmt}
body: { text: <TAGGED chunk>, model_id: "eleven_v3", voice_settings }
→ { audio: Buffer }     // audio bytes only; v3 inline timestamps not used
```

- Chunk the **tagged** text via `chunkBlocks(taggedBlocks, V3_MAX_CHARS)` with `V3_MAX_CHARS ≈ 4500` (margin under v3's ~5,000 limit; tags inflate char count, so the cap is on the **tagged** length). Cut only on block boundaries (`JOIN_SEPARATOR`) → natural breath points, which also softens the no-stitching seam.
- One request per chunk, sequential (no parallel calls — politeness + ordering). Each returns audio only.
- Voice settings: keep the contemplative profile (`stability ~0.6, similarity_boost ~0.75, style 0, speed ~0.95, use_speaker_boost`); confirm v3 accepts the same `voice_settings` shape at implementation time and drop any field v3 rejects.

### 4.4 Stage 4 — Concat (unchanged): `lib/encode.js`

- MP3 path (Creator tier, `mp3_44100_192`): `concatMp3(audioParts, { bitrate: '192k' })` — ffmpeg concat-demuxer, gapless.
- PCM path (Pro tier, `pcm_44100`): `Buffer.concat` the PCM, then `encodeMp3FromPcm(...)` once.
- **Total duration** comes from the encoded file, not from any timestamp: `probeDurationSeconds(mp3)` (MP3) or `pcmDurationSeconds(bytes)` (PCM). This is also a sanity check against the alignment's max `end` (§7).

### 4.5 Stage 5 — Align (NEW): `lib/align.js`

```
POST /v1/forced-alignment        (multipart/form-data)
  file: <the full narration.mp3 bytes>          (Blob/Buffer)
  text: <full CLEAN transcript>                 (blocks joined by JOIN_SEPARATOR, NO tags)
→ { characters:[{text,start,end}], words:[{text,start,end,loss}], loss }
```

- **Signature:** `await forcedAlign({ apiKey, audio, transcript, contentType }, fetchImpl)` → the parsed response. `fetchImpl` injectable for tests; we assert the multipart body carries `file` + `text` and that `text` is tag-free.
- One call per article handles the whole 10–15 min file (model-agnostic; paid).
- Uses the same `call()` helper already in `lib/elevenlabs.js` for status/error handling, but lives in its own small module since it's a distinct endpoint and concern.
- We consume `words[]` for highlighting and `loss` (response-level and per-word) for the quality gate (§7). `characters[]` is ignored.

### 4.6 Stage 6 — Map (NEW): `lib/align-map.js` — replaces char-mapping

Maps the flat aligned `words[]` back onto blocks → the **same** `narration.json` shape the player consumes. `map.js` (char-timestamp mapping) is **retired from the v3 path** (kept only if the legacy v2 path is retained).

- **Input:** the article's `clean` blocks `[{ index, text }]` (same order/text sent to alignment) + the alignment `words[]`.
- **Algorithm:** for each block in order, `tokenizeWords(block.text)` to get the expected word count, then consume that many entries off the front of the flat `words[]` cursor, in sequence. For each consumed word, emit `{ text, start, end }` rounded to 4 dp. Because the alignment transcript is exactly these blocks joined in order, the flat list is monotonic and word *i* of the flat list lines up with the next expected token.
- **Robustness:** verify each consumed `words[i].text` matches the expected token text (case/punct-normalized). The forced-aligner sometimes splits/merges on punctuation; the mapper tolerates minor token-count drift by re-syncing on the next exact text match within a small window, and logs if drift exceeds a threshold (feeds §7). The aligner never sees tags, so it cannot emit a tag as a "word."
- **Output (matches `audio-player.js` exactly):**
  ```json
  {
    "duration": 734.21,
    "blocks": [
      { "index": 0, "words": [ { "text": "AI", "start": 0.12, "end": 0.34 } ] }
    ]
  }
  ```
  Same `{ duration, blocks:[{ index, words:[{text,start,end}] }] }` contract `mapNarration` produced. `duration` = `max(word.end)` (cross-checked against the encoded duration). No `voice`/`locator`/`blockChar*` fields are required by the current player (`buildWordIndex` re-tokenizes the live block and matches by `index` + position), so we omit them, exactly as the shipped `mapNarration` does.

### 4.7 Stage 7 — Upload (unchanged): `lib/upload.js`

`uploadArtifacts` + `buildManifest` write `audio/<slug>/{narration.mp3, narration.json, manifest.json}` with immutable cache headers. Manifest shape (`modes.narration = { audio, timings, duration }`) is unchanged.

### 4.8 Orchestration (`build-audio.mjs`)

`buildNarration(slug, blocks, cfg)` is rewritten to the 7-stage flow: `tagBlocks` → chunk tagged → `synthesizeV3` per chunk → concat → `forcedAlign(full mp3, full clean transcript)` → `mapAlignedWords` → return `{ mp3, json }`. `cfg` gains `anthropicApiKey`, `anthropicModel`, and keeps `narrationVoiceId`, `narrationOutputFormat`, and a v3 `modelId` (`eleven_v3`). CLI flags (`--article`, `--mode narration`, `--dry-run`, `--local-out`, `--max-chars`) are unchanged; `--dry-run` reports tagged-char counts and the added forced-alignment + Claude line items in the cost summary.

## 5. Player Integration

**No player change required.** `shared/audio-player.js` already consumes `{ duration, blocks:[{index, words:[{text,start,end}]}] }`, re-tokenizes each live block with `blockNarrationText` + `tokenizeWords`, matches words by `index` + ordinal in `buildWordIndex`, and highlights via the CSS Custom Highlight API. Since `narration.json` is built from the **clean** transcript (identical to what the DOM tokenizes to), the index/ordinal match is exact.

Non-verbal tag sounds (a sigh, a held pause) are simply **extra audio between spoken words**. The forced-aligner's `words[]` contains only spoken words, so the highlighter tracks only spoken words — during a `[pause]` or `[sighs]`, the previously-highlighted word stays lit until the next spoken word begins, which reads as a natural dwell. No special handling, no player edit.

## 6. Error Handling

- **Tag-strip correctness (critical).** Per block, assert `collapseWhitespace(stripTags(tagged)) === clean`. On mismatch → fall back to `tagged = clean` for that block + warn. This is the single guard that keeps `clean`/`tagged` word-aligned; without it a stray model edit would desync every downstream word. Unit-tested (§7).
- **Alignment quality gate (per article).** After `forcedAlign`, reject if the response-level `loss` exceeds a threshold (e.g. `> 0.5`, tuned on the first real run) or if too many per-word `loss` values are high; fail the article with a clear message rather than ship drifting karaoke. Also assert `abs(max(word.end) − encodedDuration)` is small.
- **Mapper drift.** If `mapAlignedWords` can't re-sync within its window (token-count mismatch beyond threshold), fail the article with the offending block index — never emit a silently misaligned `narration.json`.
- **Chunk seams.** Chunk only on block boundaries so every cut is a paragraph break; rely on `concatMp3`/PCM concat for gapless joins. If an audible seam is found in manual QA, the mitigation is to merge the two blocks into one chunk (fewer, larger cuts) — bounded by the ~5k limit.
- **Tier/format.** Default `mp3_44100_192` (Creator). `ELEVENLABS_NARRATION_OUTPUT_FORMAT=pcm_44100` switches to the Pro PCM path. If a tier rejects the format, surface ElevenLabs' error verbatim (existing `call()` does this).
- **Missing keys.** Clear failure if `ELEVENLABS_API_KEY` or `ANTHROPIC_API_KEY` is missing for a real (non-dry) narration run; per-`slug` isolation so one article's failure doesn't corrupt others.
- **Player side (unchanged):** missing/failed manifest or asset → player hides; article unaffected.

## 7. Testing

**Unit (pure pieces, `node:test`):**
- `lib/tag.js` — `stripTags` removes only bracketed tags and leaves spoken words intact; the additive-only invariant holds for representative tagged outputs; a model output that alters a word triggers the `tagged = clean` fallback. (LLM call mocked via `callImpl`.)
- `lib/align.js` — `forcedAlign` builds correct multipart (`file` + `text`), and the `text` passed is tag-free; error path on non-OK response.
- `lib/align-map.js` — `mapAlignedWords` on a fixture aligned `words[]`:
  - **monotonicity** — emitted word `start`/`end` are non-decreasing across the flat list;
  - **block partition** — per-block word counts equal `tokenizeWords(block.text).length` (within the documented re-sync tolerance);
  - **word-text match** — emitted `words[i].text` matches the expected token text;
  - output validates against the `{duration,blocks:[{index,words:[{text,start,end}]}]}` shape.

**Manual (browser, `http://localhost:8080/`):** build one article with `--local-out`, serve, and verify with `?awLocal`: play → highlight advances word-by-word and stays lit through pauses/sighs, auto-scroll follows, scrub/speed work, coexistence with `highlights.js` selection/reactions, and `prefers-reduced-motion`. Spot-check that the expressive read sounds like an audiobook (calm, no gimmickry) and that chunk seams are inaudible.

## 8. Files Changed

**New**
- `tools/audio/lib/tag.js` (+ `tag.test.js`) — LLM Enhance-replica producing `tagged` per block; `stripTags`.
- `tools/audio/lib/align.js` (+ `align.test.js`) — forced-alignment client.
- `tools/audio/lib/align-map.js` (+ `align-map.test.js`) — aligned `words[]` → `narration.json`.

**Edit**
- `tools/audio/lib/elevenlabs.js` — add `synthesizeV3()` (v3 plain TTS, no timestamps/stitching).
- `tools/audio/build-audio.mjs` — rewrite `buildNarration` to the 7-stage flow; add Anthropic config + `eleven_v3` model id; update `--dry-run` cost lines.
- `tools/audio/.env.example` — add `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`; set `ELEVENLABS_MODEL_ID=eleven_v3` (or a dedicated narration model var); note `ELEVENLABS_NARRATION_OUTPUT_FORMAT=mp3_44100_192`.
- `PROJECT_STATUS.md` — document the audiobook narration path + forced-alignment + tagging step.

**Unchanged** (load-bearing, confirmed compatible)
- `shared/audio-tokenize.js`, `shared/audio-player.js`, `shared/audio-player.css` — no edits; `narration.json` shape preserved.
- `lib/extract.js`, `lib/chunk.js`, `lib/encode.js`, `lib/pcm.js`, `lib/upload.js` — reused as-is.
- `lib/map.js` — retired from the v3 path (kept only if the legacy v2 narration path is retained).

## 9. Cost

Per article, one-time: **v3 TTS** at 1 credit/char on the **tagged** text (tags add a small char overhead) + **one Forced Alignment** call for the full file (paid, flat-ish per file) + **one Claude** tagging pass per block (small token cost). Across all five articles: still a few dollars one-time. `--dry-run` prints the tagged-char total and flags the added alignment + Claude line items.

## 10. Risks / Tradeoffs

- **v3 seams without stitching.** v3 lacks `previous_request_ids`, so prosody can drift across chunk boundaries. Mitigated by cutting only on paragraph breaks and gapless concat; worst case, merge blocks into fewer/larger chunks (bounded by ~5k). Articles exceed 5k, so ≥2 chunks is unavoidable.
- **Forced-alignment accuracy.** Karaoke is only as good as the alignment. The per-article `loss` gate + the duration cross-check + the mapper's text-match re-sync catch gross failures; fine drift is acceptable for a contemplative dwell-style highlight. v3's inline timestamps were rejected precisely because they're less reliable than forced alignment.
- **Tags must not change spoken words.** The whole `clean`/`tagged` contract — and therefore all karaoke alignment — depends on tags being additive only. Enforced by the post-LLM strip-and-compare with a safe `tagged = clean` fallback, not by trusting the prompt.
- **v3 voice-settings shape.** v3 may accept a different `voice_settings` subset than v2; confirm at implementation and drop rejected fields (audio still generates).

## 11. Out of Scope

- **Podcast** (two-host conversation) — deferred to a separate, later effort.
- **Background music, SFX, ambience, literal sound-effect tags** — pure audiobook, expressive voice only.
- Multi-voice / character voices; user-selectable voices; multi-language audio; runtime/on-demand TTS; reading footnotes aloud; downloadable audio; listen analytics. Revisit only if requested.
