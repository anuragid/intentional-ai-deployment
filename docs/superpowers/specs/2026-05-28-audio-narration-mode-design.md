# Audio Mode for Articles — Design

> **Date:** 2026-05-28
> **Status:** Approved (brainstorming) — pending implementation plan
> **Scope:** Add a per-article audio experience with two modes (faithful narration + two-host podcast), pre-generated via ElevenLabs and served from Firebase Storage, played by a contemplative in-article player with karaoke-style synced highlighting.

---

## 1. Goal

Let a reader open any of the five articles, hit play, and hear a **really high-quality** rendering of the piece. Two modes per article:

- **Narration** — a single premium voice reads the article **verbatim**. Karaoke-style synced highlighting illuminates each word as it is read and auto-scrolls the page.
- **Podcast** — a NotebookLM-style **two-host conversation** about the article (generated end-to-end by ElevenLabs). Plays with a scrolling speaker transcript; no word-level highlight against the article body (the podcast paraphrases, so the words would not match).

This must clear the project's quality bar: contemplative, "quiet awe like stargazing," inviting exploration — not a bolted-on play button.

## 2. Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Formats | Narration **and** Podcast, per article | User wants both offered. |
| Generation timing | **Pre-generated offline**, served as static assets | 5 rarely-changing articles → zero per-play cost, no API keys in the browser, premium quality, instant playback. |
| Engine | **ElevenLabs for both** | Best verbatim narration quality + first-class podcast generation, one API key. |
| Narration sync | **Word-level karaoke + auto-scroll** | The "awe" feature; uses ElevenLabs character-level timestamps. |
| Podcast generation | **ElevenLabs Create Podcast API** (end-to-end) | Its own LLM writes the two-host script from the source — no separate scripting step. |
| Asset hosting | **Firebase Storage** (`audio/{slug}/...`) | Keeps git clean; stays in the existing Firebase ecosystem. |

## 3. Architecture

Two independent halves:

- **A. Offline build pipeline** — a Node CLI under `tools/audio/` run on demand by the author. Produces audio + timing JSON and uploads to Firebase Storage.
- **B. Runtime player** — `shared/audio-player.js` + `shared/audio-player.css`, loaded by each article the same way `highlights.js` / `article.css` are.

The two halves communicate only through artifacts in Firebase Storage and a small per-slug manifest. Neither knows the other's internals.

```
articles/*/index.html ──(data-slug)──▶ audio-player.js
                                          │  fetch manifest + asset URLs (lazy)
                                          ▼
                              Firebase Storage  audio/{slug}/
                                 narration.mp3 / narration.json
                                 podcast.mp3   / podcast.json
                                 manifest.json
                                          ▲
                                          │ upload
                       tools/audio/build-audio.mjs ──▶ ElevenLabs API
```

## 4. Build Pipeline (`tools/audio/`)

Run per article on demand. Idempotent; never runs in the browser. Reads `ELEVENLABS_API_KEY` from the environment (`.env`, gitignored).

### 4.1 Modules (small, single-purpose)

- `build-audio.mjs` — CLI entry / orchestration.
- `lib/extract.js` — HTML → ordered narratable blocks.
- `lib/elevenlabs.js` — narration (TTS-with-timestamps) and podcast (Create Podcast) API calls.
- `lib/map.js` — character timestamps → block/word timing JSON.
- `lib/upload.js` — push artifacts + manifest to Firebase Storage.

### 4.2 CLI

```
node tools/audio/build-audio.mjs --article <slug> [--mode narration|podcast|both] [--dry-run]
```

- `--article all` processes every article; default mode `both`.
- `--dry-run` prints character counts and an estimated cost, generates nothing.
- Each `(slug, mode)` is regenerated independently so a single article can be rebuilt after an edit.

### 4.3 Extract (`lib/extract.js`)

1. Parse the article `index.html` (e.g. `node-html-parser` / `jsdom`).
2. Walk `.article__prose` in document order, collecting **blocks**: paragraphs, `h2`/`h3` headings, blockquotes, list items.
3. Per block, capture: a stable `index`, the element's `textContent` **normalized for narration** (strip footnote-ref superscripts like `<sup class="footnote-ref">`, collapse whitespace), and enough to re-locate the block at runtime (block index + a CSS path or ordinal within `.article__prose`).
4. **Skip** the embed `<figure>`, the reading-progress bar, nav, and header. **Footnotes/Notes section: skipped** from narration (matches verbatim-prose intent; can be revisited).

Output: an ordered array `[{ index, locator, text }]`.

### 4.4 Narration generation

1. Concatenate block texts into the narration script, recording each block's `[charStart, charEnd)` offset within the full string.
2. Chunk on **block boundaries** to respect ElevenLabs input limits. For each chunk call the **TTS-with-timestamps** endpoint → MP3 bytes + per-output-character `{ start, end }` alignment.
3. Stitch chunk MP3s in order, accumulating a global time offset so all timestamps are absolute to the final file.
4. Map character timestamps → blocks (via the recorded offsets) → **words** (split block text on word boundaries; a word's `start` = first char's start, `end` = last char's end). Record each word's char range **within its block's text** so the runtime can re-locate it via the DOM Range API.

Artifacts:
- `narration.mp3`
- `narration.json`:
  ```json
  {
    "duration": 612.4,
    "voice": "<voice_id>",
    "blocks": [
      { "index": 3, "locator": "...", "words": [
          { "text": "AI", "start": 0.12, "end": 0.34, "blockCharStart": 0, "blockCharEnd": 2 }
      ] }
    ]
  }
  ```

### 4.5 Podcast generation

1. Call the **ElevenLabs Create Podcast API**: `source` = article text (or the article URL), `mode: "conversation"`, `host_voice_id` + `guest_voice_id`, optional `instructions_prompt` (steer tone toward the series' contemplative register) and `duration_scale`.
2. It is **asynchronous**: the call returns a Studio *project*. Poll project state (or use `callback_url`) until conversion completes.
3. Export/download the rendered MP3. **Best-effort:** pull the generated script segments from the project for a speaker-labeled transcript.

Artifacts:
- `podcast.mp3`
- `podcast.json`: `{ "duration": …, "transcript": [{ "speaker": "Host"|"Guest", "text": "…" }] }` (transcript omitted gracefully if the project text is not retrievable; **no word-level timings** for podcast).

### 4.6 Upload (`lib/upload.js`)

- Upload artifacts to `audio/{slug}/` in Firebase Storage with long-lived `Cache-Control` (assets are content-stable; bust by versioned filename or metadata when regenerated).
- Write/refresh `audio/{slug}/manifest.json`: which modes exist, durations, asset paths/versions.
- Requires **Storage security rules** (public read for `audio/**`, no client write) and a **CORS config** allowing the hosting origin(s).

## 5. Runtime Player (`shared/audio-player.js` + `.css`)

Loaded by each article alongside the existing highlights assets. **Lazy:** no Storage fetch until the user opens the player; the article is fully functional without audio.

### 5.1 UI

A contemplative sticky player consistent with `design-system.css` (Cormorant Garamond / IBM Plex Sans palette, restrained motion):

- Play / pause
- Scrubber with progress + buffered, current / total time
- Speed control (1× / 1.25× / 1.5× / 2×)
- **Narration ↔ Podcast** segmented toggle — each mode keeps its own playback position; switching swaps the `<audio>` source and the highlight/transcript surface
- "Follow" affordance to re-engage auto-scroll after manual scrolling

### 5.2 Synced highlighting (narration mode)

- On first narration play, for each block, use a **TreeWalker + DOM Range** to wrap word ranges (from `narration.json`'s `blockCharStart/End`) in `<span class="aw-word">` — **preserving inline markup** (links, `<em>`, etc.). Idempotent; wraps once.
- A `requestAnimationFrame` loop reads `audio.currentTime`, binary-searches the flattened word list, and sets the active word (plus a soft current-sentence band).
- Auto-scroll centers the active word smoothly. Manual scroll **pauses** auto-follow until the user taps "Follow."
- Honors `prefers-reduced-motion`: disables auto-scroll animation and word-by-word transitions (still highlights, just without motion).

### 5.3 Podcast mode

Plays `podcast.mp3`; renders the speaker-labeled transcript (if present) with gentle auto-scroll by elapsed fraction. No article-body highlight.

### 5.4 Coexistence & a11y

- Must not conflict with `highlights.js` text-selection/reactions: word spans are inert to selection logic; verify selection + reactions still work while audio plays.
- Full keyboard control and ARIA roles/labels on all controls; announces play state.

## 6. Data Flow

`data-slug` → player reads slug → (on open) fetch `manifest.json` + asset URLs from Storage → load selected MP3 + JSON → rAF loop maps `currentTime` → word highlight + auto-scroll (narration) or transcript scroll (podcast).

## 7. Error Handling

- Missing/failed manifest or asset → player hides (or shows "audio unavailable"); article unaffected.
- Firebase not configured (local `firebase-config.js` absent → localStorage fallback path): player hides, or plays local `audio/{slug}/` files if present for dev.
- Network/CORS error on a Storage URL → graceful fail, no console spam beyond one warning.
- Build script: clear failure if `ELEVENLABS_API_KEY` missing; per-`(slug,mode)` isolation so one failure does not corrupt others; podcast poll has a timeout.

## 8. Testing

- **Build unit tests** (fixture article): `extract.js` produces expected ordered blocks; `map.js` produces word timings that are monotonic non-overlapping and whose char ranges fall within the block text.
- **Runtime manual** across all 5 articles on `http://localhost:8080/`: mode toggle, scrub, speed, mobile layout, `prefers-reduced-motion`, and coexistence with highlights/reactions.
- Optional Playwright smoke test (webapp-testing) for play → highlight advances → auto-scroll.

## 9. Files

**New**
- `tools/audio/build-audio.mjs`, `tools/audio/lib/{extract,elevenlabs,map,upload}.js`
- `shared/audio-player.js`, `shared/audio-player.css`
- `storage.rules`, Storage CORS config (e.g. `tools/audio/cors.json`)
- `.env.example` (`ELEVENLABS_API_KEY`, optional voice IDs)

**Edit**
- each `articles/*/index.html` — link `audio-player.css` + `audio-player.js`, add a mount point
- `firebase.json` — register `storage` rules
- `PROJECT_STATUS.md` — document the audio feature + build command

**Cost:** a few dollars, one-time, for all five articles × two modes.

## 10. Out of Scope (YAGNI)

- Runtime/on-demand TTS; multi-language audio; user-selectable voices; reading footnotes aloud; downloadable audio; analytics on listens. Revisit only if requested.
