# Code-Quality QA Report

**Reviewer:** code-quality QA subagent
**Date:** 2026-05-23
**Base SHA:** 64e2b46
**HEAD:** 9dd10e6 (at start of review)

## Summary

**PASS_WITH_CONCERNS** — The implementation is functionally sound, all 11 HTML files are well-formed, all 4 viz `main.js` files pass `node --check`, every link resolves, all `?embed=1` URLs serve HTTP 200 with proper embed-mode class injection, and standalone vizzes remain unregressed. The concerns are content-fidelity issues (orphaned footnotes in Part 1 and Part 5) and two documented spec deviations (Part 1 title source and Part 1 embed insertion point).

## Strengths

- **Selector hygiene in viz patches.** Every `.embed-mode` rule uses both the class selector AND the id selector (e.g. `.embed-mode .header, .embed-mode #header`), so the chrome-hide works regardless of which kind of selector each viz uses internally. This is defensive in exactly the right way.
- **Embed-mode flag script uses correct guards.** Adds `embed-mode` to `documentElement` immediately (works at top-of-head before body exists) and defers the body-side class to `DOMContentLoaded`. No race conditions.
- **Consistent CDN versions.** Three.js is `r128`/`0.128.0` across both jsdelivr and cdnjs forms (these resolve to the same release). GSAP is consistently `3.12.2`. No version drift.
- **All articles include `lang="en"`, meta description, and proper `<title>`.** Accessibility baseline met.
- **Article script handles `pageshow` (not `load`) for scroll restore.** This is the correct hook for bfcache restoration on mobile Safari — matches the spec rationale at §6.4.
- **`IntersectionObserver` hint-fade with `disconnect()` after first trigger.** Avoids re-firing on subsequent scrolls. Clean.
- **`shared/article.css` honors `prefers-reduced-motion`.** Disables `scroll-behavior`, card transforms, and button transitions. Above the spec's explicit requirements.
- **`focus-visible` ring on the fullscreen button.** Keyboard accessibility for the embed control.
- **Landing diff is minimal and exactly per spec §8** — 5 `data-href` + 5 `href` + 5 aria-label updates, nothing else touched.
- **All article internal links resolve.** Every prev/next href points to a real file, every iframe `src` points to a real viz folder, every fullscreen button `data-target` points to a real viz folder.
- **Collaboration-framework correctly has no embed-mode CSS** — per spec §13.5, the Part 1 viz is HTML-only with no chrome to hide. Only the flag script is needed; the absence of CSS rules here is correct, not an omission.

## Issues (Critical)

None. The implementation is correct and shippable.

## Issues (Important)

### I1. Orphaned footnotes in Part 1 (friction-reduction) and Part 5 (cost-of-speed)

`articles/friction-reduction/index.html` defines `<li id="fn-1">`, `fn-2`, `fn-3` (Inman & Ribes 2019, Weiser 1994, Weiser 1995) but the prose contains **zero `<sup class="footnote-ref">`** markers. Same problem in `articles/cost-of-speed/index.html`: 2 footnote items defined (Brand 1999, Cunningham 1992) but no inline references.

The reader cannot reach these citations from the prose. Either:
- **Option A** — Add inline `<sup>` markers in the prose where the authors are first cited.
- **Option B** — Remove the orphan footnote sections (citations are already attributed inline in the prose, e.g. "(Brand, 1999)").

The remaining three articles handle this correctly:
- Part 2: 3 refs → 3 footnotes (matched)
- Part 3: 10 refs → 10 footnotes (matched)
- Part 4: 3 refs → 3 footnotes (matched)

This is an Important issue because the spec §9.3 explicitly defines the `<sup class="footnote-ref">` ↔ `id="fn-N"` linkage as the canonical pattern. Half the articles follow it and half don't.

### I2. Spec deviation — `shared/article.css` does not extract the landing's `@property` bento card animation

Spec §5.7 states: *"Card aesthetic reuses landing's bento card pattern (animated CSS `@property` background). Implementation: the relevant CSS rules are extracted from `index.html` into `shared/article.css` so the styles live in one place and both landing and articles use the same source."*

Implementation does NOT do this. `shared/article.css` uses a simpler static radial-gradient triggered on `:hover` via custom properties `--mx`/`--my` that are never set by JS. The landing retains its rich `@property --blob1-x` / `--blob1-y` / etc. animations.

The article-nav cards still look polished (translateY + bg shift on hover), but they do not match the landing's visual richness, and the spec's "single source of truth" goal is not realized. This is a spec deviation, not a broken implementation — but it should be acknowledged either as: (a) update the implementation to match spec, or (b) update the spec to reflect the simpler approach taken.

## Issues (Minor)

### M1. Part 1 title differs from spec table §4

Spec §4 names Part 1 as "The Friction Reduction Principle Always Wins". The implementation uses the actual PDF title "We Are Choosing By Not Choosing: The Default Path of AI Automation" (with the spec-table label demoted to the dek). This is reasonable — the Wave 1 extraction draft flagged this and the implementation followed the source paper. But the spec table did not get updated to reflect the canonical title in the source PDF, so the discrepancy reads as a deviation. Recommend either: (a) update spec table to match PDF, or (b) document that the spec column was a short label, not the canonical h1.

### M2. Part 1 embed insertion point differs from spec §7 cue

Spec §7 says: *"Part 1 — Friction Reduction | After the 2×2 (expertise × consequence) framework is first introduced."* The Part 1 article never actually introduces the 2×2 expertise × consequence framework — that framework belongs to Part 4. The implementation places the embed after the paragraph "Part 4 addresses how to design around capability gaps" and labels the figcaption "A preview of the framework explored in Part 4." This was a judgment call by the Wave 1 extractor and is documented in `docs/superpowers/specs/extracted/part-1.md`. Reasonable, but the spec cue is technically wrong for the actual source content.

### M3. Empty `<span class="article-nav__part"></span>` at endpoint cards

Both Part 1 prev and Part 5 next use an empty `<span>` for the part-number slot (since "Back to the series" has no part number). The markup is syntactically valid but visually leaves a blank span in the layout. Cosmetic only; no impact on rendering since the span has no fixed height and the surrounding flexbox column collapses.

### M4. Landing diff didn't update one aria-label phrase casing consistently

The article action aria-labels changed from "Explore Part N" to "Read Part N" (correct for the new flow). Trivial. Just noting that this is a thoughtful detail that was caught.

## Check-by-check findings

- **Check 1 (change inventory):** PASS. 17 files changed: 5 articles + shared/article.css + 5 viz `index.html` patches + landing + 5 extracted markdown drafts. The spec/plan docs are not in the diff because they were the base commit. `visualizations/complementarity-view/main.js` is NOT modified despite spec §14 listing it — but spec §6.6 acknowledges the GLB code path is inert (`createFallbackHumanFigure()` runs unconditionally), so no patch was actually needed. The plan correctly omits this file.

- **Check 2 (JS syntax):** PASS. All 4 viz `main.js` files pass `node --check`. (`collaboration-framework` has no `main.js`.)

- **Check 3 (HTML well-formedness):** PASS. All 11 HTML files (5 articles + 5 vizzes + landing) parse cleanly through `html.parser.HTMLParser`.

- **Check 4 (internal links resolve):** PASS for hard links. All viz folders referenced by iframe `src`, fullscreen `data-target`, and article prev/next `href` exist on disk. `/shared/article.css` resolves. Fragment anchors (`#fn-N`) mostly resolve, with the exception called out in **I1**.

- **Check 5 (no leftover placeholders):** PASS. Zero TODO/FIXME/XXX/`{{...}}` matches.

- **Check 6 (CDN versions pinned):** PASS. Three.js consistently `r128` (cdnjs) / `0.128.0` (jsdelivr) — these are the same release. GSAP consistently `3.12.2`.

- **Check 7 (embed URLs serve + embed-mode class):** PASS. All 5 vizzes return HTTP 200 with `?embed=1`. Embed-mode reference counts: collaboration-framework=2 (script-only, no CSS rules needed per spec §13.5), four-rungs=8, complementarity-view=13, friction-spectrum=8, cost-of-speed=12.

- **Check 8 (standalone vizzes still serve 200):** PASS. All 5 vizzes return HTTP 200 without `?embed=1`.

- **Check 9 (article structure):** PASS. All 5 articles contain exactly 1 iframe, 2 fullscreen-btn references (button element + JS handler binding), 1 prev card, 1 next card.

- **Check 10 (git tree clean):** PASS. Only `.DS_Store` and `.claude/settings.local.json` show modified — both pre-existing drift unrelated to this work.

- **Check 11 (spec compliance — article files):** PASS_WITH_CONCERNS. Read Part 3 (`what-ai-cant-see`) and Part 1 (`friction-reduction`) in full. Part 3 is a model implementation — header, title block, prose, embed (correctly placed after streetlight metaphor setup), 10 footnotes properly linked, prev/next, script block all present. Part 1 has the issues noted in I1, M1, M2. Spot-checked Part 2, Part 4, Part 5 — Part 2 and Part 4 are correct; Part 5 has the I1 orphan-footnote issue.

- **Check 12 (spec compliance — viz patches):** PASS. Read complementarity-view and cost-of-speed in full. Both have the embed-flag script before `</head>`, the embed-mode CSS rules scoped to `.embed-mode`, and every selector matches a real element with the same class/id in the body. Spot-checked four-rungs and friction-spectrum — both correct. Collaboration-framework correctly omits CSS rules (no chrome).

## Recommendation

**Ship as-is, but fix the orphan footnotes (I1) before user-facing publication.**

The orphaned footnotes in Part 1 and Part 5 are the most user-visible problem: a reader who scrolls to the Notes section will see citations that are unreachable from the prose. Even the inline-citation alternative ("(Brand, 1999)") is fine, but then the duplicated footnote section feels redundant. Recommend reconciling each article to one convention.

The spec deviations (I2, M1, M2) are documented and defensible. Either update the spec to match the implementation or update the implementation to match the spec — but neither blocks ship. The minor cosmetic items (M3, M4) are noise.

Functional behavior (scroll restore, fullscreen handoff, embed iframe lazy-load, view-mode buttons survive embed mode, no regression to standalone vizzes) all check out.
