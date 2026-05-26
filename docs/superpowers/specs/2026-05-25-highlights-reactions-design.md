# Highlights & Reactions — Design Spec

**Date:** 2026-05-25
**Status:** Approved (in-conversation)
**Scope:** Add Kindle/Medium-style public highlights, per-highlight reactions, deep-link sharing, and article-level reactions across all 5 article pages.

---

## Goal

Let readers select prose, mark it as a highlight, react to it (heart / clap / like), and share a deep-link to the exact passage. Existing highlights are publicly visible to everyone — a passage that resonates with one reader visibly resonates for the next. Article-level reactions and a per-article share button anchor the same affordances at the article scope.

The texture should match the project's "quiet awe" aesthetic: soft amber wash on highlighted text whose intensity scales with crowd density, restrained typographic floating menu, no chrome that fights the prose.

## Architecture

- **Backend:** Firebase — Firestore for highlight + reaction state, Anonymous Auth for stable per-browser identity. Free tier well within limits for this site.
- **Identity:** Every browser gets a Firebase anonymous `uid`. Optional display name (typed once, persisted locally; only shown if user opts in). Counts shown publicly; names only when explicitly attached.
- **Text anchoring:** Each `<p>`, `<h2>`, `<h3>` inside `.article__prose` gets a sequential `data-pid` (`p-1`, `p-2`, …) assigned at page load. Highlights are stored as `{paragraphId, startOffset, endOffset, quote}`. Quote serves as the resilience fallback when source text edits invalidate offsets.
- **Sharing:** Copy-to-clipboard only. URL fragment encodes the highlight id (`?h=<id>`). On load, the page scrolls to and flashes the highlight.
- **Graceful degradation:** If Firebase config is missing (e.g., during development before config is pasted), the system falls back to a localStorage-backed stub so the UI still functions for that browser. Real Firebase activates the moment config is present — zero code changes.

## Data model (Firestore)

```
articles/{slug}/highlights/{highlightId}
  paragraphId: "p-7"
  startOffset: 23                    // int, char offset in paragraph text
  endOffset: 87                      // int
  quote: "the actual selected text"  // resilience fallback
  creatorUid: "abc123"               // Firebase anon uid
  creatorName: "Jane" | null         // optional display name
  createdAt: serverTimestamp
  reactions: { [uid]: ["heart", "clap"] }   // map of uid → array of reactionType
  counts:    { heart: 8, clap: 3, like: 5, mark: 12, total: 28 }

articles/{slug}/articleReactions/{uid}
  reactions: ["heart", "clap"]       // user can apply multiple types
  updatedAt: serverTimestamp
```

`counts` is denormalized and updated atomically with `FieldValue.increment` whenever `reactions` is mutated. `mark` counts users who highlighted without picking a specific reaction.

## Security rules (sketch)

```
match /databases/{db}/documents {
  match /articles/{slug}/highlights/{id} {
    allow read: if true;
    allow create: if request.auth != null
                  && request.resource.data.creatorUid == request.auth.uid
                  && request.resource.data.quote is string
                  && request.resource.data.quote.size() < 5000;
    // Reactions: any authed user can update their own entry in reactions map
    allow update: if request.auth != null
                  && onlyReactionFieldsChanged(request.resource.data, resource.data, request.auth.uid);
    allow delete: if false;
  }
  match /articles/{slug}/articleReactions/{uid} {
    allow read: if true;
    allow write: if request.auth != null && uid == request.auth.uid;
  }
}
```

`onlyReactionFieldsChanged` will be expressed inline in the actual rules file — it asserts that only `reactions[uid]` and the matching count deltas changed.

## UI

### Selection floating menu

Triggers on `selectionchange` when selection range is non-empty AND inside `.article__prose`. Positions just above the selection, anchored to the start of the selection.

```
┌─────────────────────────────────────────────┐
│  Highlight   ♥    👏    👍    ⤴ Copy link  │
└─────────────────────────────────────────────┘
              ▼
[selected text]
```

- `Highlight` → creates a plain `mark` (counts toward total but no reaction)
- `♥ / 👏 / 👍` → creates a highlight + applies that reaction
- `Copy link` → creates a highlight + copies deep-link URL to clipboard + toast

### Existing highlight rendering

Highlights inside the prose render as `<mark class="hl">` with background `rgba(251, 191, 36, α)` where `α = clamp(0.10 + 0.04 * count, 0.10, 0.40)`. Overlapping highlights combine intensity. Border-radius 2px, padding 0 1px.

### Hover tooltip

On `:hover` of a `mark.hl`, a small tooltip appears positioned to the right edge of the highlight (above on mobile):

```
┌────────────────────────────────┐
│ 12 highlights                  │
│ ♥ 8   👏 3   👍 5              │
│                                │
│ [ ♥ ]  [ 👏 ]  [ 👍 ]   ⤴      │
└────────────────────────────────┘
```

Reaction buttons in the tooltip toggle the current user's reaction. The user's existing reactions are shown filled.

### Article-level reactions row

Inserted after the footnotes section, before the prev/next nav:

```
┌────────────────────────────────────────────┐
│   ♥ 47       👏 12       👍 31     ⤴       │
└────────────────────────────────────────────┘
```

Same visual language as the highlight tooltip — toggleable, shows user's current state, copy-article-link button on the right.

### Deep-link behavior

URL `?h=<highlightId>` on load:
1. Wait for highlights to render
2. Scroll smoothly to the highlight (center it in viewport)
3. Animate brightness: 0.18 → 0.55 → 0.18 over 1.5s
4. After 2s, strip the `?h=` from URL via `history.replaceState`

### Toast

A subtle bottom-center toast for confirmations ("Link copied"). Auto-dismiss after 2.5s. CSS only — no library.

### Display-name prompt

The first time the user applies a reaction or highlight, a small inline prompt above the floating menu:
```
[ Stay anonymous ]   |   [ Name: __________ ] [ Save ]
```
Choice is persisted in localStorage. If they pick "Stay anonymous," they never see the prompt again. They can change later via... TBD (probably no UI in v1; can edit localStorage).

## Files

### New

- `shared/firebase-config.example.js` — committed template. Tells the user what to paste where.
- `shared/firebase-config.js` — gitignored. Real config goes here.
- `shared/firebase-init.js` — initializes Firebase SDK (modular v10+ via CDN), exports `db`, `auth`, plus a `isConfigured` boolean for the fallback layer.
- `shared/highlights-data.js` — data interface: `getHighlightsForArticle(slug)`, `createHighlight(slug, range, reactionType?, displayName?)`, `toggleReaction(slug, highlightId, type)`, `getArticleReactions(slug)`, `toggleArticleReaction(slug, type)`. If `isConfigured` is false, all methods route through a localStorage stub.
- `shared/highlights.js` — the UI layer: paragraph ID assignment, selection menu, highlight rendering, hover tooltip, share UI, deep-link handler.
- `shared/highlights.css` — all visual styles for the system.

### Modified

- `.gitignore` — add `shared/firebase-config.js`
- `articles/*/index.html` ×5 — add `<link rel="stylesheet" href="../../shared/highlights.css">`, three `<script type="module">` imports for init/data/UI, the `<div id="toast" role="status" aria-live="polite"></div>` container, and (Phase 3) the article-reactions footer row markup.

### Firestore rules

- `firestore.rules` (new, project root) — committed. Deployed manually by user via `firebase deploy --only firestore:rules` once project is set up.
- `firebase.json` (new, project root) — committed. Minimal — just rules pointer.

## Phasing

### Phase 1 — Foundation + highlights (PR 1)

- Firebase init + data layer with localStorage fallback
- Paragraph ID auto-assign
- Selection menu with **just the Highlight button**
- Render existing highlights with intensity wash
- Simple hover tooltip showing total count only

Ships a working highlight-and-render experience. Can validate UX before stacking reactions.

### Phase 2 — Reactions (PR 2)

- Add ♥/👏/👍 buttons to selection menu and hover tooltip
- Atomic reaction count updates
- Tooltip shows reaction breakdown
- Click-existing-highlight opens tooltip for reaction-add

### Phase 3 — Sharing + article-level (PR 3)

- Copy-link in selection menu and hover tooltip
- Deep-link `?h=` handler with scroll + flash
- Article footer reactions row
- Article-level copy-link
- Toast confirmations everywhere

## Open questions / risks

- **Mobile text selection** fights with native selection menus. v1 plan: use `selectionchange` event; if jank shows up, fall back to a margin-anchored "highlight this" button that appears when selection exists.
- **Abuse:** any browser can write. For a personal essay site, fine. If spammed, add Firebase App Check (~5 min) and/or rate-limit per uid via rules.
- **Highlight orphaning:** if I edit an article, paragraph indices shift and existing highlights drift. The `quote` fallback re-anchors. If even the quote isn't found, the highlight becomes orphaned but its count still contributes to per-article totals.
- **Display-name editability** in v1: no UI to change once set. Acceptable.
- **Firestore region:** picks the user's nearest by default; performance fine for our scale either way.

## Definition of done (whole feature)

- All 5 articles support highlighting + reactions + deep-link share
- Real Firebase backend live; localStorage fallback verified to NOT activate when config present
- Live site (anuragid.github.io/intentional-ai-deployment) shows highlights persisting across reloads and across browsers
- Mobile selection works (selection menu appears on tap-and-hold-and-release)
- Reduced-motion: highlight intensity unchanged, deep-link flash replaced with instant settle
- Keyboard accessible: selection menu reachable via Tab after selection; reactions toggleable with Enter/Space
