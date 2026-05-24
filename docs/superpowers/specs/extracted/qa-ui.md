# UI/Design QA Report

**Reviewer:** UI QA subagent
**Date:** 2026-05-23
**Scope:** 5 new article pages, landing regression, 5 standalone viz regressions, 5 `?embed=1` confirmations.
**Method:** Live inspection at `http://localhost:8080` via Chrome MCP. Computed styles + DOM measurements at desktop (1440x900) and mobile (390/500x844). Tooling note: the resize to 390x844 was reported by the OS as ~500px innerWidth (likely DPI/min-window constraint on this Chrome instance), but media queries at the @768px breakpoint still resolved correctly, so mobile checks are valid.

## Summary
**PASS_WITH_CONCERNS** — Core mechanics work everywhere (no console errors, embeds load, iframes hide chrome correctly, mobile reflows, prev/next navigation intact, regressions are clean). But one layout bug undermines the embed's intent across all 5 articles, and three editorial issues in Part 1 specifically (echoed in every other article's PREVIOUS card) degrade craft below the "awe-inspiring" project bar.

## Strengths
- Typography contract holds in every article: title in `Cormorant Garamond` (56px desktop, 36px mobile), body in `IBM Plex Sans` (16-17px / 1.7 line-height). Verified via `getComputedStyle().fontFamily` on each page.
- Background `rgb(8, 8, 12)` (i.e. `#08080c`) used throughout — no aesthetic drift.
- Iframe lazy-loading + scroll-restoration script + fullscreen button + intersection-observed hint all wire up correctly. The `data-target`/`data-from` round-trip back to standalone is in place on all 5 articles.
- Zero console errors on any article or standalone viz. Standalone vizzes initialize Three.js scenes cleanly (verified complementarity-view: "Initialization complete!").
- Embed mode (`?embed=1`) hides header/legend/controls-hint/audio/quote on all 5 vizzes via the inline HTML script. View-controls remain visible on four-rungs and complementarity-view (the two vizzes that have them).
- All landing-page `data-href` values resolve to `articles/<slug>/`. The bento part cards link to articles correctly; god-rays + starfield (2 canvases) still render.
- Mobile (≤768px): all 5 articles have zero horizontal overflow, title shrinks to 36px (2.25rem) per the media query, prev/next nav cards stack vertically, wordmark remains visible at ~15px.
- Caption styling consistent: italic, muted `rgba(245, 240, 232, 0.55)`.
- Fullscreen button: 36x36, positioned top: 12px right: 12px, has hover scale(1.05) + color/background transition, has accessible `aria-label`.
- Nav-card hover: `transform: translateY(-2px)`, background brightens, border lightens, with smooth `0.3s` transitions.

## Issues (Critical) — must fix before declaring done

**C1. Article embed never reaches its 960px design width — renders at 632px on every page.**
- CSS declares `--embed-width: 960px` and `.article-embed { max-width: var(--embed-width); left: 50%; transform: translateX(-50%); }`.
- But `.article-embed` is a child of `.article__prose` (max-width 680px). The `transform: translateX(-50%)` only centers within the 680px parent — it cannot escape it. Measured `embedWidth = 632px` on all 5 articles (same as the prose column minus padding).
- Visual consequence: the embed reads as just-another-prose-element rather than an immersive interlude. Loses the intended "wider than the column, immersive" beat that justifies a 16:9 frame.
- Fix: move `<figure class="article-embed">` out of `.article__prose` and make it a sibling under `.article`, OR restructure so the embed escapes via `width: 100vw; margin-left: calc(50% - 50vw)` (full-bleed pattern) capped at `--embed-width`. The simplest fix is sibling restructuring in each article HTML (and updating the `.article-embed` CSS to drop the leftward translate trick).

## Issues (Important) — should fix

**I1. Part 1 H1 is the PDF series title, not a clean article title. (Specific concern A — strongly recommend fix.)**
- Part 1 H1: `"We Are Choosing By Not Choosing: The Default Path of AI Automation"` — 3 lines at 56px serif (176px tall), and worse: it duplicates the wordmark verbatim in the top-left of every page. The reader sees the exact phrase "We Are Choosing By Not Choosing" twice in the visual hierarchy.
- Part 1 dek: `"Part 1 of 5: The Friction Reduction Principle Always Wins"` — PDF-extraction wording; redundant with the eyebrow which also says "PART 1".
- Parts 2-5 follow the cleaner pattern (short topical H1, single-sentence editorial dek). Part 1 is the outlier and feels like raw PDF text.
- Knock-on: Part 2's `← PREVIOUS` nav card displays this exact long awkward title and dek. So the awkwardness is publicly visible on every other article too.
- **Recommendation:** Replace H1 with the landing-card title `"The Friction Reduction Principle Always Wins"`. Replace dek with the landing description `"People reach for whatever removes the obstacle in front of them. This creates genuine value, and a default path that leads somewhere whether we are paying attention or not."` Also update `<title>` and `<meta name=description>` to match.

**I2. Orphan footnotes in Part 1 and Part 5. (Specific concern B — recommend fix.)**
- Part 1: 3 footnote items (Inman & Ribes "Beautiful Seams" 2019, Weiser 1994, Weiser 1995) with ZERO `[^N]` superscript markers in the body. The "Notes" heading appears like dead weight at the foot of the article. The Weiser/beautiful-seams paragraph (line 99 of the HTML, "Liz Danzico... Weiser advocated for systems with 'beautiful seams' rather than seamless experiences.") is exactly where these references should anchor.
- Part 5 (cost-of-speed): 2 footnote items (Brand 1999 "Clock of the Long Now"; Cunningham 1992 "WyCash"/technical-debt) with ZERO body refs. Same orphan pattern.
- Parts 2, 3, 4 are correctly anchored (Part 3 in particular is the gold standard: 10 refs, 10 items, all resolve).
- **Recommendation:** Add inline `<sup class="footnote-ref"><a href="#fn-N">N</a></sup>` markers in Part 1 (one paragraph naturally hosts all three: the Weiser/Danzico paragraph) and in Part 5 (one paragraph each for Brand pace layers and Cunningham cultural-debt-as-technical-debt). Removing the orphan sections is a lesser alternative but loses the academic grounding the series otherwise has.

**I3. Part 1 caption is incorrect / misleading.**
- Caption reads: `"A preview of the framework explored in Part 4 — Expertise × Consequence quadrants."` But Part 4 (`designing-around-gaps`) features the Friction Spectrum / membrane-permeability viz, NOT the Expertise × Consequence quadrants. The Expertise × Consequence framework IS `collaboration-framework` (the viz being embedded), which is referenced in Part 1's body as "Brandenburg's augmentation framework" / "productive human-AI collaboration requires intentional calibration".
- **Recommendation:** Update caption to point readers correctly. E.g. `"The Human-AI Collaboration Framework — Expertise × Consequence. The full quadrant is explored in Part 4."` only if Part 4 actually returns to this viz. If not (and it doesn't), drop the cross-reference and just label the framework.

**I4. `<title>` of `collaboration-framework/index.html` says "Before You Automate" but it's embedded in Part 1 (friction-reduction).**
- Likely a copy-paste artifact from when this viz was assigned to a different article. Only visible when opening the standalone viz directly from the embed `⛶` button, but it does appear in the browser tab title.
- **Recommendation:** Change to `"Human-AI Collaboration Framework | The Friction Reduction Principle"` (or just drop the article-name suffix).

## Issues (Minor) — polish

**M1. Empty `<span class="article-nav__part"></span>` in every "Back to series" nav card creates a phantom 0.5rem flex gap.**
- The card uses `display: flex; gap: 0.5rem;` and the empty span is still a flex item, so the gap above and below it (~16px total of empty space) shows up between the eyebrow and "All five parts" title. Subtle, but the back-to-series card therefore has slightly more vertical air than the next/prev cards. Fix: omit the empty `<span>` from the back-to-series template, or set `:empty { display: none }`.

**M2. Eyebrow for Parts 2-5 repeats the H1 verbatim.**
- `PART 2 — BEFORE YOU AUTOMATE` / H1 `Before You Automate`, etc. Eyebrows typically carry a section/theme label, not a duplicate of the title. The redundancy is gentle (eyebrow is 0.7rem letter-spaced caps), but it's noise. A cleaner pattern: `PART 2 — THE PROBLEM LADDER`, `PART 3 — UNOBSERVABLES`, `PART 4 — BEAUTIFUL SEAMS`, `PART 5 — PACE LAYERS`. Optional editorial polish.

**M3. Inert/dead `isEmbed` code in four-rungs and complementarity-view main.js checks `embed === 'true'` (string) but articles use `embed=1`.**
- `urlParams.get('embed') === 'true'` will never match `?embed=1`. The chrome-hiding still works (it's done via the separate inline HTML script that correctly checks `=== '1'`), so this is dead code rather than a bug. In complementarity-view, the side effect is that `createEmbedControls()` (floating ⟲ ⛶ buttons inside the iframe) never fires — but the article already provides its own `⛶` button on the embed wrapper, so the user experience is fine. Worth cleaning up for consistency: either delete the `isEmbed` block in main.js, or change the comparison to `=== '1'` to match the rest of the codebase.

**M4. Article deks vs landing descriptions (Specific concern C).**
- Side-by-side comparison:
  - Part 1: dek `"Part 1 of 5: The Friction Reduction Principle Always Wins"` vs landing `"People reach for whatever removes the obstacle in front of them. This creates genuine value, and a default path that leads somewhere whether we are paying attention or not."` — **Replace dek with landing description** (see I1; this is part of the same Part 1 cleanup).
  - Part 2: dek `"Organizations stand at the bottom of a ladder and ask 'What can AI do?' The useful question sits at the top: 'What problem deserves solving?'"` vs landing `"84% of AI projects fail because organizations optimize at the wrong level. The Four Rungs framework shows why most teams start at Method when they should start at Outcome."` — **Both work; current dek is more poetic, landing is more punchy/quantitative. Either is fine; current is better as a dek IMO. Keep.**
  - Part 3: dek `"Stop asking what AI cannot do. Start asking what AI cannot see."` vs landing `"Stop asking what AI cannot do. Start asking what AI cannot see. The Streetlight Effect reveals the structural limits..."` — **Current dek is the landing description's punch line. Crisp and great as-is. Keep.**
  - Part 4: dek `"What do you actually do with the knowledge that friction reduction always wins, problem definition precedes solution, and AI operates under structural limits?"` vs landing `"The solution is not friction everywhere. It is calibrated friction: seams matched to stakes. Mark Weiser's 'beautiful seams' show how to reveal the junction between human and machine precisely where evaluation matters."` — **Current dek is a synthesis question; landing description is a thesis. The landing description is sharper and more useful. Recommend swapping to landing description.**
  - Part 5: dek `"What happens to organizations that move faster than they can absorb?"` vs landing `"AI operates at the speed of the fastest layers. Meaning, identity, and purpose move at the pace of the slowest. Stewart Brand's pace layers reveal what happens when organizations move faster than they can absorb."` — **Current dek is a one-line hook; landing is a fuller thesis. Both work; current is slightly more inviting. Keep.**
- **Net recommendation:** swap Part 1 and Part 4 deks to landing descriptions; keep Parts 2/3/5 deks as-is.

## Per-article findings

- **friction-reduction (Part 1):** Embed = `collaboration-framework`. Renders correctly, but suffers from all three specific concerns (H1 duplicates wordmark; orphan footnotes; misleading "Part 4" caption). Most-edited article in this QA. After fixing, will match peer quality.
- **before-you-automate (Part 2):** Embed = `four-rungs`. Renders cleanly. Footnote refs (6) correctly point to 3 items (`#fn-1`, `#fn-2`, `#fn-3` — re-used). All anchors resolve. Title/dek/eyebrow OK (modulo M2).
- **what-ai-cant-see (Part 3):** Embed = `complementarity-view`. 10 refs, 10 items, all resolve. This is the gold-standard article. Title/dek/eyebrow OK.
- **designing-around-gaps (Part 4):** Embed = `friction-spectrum`. 3 refs, 3 items, all resolve. Dek is a long synthesis question; would be sharper with the landing description (see M4).
- **cost-of-speed (Part 5):** Embed = `cost-of-speed` viz. 2 orphan footnotes (no body refs; see I2).

## Regression check (landing + standalone vizzes)
**PASS.**
- Landing (`/`): hero "We Are Choosing By Not Choosing" present, 5 part cards, all `data-href` start with `articles/`, 2 canvas elements (god rays + starfield), no horizontal scroll.
- four-rungs/ standalone: header, legend, controls-hint, view-controls all visible. 1 canvas.
- complementarity-view/ standalone: header, legend, controls-hint, view-controls, audio button all visible. 1 canvas. Console clean ("Initialization complete!").
- friction-spectrum/ standalone: ID-based selectors (#header, #quote, #view-controls, zone-labels) all visible. 1 canvas. (Brief expected class-based selectors but this viz uses IDs throughout — different convention, not a bug.)
- cost-of-speed/ standalone: header, legend, debtIndicator, controlsHint, detailPanel all visible. 1 canvas. Layer-labels render.
- collaboration-framework/ standalone: no canvas expected (HTML grid layout), `.framework` main present, detail-overlay present.

Embed-mode (`?embed=1`) confirmation:
- four-rungs: `html.embed-mode` set, header/legend/controls-hint hidden, view-controls visible. PASS.
- complementarity-view: header/legend/controls-hint/audio/quote hidden, view-controls visible. PASS.
- friction-spectrum: header/legend/controls-hint/quote hidden, view-controls visible. PASS.
- cost-of-speed: header/legend/controls-hint/debtIndicator hidden. PASS (no view-controls in this viz).
- collaboration-framework: `html.embed-mode` set, framework grid still renders. PASS (no chrome to hide).

## Specific concerns from build

- **Part 1 H1 title:** **FIX.** The current H1 duplicates the wordmark verbatim and is unwieldy (3 lines at 56px). Replace with the landing-card title `"The Friction Reduction Principle Always Wins"`. This single change also fixes the awkward Part 2 PREVIOUS-card display.
- **Part 1 orphan footnotes:** **FIX.** Add inline `<sup class="footnote-ref"><a href="#fn-N">N</a></sup>` markers in the Weiser/Danzico/Beautiful-Seams paragraph (line 99 of the current HTML). Also apply the same fix to Part 5 (Brand + Cunningham references). Removing the Notes sections is a lesser alternative; anchoring preserves the academic credibility of the series.
- **Article deks vs landing descriptions:** Mixed recommendation per part. **Swap Part 1 dek to landing description** (as part of the H1 fix above). **Swap Part 4 dek to landing description** (it's sharper). **Keep Parts 2, 3, 5 as-is** (current deks already function well).

## Recommendation
Block "done" on:
1. C1 (embed never reaches 960px) — biggest visual/conceptual loss; the whole point of an immersive interlude.
2. I1 (Part 1 H1/dek) + I2 (Part 1 + Part 5 orphan footnotes) + I3 (Part 1 misleading caption) — these are the difference between "polished article" and "publishable on the project's quality bar."

After those, M1/M2/M3/M4 are polish-pass items: do them in a single follow-up commit before any external share.

Once C1 and the Part 1 issues are addressed, this set ships at the "awe-inspiring" bar the project demands.
