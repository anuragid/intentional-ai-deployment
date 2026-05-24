# Embedded Articles with Inline Visualizations — Design Spec

**Status:** Draft, awaiting user approval
**Date:** 2026-05-23
**Author:** Claude (brainstormed with Anurag)
**Type:** Feature design

---

## 1. Purpose

Make the five-part article series *"We Are Choosing By Not Choosing"* readable directly on the site. Each article renders as a native HTML page that includes its corresponding Three.js visualization **embedded inline** at the moment the prose introduces the concept the viz illustrates. A fullscreen icon on each embed navigates to the existing standalone visualization page (which itself was the original "site"). Articles are connected in series with prev/next navigation at the foot of each page. Landing-page bento cards now open the article, not the bare standalone viz.

The bar set in `CLAUDE.md`: *awe-inspiring, groundbreaking, world-changing.* The reading experience must match the craft quality already present in the visualizations and landing page.

---

## 2. Success Criteria

A reader can:

1. Land on `/` (landing page, unchanged visually), click any Part card, and arrive at the corresponding article page.
2. Scroll through the article and reach an embedded, fully-interactive 3D visualization at the point where the prose first introduces its concept.
3. Drag/rotate/zoom/click inside the embed without affecting page scroll.
4. Click the fullscreen icon on the embed and navigate to the standalone visualization (the existing experience we shipped).
5. Hit the browser back button and return to the article at the exact scroll position they left from.
6. Reach the article footer and find prev/next cards leading to the adjacent articles in the series. At Part 1 there is no "previous"; the slot becomes "Back to the series" linking to `/#series`. Same for Part 5's "next".
7. Read the entire series end-to-end without a broken interaction.

Non-functional bar:

- **Visual consistency** with existing landing and viz pages (Cormorant Garamond + IBM Plex Sans, `#08080c` background, existing color tokens).
- **No regressions** to any standalone visualization page when accessed directly.
- **First contentful paint < 1.5s** on the article pages (the embedded viz lazy-loads on scroll).
- **No build step added** — direct CDN loading preserved.
- **Three.js r128 stays locked.**

---

## 3. Architecture Overview

```
intentional-ai-deployment/
├── index.html                       # Landing (unchanged visually; only card hrefs repointed)
│
├── articles/                        # NEW — five article pages
│   ├── friction-reduction/
│   │   └── index.html
│   ├── before-you-automate/
│   │   └── index.html
│   ├── what-ai-cant-see/
│   │   └── index.html
│   ├── designing-around-gaps/
│   │   └── index.html
│   └── cost-of-speed/
│       └── index.html
│
├── shared/
│   ├── article.css                  # NEW — shared reading-shell styles
│   ├── design-system.css            # existing
│   └── ...                          # existing utils/components untouched
│
└── visualizations/                  # Each gets a small `?embed=1` patch
    ├── collaboration-framework/index.html
    ├── four-rungs/index.html
    ├── complementarity-view/index.html
    ├── friction-spectrum/index.html
    └── cost-of-speed/index.html
```

Routing model: pure static, file-path based. No client-side router. Each URL is a real file on disk served by `python3 -m http.server 8080`.

---

## 4. Series Definition (single source of truth)

| Index | Slug | Title | Dek | Viz folder |
|---|---|---|---|---|
| 1 | `friction-reduction` | The Friction Reduction Principle Always Wins | *(dek extracted from PDF)* | `collaboration-framework` |
| 2 | `before-you-automate` | Before You Automate | *(dek extracted from PDF)* | `four-rungs` |
| 3 | `what-ai-cant-see` | What AI Can't See | *(dek extracted from PDF)* | `complementarity-view` |
| 4 | `designing-around-gaps` | Designing Around the Gaps | *(dek extracted from PDF)* | `friction-spectrum` |
| 5 | `cost-of-speed` | The Cost of Speed | *(dek extracted from PDF)* | `cost-of-speed` |

Each article hardcodes its own prev/next neighbour — no shared JS config file. Five files, five footer pairs. Trivial to maintain at this scale; avoids creating an indirection that buys nothing.

---

## 5. Article Page Structure

Top to bottom on each article page:

### 5.1 Header bar (fixed, slim)
- Left: site wordmark — *We Are Choosing By Not Choosing* — Cormorant Garamond italic, links to `/`.
- Right: `PART N / 5` — IBM Plex Sans, all-caps, muted (`rgba(245,240,232,0.4)`).
- Height: 60 px. Background: `rgba(8,8,12,0.7)` with `backdrop-filter: blur(12px)`.
- 1 px hairline divider at the bottom in `rgba(255,255,255,0.04)`.

### 5.2 Title block
- Eyebrow: `PART N — A SHORT TAG` (IBM Plex Sans, 0.7 rem, letter-spacing 0.18em, all-caps, muted).
- Title (`h1.article__title`): Cormorant Garamond, 3.5 rem desktop / 2.25 rem mobile, weight 500, line-height 1.05.
- Dek (`p.article__dek`): Cormorant Garamond italic, 1.35 rem, max-width 580 px, color `rgba(245,240,232,0.7)`.
- Meta row: reading time (computed at build) + estimated reading time icon, IBM Plex Sans, 0.75 rem, muted.
- Centered, ~30vh top padding for breathing room. GSAP fade-up reveal on load (200ms title, 350ms dek, 500ms meta).

### 5.3 Prose column
- Container: `max-width: 680px`, centered.
- Body: IBM Plex Sans 300, 1.0625 rem, line-height 1.72, color `#e8e4dc`.
- `h2`: Cormorant Garamond, 2 rem, weight 500, top margin 4 rem, bottom margin 1 rem.
- `h3`: Cormorant Garamond, 1.5 rem, weight 500.
- `p`: bottom margin 1.5 rem.
- `blockquote`: 2 rem left margin, 1.25 rem font, Cormorant Garamond italic, left border 2 px solid `rgba(251,191,36,0.4)` (warm amber), `cite` block under it in IBM Plex Sans 0.8 rem muted.
- `aside.stat-callout`: stat-style block (used for "84% — RAND 2024"-style facts). Large number in Cormorant Garamond, source attribution underneath in IBM Plex Sans Mono-ish weight. Right-aligned, floats out of column.
- `sup.footnote-ref`: small superscript, links to the footnote list at the page end. Style consistent with academic prose.
- `code`: IBM Plex Mono if present (not expected to appear often).

### 5.4 Inline embed block
- Renders **once** per article, at the conceptual reference point in the prose (see §7).
- Breaks the 680 px column. Container `max-width: 960px`, centered, full-bleed up to that width.
- 16:9 aspect ratio (`aspect-ratio: 16 / 9`).
- Wrapper: `.embed-frame` — 1 px border `rgba(255,255,255,0.08)`, border-radius 12 px, overflow hidden, `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04), 0 24px 60px -20px rgba(0,0,0,0.6)`.
- Inside: `<iframe>` (see §6).
- Top-right: `.embed-fullscreen-btn` — 36×36 button with `⛶` glyph, IBM Plex Sans, `rgba(8,8,12,0.6)` background, `rgba(255,255,255,0.7)` foreground. Hover: full opacity, slight scale. `aria-label="Open visualization in full screen"`.
- Bottom-center: `.embed-hint` — *"drag · scroll · click"* IBM Plex Sans 0.7 rem, fades in once on first scroll into view, fades out after 4 s.
- Below the embed: small caption (`figcaption`-style) — viz title + one-line description.

### 5.5 Continued prose
- Column resumes below the embed, identical styling to §5.3.

### 5.6 Footnotes section (page foot, before nav)
- Compact list of source attributions referenced by `<sup>` markers in the body.
- IBM Plex Sans 0.85 rem, muted.

### 5.7 Prev/Next footer cards
- Two cards spanning the page, 50/50 split (stack on mobile).
- Card aesthetic reuses landing's bento card pattern (animated CSS `@property` background). Implementation: the relevant CSS rules are extracted from `index.html` into `shared/article.css` so the styles live in one place and both landing and articles use the same source. Landing continues to work; articles inherit the same look.
- Each card shows:
  - Eyebrow: `← PREVIOUS` or `NEXT →`
  - `PART N` in muted IBM Plex Sans
  - Title in Cormorant Garamond
  - One-line dek in IBM Plex Sans muted
- Whole card is the link target.
- At endpoints (Part 1 prev / Part 5 next): the orphan slot becomes "Back to the series" → links to `/#series`. Never empty.

### 5.8 Default aesthetic decisions
- Background: `#08080c` solid.
- **No god rays, no starfield** on article pages — those belong on the landing. Reading shell is quieter; the embed brings the visual energy.
- GSAP scroll reveal on title block only. Body prose is not animated on reveal.
- Mobile (≤768 px): prose column 92vw, embed 100vw, prev/next stacks vertically, title 2.25 rem.

---

## 6. Embed Contract (`?embed=1`)

### 6.1 How embed mode is signaled
Article markup:
```html
<figure class="article-embed">
  <div class="embed-frame">
    <iframe
      src="/visualizations/four-rungs/?embed=1"
      title="The Four Rungs — interactive"
      loading="lazy"
      class="article-embed__iframe"
    ></iframe>
    <button class="embed-fullscreen-btn" data-target="/visualizations/four-rungs/" data-from="before-you-automate" aria-label="Open in full screen">⛶</button>
    <div class="embed-hint">drag · scroll · click</div>
  </div>
  <figcaption class="article-embed__caption">The Four Rungs — drag to rotate, click any rung to focus.</figcaption>
</figure>
```

### 6.2 What each viz does when `?embed=1` is detected
A small inline script block added near the top of each viz's `index.html`:
```js
(function () {
  const params = new URLSearchParams(location.search);
  if (params.get('embed') === '1') {
    document.documentElement.classList.add('embed-mode');
    document.body.classList.add('embed-mode');
  }
})();
```

And a CSS block scoped to `.embed-mode` that hides chrome:
```css
.embed-mode .header,
.embed-mode #header,
.embed-mode .controls-hint,
.embed-mode .audio-toggle,
.embed-mode #audio-toggle,
.embed-mode .insight-overlay,
.embed-mode .legend { display: none !important; }
```

(Selector list will be adjusted per viz — each viz has slightly different ids/classes. Discovery in Wave 1; per-viz patch in Wave 2.)

**What stays visible in embed mode:**
- The 3D canvas.
- View-mode tabs at top center (these ARE the interaction; hiding them strips the value).
- Detail panels that open on click/focus interactions.

### 6.3 Fullscreen button behaviour
Article-side click handler (one shared snippet in `shared/article.css`'s sibling JS or inline per-article — small enough to inline):
```js
document.querySelectorAll('.embed-fullscreen-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    sessionStorage.setItem('scroll:' + location.pathname, String(window.scrollY));
    const target = btn.dataset.target + '?from=' + btn.dataset.from;
    location.href = target;
  });
});
```

### 6.4 Scroll restoration on back-navigation
At the top of each article:
```js
window.addEventListener('pageshow', () => {
  const y = sessionStorage.getItem('scroll:' + location.pathname);
  if (y) {
    window.scrollTo({ top: parseInt(y, 10), behavior: 'instant' });
    sessionStorage.removeItem('scroll:' + location.pathname);
  }
});
```
`pageshow` fires on back-button restoration even from bfcache, which is the correct hook (`load` does not).

### 6.5 Lazy initialization
- `iframe[loading="lazy"]` defers fetch until the embed nears the viewport.
- The standalone viz pages already start animation on `DOMContentLoaded`; that's fine inside the iframe since the iframe itself isn't loaded until needed.
- No additional `IntersectionObserver` required given native lazy-load.

### 6.6 The complementarity-view GLB caveat
The complementarity-view loads a 72 MB `Walking_person.glb` by default. Even with lazy-loading on the iframe, allowing this download for embedded mode would be unacceptable.

**Patch:** wrap the GLB fetch in a guard:
```js
if (!document.body.classList.contains('embed-mode')) {
  // existing GLB load path
} else {
  createFallbackHumanFigure();
}
```
The fallback procedural figure already exists in the codebase and is what's used when the GLB fails to load.

### 6.7 What `?embed=1` does NOT do
- Does not modify the camera position, lighting, or scene composition.
- Does not change the animation loop.
- Does not disable OrbitControls.
- Does not change any of the visualization's core interactive behaviors.

The standalone experience remains the canonical one. Embed mode is purely a chrome-stripping flag.

---

## 7. Embed insertion points

The conceptual moment in each article where the embed renders. Final paragraph break will be chosen during PDF extraction (Wave 1) and surfaced for review:

| Article | Cue |
|---|---|
| Part 1 — Friction Reduction | After the 2×2 (expertise × consequence) framework is first introduced. |
| Part 2 — Before You Automate | After the four rungs are first named. |
| Part 3 — What AI Can't See | After the "streetlight effect" metaphor is set up. |
| Part 4 — Designing Around the Gaps | After the four friction zones (Seamless / Visible / Gated / Human-Only) are named. |
| Part 5 — The Cost of Speed | After pace-layer strain is first explained. |

---

## 8. Landing-page changes

Single change: in `index.html` repoint each Part card's `href` and `data-href`:

| Card | Before | After |
|---|---|---|
| Part 1 | `visualizations/collaboration-framework/` | `articles/friction-reduction/` |
| Part 2 | `visualizations/four-rungs/` | `articles/before-you-automate/` |
| Part 3 | `visualizations/complementarity-view/` | `articles/what-ai-cant-see/` |
| Part 4 | `visualizations/friction-spectrum/` | `articles/designing-around-gaps/` |
| Part 5 | `visualizations/cost-of-speed/` | `articles/cost-of-speed/` |

Card visual design, hover state, and animated preview backgrounds are **untouched**.

---

## 9. Content extraction (PDFs → HTML)

### 9.1 Source files
`FinalPaper/Part 1 - Friction Reduction Principle Always Wins.pdf` (88 KB)
`FinalPaper/Part 2 - Before You Automate.pdf` (128 KB)
`FinalPaper/Part 3 - What AI Can't See.pdf` (244 KB)
`FinalPaper/Part 4 - Designing Around the Gaps.pdf` (90 KB)
`FinalPaper/Part 5 - The Cost of Speed.pdf` (154 KB)

### 9.2 Extraction tool
`Read` tool with `pages` parameter. All five PDFs fit within the 20-page-per-request limit.

### 9.3 Translation rules
- PDF title → `<h1 class="article__title">`
- Top-level section headings → `<h2>`
- Sub-section headings → `<h3>`
- Body paragraphs → `<p>`
- Block quotes / interview pull-quotes → `<blockquote><p>...</p><cite>...</cite></blockquote>`
- Stats with citations (e.g., "84% — RAND 2024") → `<aside class="stat-callout">`
- Footnotes / source citations → `<sup class="footnote-ref"><a href="#fn-N">N</a></sup>` linking to a footnotes section near the page foot.
- Inline emphasis → `<em>` / `<strong>` preserved per source.

### 9.4 Fidelity rules
- **Verbatim text.** No editorial rewriting.
- **Light cleanup permitted:** broken hyphenation, ligature artifacts, header/footer leakage from PDF chrome.
- Ambiguous extractions get flagged in the extraction draft for human review rather than guessed.

### 9.5 Per-article extraction artifact (Wave 1 output)
Each extraction subagent returns a structured handoff:
- Title, dek, reading time (word count / 250)
- Sectioned prose as Markdown
- Suggested embed insertion paragraph (cited inline)
- Footnote/citation list
- Any flagged ambiguities

These drafts live temporarily in `docs/superpowers/specs/extracted/part-N.md`. They are intermediate artifacts; the canonical content ships as the article HTML.

---

## 10. Implementation phasing

Three waves of work. Each wave's subagents run in parallel where possible.

### Wave 1 — Discovery (5 parallel subagents, ~5–10 min)
- Each subagent extracts one PDF → markdown draft per §9.5.
- All five run as `Explore` subagents (read-only) since extraction is pure analysis.

### Wave 2 — Foundations (sequential, ~20 min)
1. Build `shared/article.css` (the reading shell — implements all styling in §5).
2. Build the article template (the HTML structure each article instance fills in).
3. Patch each visualization's `index.html` to honor `?embed=1` per §6.2.
4. Patch complementarity-view to skip the 72 MB GLB in embed mode per §6.6.
5. Repoint landing `index.html` Part card hrefs per §8.

Sequential because each step depends on conventions established by the previous. Single subagent (or main thread) so the patches stay stylistically uniform.

### Wave 3 — Article assembly (5 parallel subagents, ~10–15 min)
- Each subagent writes one `articles/<slug>/index.html` from its Wave-1 draft + the Wave-2 template.
- Each gets: the shared template, the extracted markdown draft, the embed contract definition, the prev/next mapping from §4.

### Wave 4 — QA/QC (split across QA subagents + main-thread verification, ~15–20 min)
See §11 for full QA matrix.

---

## 11. QA/QC requirements

Two parallel QA tracks plus a manual verification pass. **No "done" claim until all three pass.**

### 11.1 Code-quality QA (one subagent, automated checks)
For every modified or created `.js` and every `index.html`:
- `node --check <file>.js` (no syntax errors)
- HTML validation: balanced tags, all `<iframe src>` resolve to real files, all `<a href>` resolve to real targets.
- All `?embed=1` standalone visualizations open successfully without console errors when navigated to directly.
- No `console.error` or uncaught rejections triggered by any article load.
- No new external dependencies, no new CDN URLs beyond those in §2's non-functional bar.
- No accidental `cd .` / cwd assumptions in any new code paths.

### 11.2 UI/design QA (one subagent — front-end design discipline)
For each article page and each embed:
- Typography: Cormorant Garamond on all `h1`/`h2`/`h3`/`blockquote`; IBM Plex Sans on body. No fallback fonts visibly rendering.
- Color tokens match the existing palette (verified against `shared/design-system.css`).
- Spacing: prose column is 680 px, embed expands to 960 px, prev/next cards span page width.
- Hover states present on every interactive surface (fullscreen button, prev/next cards, header wordmark).
- Mobile (≤768 px): no horizontal scroll, embed fills viewport width, prev/next stacks vertically, title shrinks per §5.8.
- Embed frame border-radius and shadow visually match a design-system token.
- Fullscreen icon is visually balanced — not too prominent, easy to find.
- Reading rhythm: scroll through each article end-to-end and confirm no awkward whitespace, broken flow, or visual jarring at the embed boundary.

### 11.3 Functional verification (main thread + Chrome plugin)
- Start `python3 -m http.server 8080`.
- For each of the 5 articles:
  - Navigate from landing card → confirm article loads.
  - Scroll until embed is in viewport → confirm iframe loads and 3D scene initializes.
  - Drag inside embed → confirm OrbitControls work without scrolling the article.
  - Click the fullscreen icon → confirm navigation to standalone, `?from=<slug>` present.
  - Press browser back → confirm article restores at the exact scroll position.
  - Reach the footer → click "next" → confirm correct neighbour loads.
  - At Part 1 / Part 5 endpoints → confirm "Back to the series" works.
- Confirm `index.html` (landing) still renders identically to its previous state — no visual regression.
- Confirm direct visits to `/visualizations/<name>/` (no `?embed=1`) still work exactly as before. The standalone experience must be preserved bit-for-bit.

### 11.4 Detail-orientation checklist
- Every `aria-label` present where needed (fullscreen button, prev/next cards if icon-only).
- Every `alt` and `title` attribute populated where applicable.
- `lang="en"` on every `<html>`.
- Favicon / OG tags carried over from landing.
- No `// TODO` or `// FIXME` left in shipped code.
- No leftover console logs.
- No new files left untracked that shouldn't be (the `extracted/part-N.md` drafts get committed under `docs/`).

---

## 12. Non-goals (explicitly NOT building)

- Client-side router or single-page app behavior.
- Sticky table of contents in the article gutter.
- Reading-progress bar at top of viewport.
- "Reading time remaining" live counter.
- Comments, share buttons, or social-meta beyond what landing already has.
- Dark/light mode toggle.
- Translations / i18n.
- Print stylesheet.
- Multiple embeds per article (one per article only; the article's *primary* viz).
- Re-architecting the existing standalone visualizations.
- Cleaning up the 72 MB `Walking_person.glb` from git history (out of scope; addressed only via the embed-mode skip in §6.6).

---

## 13. Risks and open questions

### 13.1 PDF extraction fidelity
**Risk:** PDFs sometimes embed layout/typography that doesn't translate to flowing HTML. Pull-quotes embedded as image regions, multi-column layouts, complex tables — these can extract as garbled text.

**Mitigation:** extraction subagents flag any ambiguity rather than guess. Wave-1 drafts are visible to user before Wave-3 assembly.

### 13.2 Article footnotes / citations
**Open question:** how are footnotes structured in the source PDFs? If they're true footnotes (numbered, source-linked), they become `<sup>` with a footnote list. If they're inline ("(Holstein, 2024)") they stay inline.

**Resolution:** discovered during Wave 1, handled per article in Wave 3.

### 13.3 Embed mode chrome-hiding completeness
**Risk:** each viz has slightly different chrome class names, so the `.embed-mode { display: none; }` selector list must be tailored per viz.

**Mitigation:** Wave 2 subagent reads each viz's `index.html` before adding the patch. QA §11.3 catches anything missed.

### 13.4 Scroll restoration edge cases
**Risk:** `pageshow` + `sessionStorage` is the right pattern, but some browsers (especially mobile Safari) can be flaky with bfcache restoration.

**Mitigation:** the pattern degrades gracefully — if scroll isn't restored, the user lands at the top of the article. Not catastrophic. Accept and move on if encountered.

### 13.5 collaboration-framework (Part 1) has no main.js
The Part 1 viz is HTML-only (CSS 2×2 grid). It does not need OrbitControls or a canvas. The embed contract still applies (`?embed=1` hides chrome), but there's no Three.js initialization to lazy-trigger.

**No mitigation needed** — this is fine; the embed flow is the same, just a lighter payload.

---

## 14. File-level change inventory

### New files
- `articles/friction-reduction/index.html`
- `articles/before-you-automate/index.html`
- `articles/what-ai-cant-see/index.html`
- `articles/designing-around-gaps/index.html`
- `articles/cost-of-speed/index.html`
- `shared/article.css`
- `docs/superpowers/specs/extracted/part-1.md` (intermediate Wave 1 artifact)
- `docs/superpowers/specs/extracted/part-2.md`
- `docs/superpowers/specs/extracted/part-3.md`
- `docs/superpowers/specs/extracted/part-4.md`
- `docs/superpowers/specs/extracted/part-5.md`

### Modified files
- `index.html` (landing — only Part card hrefs)
- `visualizations/collaboration-framework/index.html` (add `?embed=1` handling)
- `visualizations/four-rungs/index.html` (add `?embed=1` handling)
- `visualizations/complementarity-view/index.html` (add `?embed=1` handling)
- `visualizations/complementarity-view/main.js` (skip GLB in embed mode)
- `visualizations/friction-spectrum/index.html` (add `?embed=1` handling)
- `visualizations/cost-of-speed/index.html` (add `?embed=1` handling)

### Untouched
- All `main.js` files except complementarity-view's GLB guard.
- All `shared/` files except the new `article.css`.
- `embed/loader.js` (unrelated legacy embed mechanism for external sites).
- All viz folder assets, including `Walking_person.glb` and other GLBs.

---

## 15. Definition of done

1. All success criteria in §2 pass.
2. All three QA tracks in §11 pass.
3. Local server runs and the user can click through the entire flow.
4. Git working tree is clean except for the intentional changes inventoried in §14.
5. User has manually reviewed at least one article end-to-end and approved.
