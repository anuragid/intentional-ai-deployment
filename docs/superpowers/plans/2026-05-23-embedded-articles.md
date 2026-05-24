# Embedded Articles with Inline Visualizations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 5-part article series readable on the site as native HTML pages, each with its corresponding visualization embedded inline; a fullscreen icon on every embed navigates to the existing standalone viz page; prev/next nav at the foot of each article connects the series. Landing-page cards now open the article, not the bare standalone viz.

**Architecture:** Static file-per-route. Five new files at `articles/<slug>/index.html`, one shared stylesheet at `shared/article.css`, the visualizations gain a `?embed=1` query-flag handler that hides chrome, and the landing's part-card hrefs repoint at the new article pages. No build step, no client-side router, no framework.

**Tech Stack:** Plain HTML5 + CSS3, vanilla JavaScript (no bundler). Existing CDN deps unchanged: Three.js r128, OrbitControls r128, GSAP 3.12.2. Local server: `python3 -m http.server 8080`. PDF extraction via Claude's `Read` tool with `pages` parameter.

**Source spec:** `docs/superpowers/specs/2026-05-23-embedded-articles-design.md`

---

## File Structure

### New files
```
articles/
├── friction-reduction/index.html        # Part 1 → viz: collaboration-framework
├── before-you-automate/index.html       # Part 2 → viz: four-rungs
├── what-ai-cant-see/index.html          # Part 3 → viz: complementarity-view
├── designing-around-gaps/index.html     # Part 4 → viz: friction-spectrum
└── cost-of-speed/index.html             # Part 5 → viz: cost-of-speed

shared/article.css                       # Reading shell + embed + nav styling

docs/superpowers/specs/extracted/
├── part-1.md                            # Wave 1 PDF extraction artifact
├── part-2.md
├── part-3.md
├── part-4.md
└── part-5.md
```

### Modified files
```
index.html                                                       # Landing: 5 href repoints only
visualizations/collaboration-framework/index.html                # Add ?embed=1 chrome hide
visualizations/four-rungs/index.html                             # Add ?embed=1 chrome hide
visualizations/complementarity-view/index.html                   # Add ?embed=1 chrome hide
visualizations/friction-spectrum/index.html                      # Add ?embed=1 chrome hide
visualizations/cost-of-speed/index.html                          # Add ?embed=1 chrome hide
```

### Series mapping (single source of truth for prev/next wiring)

| # | Slug | Title | Viz folder | Dek (placeholder until Wave 1) |
|---|---|---|---|---|
| 1 | `friction-reduction` | The Friction Reduction Principle Always Wins | `collaboration-framework` | *from Wave 1* |
| 2 | `before-you-automate` | Before You Automate | `four-rungs` | *from Wave 1* |
| 3 | `what-ai-cant-see` | What AI Can't See | `complementarity-view` | *from Wave 1* |
| 4 | `designing-around-gaps` | Designing Around the Gaps | `friction-spectrum` | *from Wave 1* |
| 5 | `cost-of-speed` | The Cost of Speed | `cost-of-speed` | *from Wave 1* |

---

## Reference A — Canonical Article HTML Template

Every article page in Wave 3 is generated from this template. Slots are in `{{double-braces}}`. The template inlines all per-article JS (~25 lines) because it's small and avoids creating a sibling JS file per article.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}} | We Are Choosing By Not Choosing</title>
  <meta name="description" content="{{dek}}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=IBM+Plex+Sans:wght@300;400;500&display=swap" rel="stylesheet">

  <link rel="stylesheet" href="/shared/article.css">
</head>
<body class="article-page" data-slug="{{slug}}">

  <header class="article-header">
    <a href="/" class="article-header__wordmark">We Are Choosing By Not Choosing</a>
    <span class="article-header__meta">PART {{n}} / 5</span>
  </header>

  <main class="article">
    <section class="article__title-block">
      <p class="article__eyebrow">PART {{n}} — {{eyebrow-tag}}</p>
      <h1 class="article__title">{{title}}</h1>
      <p class="article__dek">{{dek}}</p>
      <p class="article__meta"><span>{{reading-time}} min read</span></p>
    </section>

    <div class="article__prose">
      {{prose-before-embed}}

      <figure class="article-embed" id="embed">
        <div class="embed-frame">
          <iframe
            src="/visualizations/{{viz-folder}}/?embed=1"
            title="{{viz-title}} — interactive visualization"
            loading="lazy"
            class="article-embed__iframe"
          ></iframe>
          <button
            class="embed-fullscreen-btn"
            data-target="/visualizations/{{viz-folder}}/"
            data-from="{{slug}}"
            aria-label="Open visualization in full screen"
          >⛶</button>
          <div class="embed-hint" aria-hidden="true">drag · scroll · click</div>
        </div>
        <figcaption class="article-embed__caption">{{viz-caption}}</figcaption>
      </figure>

      {{prose-after-embed}}
    </div>

    {{footnotes-block-optional}}

    <nav class="article-nav" aria-label="Series navigation">
      <a href="{{prev-href}}" class="article-nav__card article-nav__card--prev">
        <span class="article-nav__eyebrow">← {{prev-eyebrow}}</span>
        <span class="article-nav__part">{{prev-part}}</span>
        <span class="article-nav__title">{{prev-title}}</span>
        <span class="article-nav__dek">{{prev-dek}}</span>
      </a>
      <a href="{{next-href}}" class="article-nav__card article-nav__card--next">
        <span class="article-nav__eyebrow">{{next-eyebrow}} →</span>
        <span class="article-nav__part">{{next-part}}</span>
        <span class="article-nav__title">{{next-title}}</span>
        <span class="article-nav__dek">{{next-dek}}</span>
      </a>
    </nav>
  </main>

  <script>
    // Restore scroll on back-navigation (from standalone viz pages)
    window.addEventListener('pageshow', () => {
      const key = 'scroll:' + location.pathname;
      const y = sessionStorage.getItem(key);
      if (y !== null) {
        window.scrollTo({ top: parseInt(y, 10), behavior: 'instant' });
        sessionStorage.removeItem(key);
      }
    });

    // Fullscreen button: save scroll, navigate to standalone with ?from=
    document.querySelectorAll('.embed-fullscreen-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sessionStorage.setItem('scroll:' + location.pathname, String(window.scrollY));
        location.href = btn.dataset.target + '?from=' + encodeURIComponent(btn.dataset.from);
      });
    });

    // First-scroll-into-view hint fade for the embed
    const embedFigure = document.querySelector('.article-embed');
    if (embedFigure) {
      const hint = embedFigure.querySelector('.embed-hint');
      if (hint) {
        const io = new IntersectionObserver((entries) => {
          entries.forEach(e => {
            if (e.isIntersecting) {
              hint.classList.add('embed-hint--visible');
              setTimeout(() => hint.classList.remove('embed-hint--visible'), 4000);
              io.disconnect();
            }
          });
        }, { threshold: 0.5 });
        io.observe(embedFigure);
      }
    }
  </script>
</body>
</html>
```

### Endpoint nav rules
- Part 1: `prev-href = "/#series"`, `prev-eyebrow = "BACK TO THE SERIES"`, `prev-part = ""`, `prev-title = "All five parts"`, `prev-dek = "Return to the series overview."`. Next slot uses Part 2 details.
- Part 5: `next-href = "/#series"`, `next-eyebrow = "BACK TO THE SERIES"`, `next-part = ""`, `next-title = "All five parts"`, `next-dek = "Return to the series overview."`. Prev slot uses Part 4 details.
- Parts 2/3/4: both slots use neighbour Part details.

### Slot values per article (filled during Wave 3, with content from Wave 1)

| Slot | Friction Reduction (1) | Before You Automate (2) | What AI Can't See (3) | Designing Around the Gaps (4) | Cost of Speed (5) |
|---|---|---|---|---|---|
| `n` | 1 | 2 | 3 | 4 | 5 |
| `slug` | friction-reduction | before-you-automate | what-ai-cant-see | designing-around-gaps | cost-of-speed |
| `viz-folder` | collaboration-framework | four-rungs | complementarity-view | friction-spectrum | cost-of-speed |
| `eyebrow-tag` | THE FRICTION PRINCIPLE | BEFORE YOU AUTOMATE | WHAT AI CAN'T SEE | DESIGNING AROUND THE GAPS | THE COST OF SPEED |
| `viz-title` | Human-AI Collaboration Framework | The Four Rungs | The Complementarity View | The Friction Spectrum | The Cost of Speed |
| `viz-caption` | The Expertise × Consequence framework — click any quadrant to focus. | The Problem Abstraction Ladder — drag to rotate, click any rung to focus. | The streetlight effect — drag to rotate, click any orb to focus. | Calibrated permeability — drag through the four zones, click to focus. | Stewart Brand's pace layers — drag to rotate, hover any layer. |

Wave 1 fills the rest: `title`, `dek`, `reading-time`, `prose-before-embed`, `prose-after-embed`, optional `footnotes-block-optional`, and neighbour `prev/next-title/dek`.

---

## Reference B — Standard chrome-hiding markup for visualizations

Every visualization's `index.html` gets the same two additions:

### B.1 — Script (placed in `<head>`, before any other script tag)
```html
<script>
  (function () {
    var params = new URLSearchParams(location.search);
    if (params.get('embed') === '1') {
      document.documentElement.classList.add('embed-mode');
      document.addEventListener('DOMContentLoaded', function () {
        document.body.classList.add('embed-mode');
      });
    }
  })();
</script>
```

### B.2 — CSS (added to the existing `<style>` block in the viz's `index.html`)
Per-viz selectors documented in each task (Tasks 7–11). Pattern is always:
```css
.embed-mode {selector-list} { display: none !important; }
```

Standard selectors that are valid in ALL vizzes:
```css
.embed-mode .controls-hint,
.embed-mode #controls-hint,
.embed-mode #controlsHint { display: none !important; }
```

---

## Reference C — Embed-related CSS for `shared/article.css`

Documented in full in Task 6.

---

# WAVE 1 — PDF Extraction (5 parallel tasks)

All five extraction tasks run in parallel as `Explore` subagents (read-only). Each writes its draft to `docs/superpowers/specs/extracted/part-N.md`.

---

### Task 1: Extract Part 1 PDF → markdown draft

**Files:**
- Create: `docs/superpowers/specs/extracted/part-1.md`
- Source: `../FinalPaper/Part 1 - Friction Reduction Principle Always Wins.pdf` (relative to project root, the parent of the repo dir)

- [ ] **Step 1: Locate the PDF and confirm it exists**

Run: `ls "../FinalPaper/Part 1 - Friction Reduction Principle Always Wins.pdf"`
Expected: file path echoed back, no error.

- [ ] **Step 2: Read the full PDF**

Use the `Read` tool with `file_path` = absolute path to the PDF and `pages` = "1-20" (or smaller if file has fewer pages; check size first with `ls -la`).

- [ ] **Step 3: Write the extraction draft**

Save markdown to `docs/superpowers/specs/extracted/part-1.md` using this exact structure:

```markdown
---
slug: friction-reduction
n: 1
viz-folder: collaboration-framework
---

# {{title}}

**Dek:** {{one-line subtitle}}

**Reading time:** {{word_count / 250}} min (computed: word_count = X)

**Suggested embed insertion:** after paragraph that begins "..." (quote the first ~10 words)

---

## Prose (before embed)

{{verbatim section headings as `##` / `###`, paragraphs as plain text, blockquotes prefixed with `> `, citations as `[^N]`}}

---

## Prose (after embed)

{{remaining prose, same conventions}}

---

## Footnotes

[^1]: {{source citation}}
[^2]: {{...}}

---

## Flagged ambiguities

- (any place where PDF extraction was unclear — paragraph + question)
```

- [ ] **Step 4: Verify the draft**

Run: `wc -w docs/superpowers/specs/extracted/part-1.md`
Expected: word count > 500 (Part 1 PDF is 88 KB; should contain substantial prose). If word count < 500, the extraction failed — flag in step 5.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/extracted/part-1.md
git commit -m "docs: extract Part 1 PDF for article content"
```

---

### Task 2: Extract Part 2 PDF → markdown draft

**Files:**
- Create: `docs/superpowers/specs/extracted/part-2.md`
- Source: `../FinalPaper/Part 2 - Before You Automate.pdf`

- [ ] **Step 1: Locate the PDF**

Run: `ls "../FinalPaper/Part 2 - Before You Automate.pdf"`
Expected: file path echoed back.

- [ ] **Step 2: Read the full PDF**

Use the `Read` tool with `pages` = "1-20".

- [ ] **Step 3: Write the extraction draft**

Save to `docs/superpowers/specs/extracted/part-2.md` following Task 1, Step 3 structure exactly. Front-matter:
```yaml
---
slug: before-you-automate
n: 2
viz-folder: four-rungs
---
```

- [ ] **Step 4: Verify the draft**

Run: `wc -w docs/superpowers/specs/extracted/part-2.md`
Expected: word count > 800 (Part 2 PDF is 128 KB).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/extracted/part-2.md
git commit -m "docs: extract Part 2 PDF for article content"
```

---

### Task 3: Extract Part 3 PDF → markdown draft

**Files:**
- Create: `docs/superpowers/specs/extracted/part-3.md`
- Source: `../FinalPaper/Part 3 - What AI Can't See.pdf`

- [ ] **Step 1: Locate the PDF**

Run: `ls "../FinalPaper/Part 3 - What AI Can't See.pdf"`
Expected: file path echoed back.

- [ ] **Step 2: Read the full PDF**

Use the `Read` tool with `pages` = "1-20".

- [ ] **Step 3: Write the extraction draft**

Save to `docs/superpowers/specs/extracted/part-3.md` following Task 1, Step 3 structure. Front-matter:
```yaml
---
slug: what-ai-cant-see
n: 3
viz-folder: complementarity-view
---
```

- [ ] **Step 4: Verify the draft**

Run: `wc -w docs/superpowers/specs/extracted/part-3.md`
Expected: word count > 1500 (Part 3 is 244 KB — the largest PDF).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/extracted/part-3.md
git commit -m "docs: extract Part 3 PDF for article content"
```

---

### Task 4: Extract Part 4 PDF → markdown draft

**Files:**
- Create: `docs/superpowers/specs/extracted/part-4.md`
- Source: `../FinalPaper/Part 4 - Designing Around the Gaps.pdf`

- [ ] **Step 1: Locate the PDF**

Run: `ls "../FinalPaper/Part 4 - Designing Around the Gaps.pdf"`
Expected: file path echoed back.

- [ ] **Step 2: Read the full PDF**

Use the `Read` tool with `pages` = "1-20".

- [ ] **Step 3: Write the extraction draft**

Save to `docs/superpowers/specs/extracted/part-4.md` following Task 1, Step 3 structure. Front-matter:
```yaml
---
slug: designing-around-gaps
n: 4
viz-folder: friction-spectrum
---
```

- [ ] **Step 4: Verify the draft**

Run: `wc -w docs/superpowers/specs/extracted/part-4.md`
Expected: word count > 600 (Part 4 is 90 KB).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/extracted/part-4.md
git commit -m "docs: extract Part 4 PDF for article content"
```

---

### Task 5: Extract Part 5 PDF → markdown draft

**Files:**
- Create: `docs/superpowers/specs/extracted/part-5.md`
- Source: `../FinalPaper/Part 5 - The Cost of Speed.pdf`

- [ ] **Step 1: Locate the PDF**

Run: `ls "../FinalPaper/Part 5 - The Cost of Speed.pdf"`
Expected: file path echoed back.

- [ ] **Step 2: Read the full PDF**

Use the `Read` tool with `pages` = "1-20".

- [ ] **Step 3: Write the extraction draft**

Save to `docs/superpowers/specs/extracted/part-5.md` following Task 1, Step 3 structure. Front-matter:
```yaml
---
slug: cost-of-speed
n: 5
viz-folder: cost-of-speed
---
```

- [ ] **Step 4: Verify the draft**

Run: `wc -w docs/superpowers/specs/extracted/part-5.md`
Expected: word count > 1000 (Part 5 is 154 KB).

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/extracted/part-5.md
git commit -m "docs: extract Part 5 PDF for article content"
```

---

# WAVE 2 — Foundations (sequential)

Tasks 6–12 are sequential because each depends on the previous. The CSS sets the visual language that the article pages use; the embed patches happen before any article references them; the landing repoint happens last so the articles exist before they're linked.

---

### Task 6: Create `shared/article.css`

**Files:**
- Create: `shared/article.css`

This file implements every visual specification from spec §5 and §6.

- [ ] **Step 1: Write the file**

Create `shared/article.css` with the following content (verbatim):

```css
/* ============================================================
   article.css — Reading-shell, embed frame, and series nav
   Used by every page under /articles/
   ============================================================ */

*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --color-bg: #08080c;
  --color-text: #e8e4dc;
  --color-text-strong: #f5f0e8;
  --color-text-muted: rgba(245, 240, 232, 0.55);
  --color-text-dim: rgba(245, 240, 232, 0.35);
  --color-border-faint: rgba(255, 255, 255, 0.08);
  --color-border-hairline: rgba(255, 255, 255, 0.04);
  --color-accent-amber: rgba(251, 191, 36, 0.4);
  --color-accent-warm: #fbbf24;
  --color-accent-cyan: #22d3ee;
  --color-accent-emerald: #34d399;

  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-body: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;

  --prose-width: 680px;
  --embed-width: 960px;
  --header-height: 60px;
}

html {
  background: var(--color-bg);
  scroll-behavior: smooth;
}

body.article-page {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body);
  font-weight: 300;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-height: 100vh;
  padding-top: var(--header-height);
  padding-bottom: 4rem;
}

a { color: inherit; text-decoration: none; }

/* ===== Header ===== */
.article-header {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  background: rgba(8, 8, 12, 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border-hairline);
  z-index: 100;
}
.article-header__wordmark {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 500;
  font-size: 1.1rem;
  color: var(--color-text-strong);
  letter-spacing: 0.005em;
  transition: opacity 0.2s ease;
}
.article-header__wordmark:hover { opacity: 0.7; }
.article-header__meta {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-text-dim);
}

/* ===== Main article container ===== */
.article {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

/* ===== Title block ===== */
.article__title-block {
  width: 100%;
  max-width: var(--prose-width);
  padding: 6rem 1.5rem 4rem;
  text-align: center;
}
.article__eyebrow {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-text-dim);
  margin-bottom: 1.5rem;
}
.article__title {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 3.5rem;
  line-height: 1.05;
  color: var(--color-text-strong);
  margin-bottom: 1.5rem;
  letter-spacing: -0.005em;
}
.article__dek {
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 400;
  font-size: 1.35rem;
  line-height: 1.45;
  color: var(--color-text-muted);
  max-width: 580px;
  margin: 0 auto 2rem;
}
.article__meta {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  color: var(--color-text-dim);
}

/* ===== Prose column ===== */
.article__prose {
  width: 100%;
  max-width: var(--prose-width);
  padding: 0 1.5rem;
  font-size: 1.0625rem;
  line-height: 1.72;
  color: var(--color-text);
}
.article__prose > * + * { margin-top: 1.5rem; }

.article__prose h2 {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 2rem;
  line-height: 1.2;
  color: var(--color-text-strong);
  margin-top: 4rem;
  margin-bottom: 1rem;
  letter-spacing: -0.005em;
}
.article__prose h3 {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 1.5rem;
  line-height: 1.25;
  color: var(--color-text-strong);
  margin-top: 2.5rem;
  margin-bottom: 0.75rem;
}
.article__prose p { color: var(--color-text); }
.article__prose strong { color: var(--color-text-strong); font-weight: 500; }
.article__prose em { font-style: italic; color: var(--color-text-strong); }

.article__prose blockquote {
  margin: 2rem 0;
  padding: 0.5rem 0 0.5rem 1.5rem;
  border-left: 2px solid var(--color-accent-amber);
  font-family: var(--font-display);
  font-style: italic;
  font-size: 1.25rem;
  line-height: 1.5;
  color: var(--color-text-strong);
}
.article__prose blockquote cite {
  display: block;
  margin-top: 0.75rem;
  font-family: var(--font-body);
  font-style: normal;
  font-size: 0.8rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-dim);
}

.article__prose .stat-callout {
  margin: 2.5rem auto;
  padding: 2rem 1.5rem;
  border: 1px solid var(--color-border-faint);
  border-radius: 8px;
  text-align: center;
  background: rgba(255, 255, 255, 0.015);
}
.article__prose .stat-callout__number {
  display: block;
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 3rem;
  line-height: 1;
  color: var(--color-accent-warm);
  margin-bottom: 0.5rem;
}
.article__prose .stat-callout__label {
  display: block;
  font-family: var(--font-body);
  font-size: 0.95rem;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
}
.article__prose .stat-callout__source {
  display: block;
  font-family: var(--font-body);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-dim);
}

.article__prose sup.footnote-ref {
  font-size: 0.7em;
  vertical-align: super;
  line-height: 0;
  margin-left: 1px;
}
.article__prose sup.footnote-ref a {
  color: var(--color-accent-warm);
  text-decoration: none;
  padding: 0 2px;
}
.article__prose sup.footnote-ref a:hover { text-decoration: underline; }

.article__prose ul, .article__prose ol {
  padding-left: 1.5rem;
  margin: 1.5rem 0;
}
.article__prose ul li, .article__prose ol li { margin: 0.5rem 0; }

/* ===== Embed ===== */
.article-embed {
  width: 100%;
  max-width: var(--embed-width);
  margin: 4rem auto;
  /* breaks out of the 680px prose column */
  position: relative;
  left: 50%;
  transform: translateX(-50%);
  padding: 0 1.5rem;
}
.embed-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border: 1px solid var(--color-border-faint);
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-bg);
  box-shadow:
    inset 0 0 0 1px var(--color-border-hairline),
    0 24px 60px -20px rgba(0, 0, 0, 0.6);
}
.article-embed__iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
.embed-fullscreen-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(8, 8, 12, 0.6);
  color: rgba(245, 240, 232, 0.7);
  border: 1px solid var(--color-border-faint);
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 2;
}
.embed-fullscreen-btn:hover {
  color: var(--color-text-strong);
  background: rgba(8, 8, 12, 0.8);
  transform: scale(1.05);
}
.embed-fullscreen-btn:focus-visible {
  outline: 2px solid var(--color-accent-warm);
  outline-offset: 2px;
}
.embed-hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-body);
  font-weight: 300;
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  background: rgba(8, 8, 12, 0.6);
  padding: 6px 12px;
  border-radius: 12px;
  opacity: 0;
  transition: opacity 0.6s ease;
  pointer-events: none;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.embed-hint--visible { opacity: 1; }
.article-embed__caption {
  margin-top: 1rem;
  text-align: center;
  font-family: var(--font-body);
  font-weight: 300;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  font-style: italic;
}

/* ===== Footnotes ===== */
.article-footnotes {
  width: 100%;
  max-width: var(--prose-width);
  padding: 4rem 1.5rem 2rem;
  border-top: 1px solid var(--color-border-hairline);
  margin-top: 4rem;
}
.article-footnotes__heading {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 1.5rem;
  color: var(--color-text-strong);
  margin-bottom: 1.5rem;
}
.article-footnotes ol {
  padding-left: 1.5rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.6;
}
.article-footnotes li {
  margin: 0.75rem 0;
}
.article-footnotes li a { color: var(--color-accent-warm); }
.article-footnotes li a:hover { text-decoration: underline; }

/* ===== Series nav (prev/next cards) ===== */
.article-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  width: 100%;
  max-width: 1100px;
  margin: 5rem auto 0;
  padding: 0 1.5rem;
}
.article-nav__card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--color-border-faint);
  border-radius: 12px;
  overflow: hidden;
  transition:
    transform 0.3s ease,
    background-color 0.3s ease,
    border-color 0.3s ease;
  isolation: isolate;
}
.article-nav__card::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    600px circle at var(--mx, 50%) var(--my, 0%),
    rgba(251, 191, 36, 0.06),
    transparent 60%
  );
  opacity: 0;
  transition: opacity 0.4s ease;
  z-index: -1;
}
.article-nav__card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.035);
  border-color: rgba(255, 255, 255, 0.14);
}
.article-nav__card:hover::before { opacity: 1; }
.article-nav__card--next { text-align: right; }
.article-nav__eyebrow {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-text-dim);
}
.article-nav__part {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 0.75rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-accent-warm);
}
.article-nav__title {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 1.5rem;
  line-height: 1.2;
  color: var(--color-text-strong);
}
.article-nav__dek {
  font-family: var(--font-body);
  font-weight: 300;
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

/* ===== Mobile ===== */
@media (max-width: 768px) {
  :root {
    --header-height: 52px;
  }
  .article-header { padding: 0 1rem; }
  .article-header__wordmark { font-size: 0.95rem; }
  .article__title-block { padding: 4rem 1rem 3rem; }
  .article__title { font-size: 2.25rem; }
  .article__dek { font-size: 1.1rem; }
  .article__prose { padding: 0 1.25rem; font-size: 1rem; line-height: 1.7; }
  .article__prose h2 { font-size: 1.6rem; margin-top: 3rem; }
  .article__prose h3 { font-size: 1.25rem; }
  .article-embed { margin: 2.5rem auto; padding: 0; }
  .embed-frame { border-radius: 0; border-left: 0; border-right: 0; }
  .embed-fullscreen-btn { top: 8px; right: 8px; width: 32px; height: 32px; font-size: 14px; }
  .article-nav {
    grid-template-columns: 1fr;
    margin-top: 3rem;
    padding: 0 1rem;
  }
  .article-nav__card--next { text-align: left; }
}

/* ===== Reduced motion ===== */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .article-nav__card { transition: none; }
  .article-nav__card:hover { transform: none; }
  .embed-fullscreen-btn { transition: none; }
}
```

- [ ] **Step 2: Validate CSS by serving and inspecting**

Start the server: `python3 -m http.server 8080` (or confirm it's running)
Open the file directly in the browser: `http://localhost:8080/shared/article.css`
Expected: file loads as text/css, no 404. Visually scan for syntax errors.

- [ ] **Step 3: Commit**

```bash
git add shared/article.css
git commit -m "feat: add article.css reading shell + embed + nav styles"
```

---

### Task 7: Patch `collaboration-framework` for `?embed=1`

**Files:**
- Modify: `visualizations/collaboration-framework/index.html`

The collaboration-framework viz has no top header bar to hide (it's a full-viewport 2×2 grid). The only chrome to hide is the detail-overlay modal that opens on click — but that's only visible after interaction, so it's not "always-on chrome". For this viz the embed patch is minimal: just add the script flag so the body class is set (for future consistency), with no display:none rules required.

- [ ] **Step 1: Read the file's `<head>` and confirm structure**

Open `visualizations/collaboration-framework/index.html`. Locate the closing `</head>` tag.

- [ ] **Step 2: Add the embed-flag script immediately before `</head>`**

Insert (using the Edit tool):
```html
  <script>
    (function () {
      var params = new URLSearchParams(location.search);
      if (params.get('embed') === '1') {
        document.documentElement.classList.add('embed-mode');
        document.addEventListener('DOMContentLoaded', function () {
          document.body.classList.add('embed-mode');
        });
      }
    })();
  </script>
</head>
```
(Old string: `</head>`. New string: the script block above.)

- [ ] **Step 3: Verify the viz still loads at `?embed=1`**

Open: `http://localhost:8080/visualizations/collaboration-framework/?embed=1`
Open the browser DevTools Console.
Expected: page renders normally (2×2 grid visible), `<html>` element has class `embed-mode`, no console errors.

- [ ] **Step 4: Verify the standalone (no `?embed=1`) still works**

Open: `http://localhost:8080/visualizations/collaboration-framework/`
Expected: page renders identically to its pre-patch state. No console errors.

- [ ] **Step 5: Commit**

```bash
git add visualizations/collaboration-framework/index.html
git commit -m "feat(viz): add ?embed=1 mode flag to collaboration-framework"
```

---

### Task 8: Patch `four-rungs` for `?embed=1`

**Files:**
- Modify: `visualizations/four-rungs/index.html`

Chrome to hide in embed mode: the header (`.header#header`), the legend (`.legend#legend`), and the controls hint (`.controls-hint#controlsHint`). The view-controls (`.view-controls#viewControls`) MUST stay visible — those are the interaction.

- [ ] **Step 1: Locate the existing `<style>` block end**

Open `visualizations/four-rungs/index.html`. Find the closing `</style>` tag inside `<head>`.

- [ ] **Step 2: Add chrome-hide CSS just before `</style>`**

Insert (using the Edit tool) immediately before `</style>`:
```css

        /* ===== Embed mode (when loaded with ?embed=1) ===== */
        .embed-mode .header,
        .embed-mode #header,
        .embed-mode .legend,
        .embed-mode #legend,
        .embed-mode .controls-hint,
        .embed-mode #controlsHint {
          display: none !important;
        }
```

- [ ] **Step 3: Add the embed-flag script immediately before `</head>`**

Insert (using the Edit tool):
```html
  <script>
    (function () {
      var params = new URLSearchParams(location.search);
      if (params.get('embed') === '1') {
        document.documentElement.classList.add('embed-mode');
        document.addEventListener('DOMContentLoaded', function () {
          document.body.classList.add('embed-mode');
        });
      }
    })();
  </script>
</head>
```

- [ ] **Step 4: Validate the JS syntax of main.js (untouched but confirm)**

Run: `node --check visualizations/four-rungs/main.js`
Expected: no output (success).

- [ ] **Step 5: Browser-verify embed mode**

Open: `http://localhost:8080/visualizations/four-rungs/?embed=1`
Expected:
- Three.js ladder scene renders
- View-controls (Recommended/Current) tabs visible at top center
- Header "The Four Rungs" title HIDDEN
- Legend at bottom-left HIDDEN
- Controls hint HIDDEN
- No console errors

- [ ] **Step 6: Browser-verify standalone mode**

Open: `http://localhost:8080/visualizations/four-rungs/`
Expected: page renders identically to its pre-patch state — header visible, legend visible, controls hint visible. No regressions.

- [ ] **Step 7: Commit**

```bash
git add visualizations/four-rungs/index.html
git commit -m "feat(viz): add ?embed=1 chrome-hide to four-rungs"
```

---

### Task 9: Patch `complementarity-view` for `?embed=1`

**Files:**
- Modify: `visualizations/complementarity-view/index.html`

Chrome to hide: header (`.header`), quote (`.quote#quote`), legend (`.legend#legend`), controls hint (`.controls-hint#controlsHint`), audio toggle (`#audio-toggle`), onboarding modal (`.onboarding-content` and its parent overlay). View controls (`.view-controls#viewControls`) MUST stay visible.

- [ ] **Step 1: Locate the existing `<style>` block end**

Open `visualizations/complementarity-view/index.html`. Find the closing `</style>` tag inside `<head>`.

- [ ] **Step 2: Add chrome-hide CSS just before `</style>`**

Insert:
```css

        /* ===== Embed mode (when loaded with ?embed=1) ===== */
        .embed-mode .header,
        .embed-mode .quote,
        .embed-mode #quote,
        .embed-mode .legend,
        .embed-mode #legend,
        .embed-mode .controls-hint,
        .embed-mode #controlsHint,
        .embed-mode #audio-toggle,
        .embed-mode .audio-toggle,
        .embed-mode .onboarding-overlay,
        .embed-mode .onboarding-content {
          display: none !important;
        }
```

- [ ] **Step 3: Add the embed-flag script immediately before `</head>`**

Insert (using the Edit tool):
```html
  <script>
    (function () {
      var params = new URLSearchParams(location.search);
      if (params.get('embed') === '1') {
        document.documentElement.classList.add('embed-mode');
        document.addEventListener('DOMContentLoaded', function () {
          document.body.classList.add('embed-mode');
        });
      }
    })();
  </script>
</head>
```

- [ ] **Step 4: Validate main.js syntax**

Run: `node --check visualizations/complementarity-view/main.js`
Expected: no output (success).

- [ ] **Step 5: Browser-verify embed mode**

Open: `http://localhost:8080/visualizations/complementarity-view/?embed=1`
Expected:
- Three.js street-lamp scene renders with all orbs
- View-controls tabs visible at top center
- Header / quote / legend / controls hint / audio button / onboarding modal HIDDEN
- Network tab confirms NO request for `Walking_person.glb` or any other GLB file
- No console errors

- [ ] **Step 6: Browser-verify standalone mode**

Open: `http://localhost:8080/visualizations/complementarity-view/`
Expected: page renders identically to pre-patch state. No regressions.

- [ ] **Step 7: Commit**

```bash
git add visualizations/complementarity-view/index.html
git commit -m "feat(viz): add ?embed=1 chrome-hide to complementarity-view"
```

---

### Task 10: Patch `friction-spectrum` for `?embed=1`

**Files:**
- Modify: `visualizations/friction-spectrum/index.html`

Chrome to hide: header (`#header`), quote (`#quote`), legend (`#legend`), friction-arrow (`#friction-arrow`), controls-hint (`#controls-hint`), audio-toggle (`#audio-toggle`). View controls (`#view-controls`) MUST stay visible. Note: this viz wraps chrome in `.ui-overlay` class — we hide individually so the view controls (which also has `.ui-overlay`) stay visible.

- [ ] **Step 1: Locate the existing `<style>` block end**

Open `visualizations/friction-spectrum/index.html`. Find the closing `</style>` tag.

- [ ] **Step 2: Add chrome-hide CSS just before `</style>`**

Insert:
```css

        /* ===== Embed mode (when loaded with ?embed=1) ===== */
        .embed-mode #header,
        .embed-mode #quote,
        .embed-mode #legend,
        .embed-mode #friction-arrow,
        .embed-mode #controls-hint,
        .embed-mode #audio-toggle {
          display: none !important;
        }
```

- [ ] **Step 3: Add the embed-flag script immediately before `</head>`**

Insert (using the Edit tool):
```html
  <script>
    (function () {
      var params = new URLSearchParams(location.search);
      if (params.get('embed') === '1') {
        document.documentElement.classList.add('embed-mode');
        document.addEventListener('DOMContentLoaded', function () {
          document.body.classList.add('embed-mode');
        });
      }
    })();
  </script>
</head>
```

- [ ] **Step 4: Validate main.js syntax**

Run: `node --check visualizations/friction-spectrum/main.js`
Expected: no output (success).

- [ ] **Step 5: Browser-verify embed mode**

Open: `http://localhost:8080/visualizations/friction-spectrum/?embed=1`
Expected:
- Three.js membrane permeability scene renders
- View-controls tabs visible at top center
- All other chrome HIDDEN (header, quote, legend, friction-arrow, controls-hint, audio toggle)
- No console errors

- [ ] **Step 6: Browser-verify standalone mode**

Open: `http://localhost:8080/visualizations/friction-spectrum/`
Expected: identical to pre-patch state. No regressions.

- [ ] **Step 7: Commit**

```bash
git add visualizations/friction-spectrum/index.html
git commit -m "feat(viz): add ?embed=1 chrome-hide to friction-spectrum"
```

---

### Task 11: Patch `cost-of-speed` for `?embed=1`

**Files:**
- Modify: `visualizations/cost-of-speed/index.html`

Chrome to hide: header (`.header`), quote (`.quote#quote`), legend (`.legend#legend`), controls hint (`.controls-hint#controlsHint`), cultural-debt indicator (`.debt-label` and its container — needs visual inspection). View controls MUST stay visible.

- [ ] **Step 1: Read the file and confirm chrome selectors**

Open `visualizations/cost-of-speed/index.html`. Verify the chrome elements present (header at line ~473, quote at ~478, legend at ~484, controls-hint at ~526, cultural debt at ~517–522). Note the exact class/id used for the cultural debt container.

- [ ] **Step 2: Locate the existing `<style>` block end**

Find the closing `</style>` tag.

- [ ] **Step 3: Add chrome-hide CSS just before `</style>`**

Insert (adjust `.cultural-debt` selector based on the actual container class found in Step 1):
```css

        /* ===== Embed mode (when loaded with ?embed=1) ===== */
        .embed-mode .header,
        .embed-mode .quote,
        .embed-mode #quote,
        .embed-mode .legend,
        .embed-mode #legend,
        .embed-mode .controls-hint,
        .embed-mode #controlsHint,
        .embed-mode .cultural-debt,
        .embed-mode .debt-label {
          display: none !important;
        }
```

- [ ] **Step 4: Add the embed-flag script immediately before `</head>`**

Insert (using the Edit tool):
```html
  <script>
    (function () {
      var params = new URLSearchParams(location.search);
      if (params.get('embed') === '1') {
        document.documentElement.classList.add('embed-mode');
        document.addEventListener('DOMContentLoaded', function () {
          document.body.classList.add('embed-mode');
        });
      }
    })();
  </script>
</head>
```

- [ ] **Step 5: Validate main.js syntax**

Run: `node --check visualizations/cost-of-speed/main.js`
Expected: no output (success).

- [ ] **Step 6: Browser-verify embed mode**

Open: `http://localhost:8080/visualizations/cost-of-speed/?embed=1`
Expected: scene renders, view controls visible, all other chrome hidden, no console errors.

- [ ] **Step 7: Browser-verify standalone mode**

Open: `http://localhost:8080/visualizations/cost-of-speed/`
Expected: identical to pre-patch state including the Cultural Debt indicator.

- [ ] **Step 8: Commit**

```bash
git add visualizations/cost-of-speed/index.html
git commit -m "feat(viz): add ?embed=1 chrome-hide to cost-of-speed"
```

---

### Task 12: Repoint landing-page Part cards to articles

**Files:**
- Modify: `index.html` (landing — repoint 5 hrefs only)

Landing currently sends users straight to the standalone visualizations. After this patch, the cards open the article pages, which embed the same visualizations.

- [ ] **Step 1: Read the current landing card hrefs**

Open `index.html`. The 5 Part cards are around lines 1233–1335 (search for `data-href="visualizations/`).

- [ ] **Step 2: Apply 5 href + data-href repoints**

Use 10 separate Edit operations (5 cards × 2 href attributes each).

Card 1 — Part 1 (collaboration-framework → friction-reduction):
- Replace `data-href="visualizations/collaboration-framework/"` with `data-href="articles/friction-reduction/"`
- Replace `href="visualizations/collaboration-framework/" class="part__action" aria-label="Explore Part 1"` with `href="articles/friction-reduction/" class="part__action" aria-label="Read Part 1"`

Card 2 — Part 2 (four-rungs → before-you-automate):
- Replace `data-href="visualizations/four-rungs/"` with `data-href="articles/before-you-automate/"`
- Replace `href="visualizations/four-rungs/" class="part__action" aria-label="Explore Part 2"` with `href="articles/before-you-automate/" class="part__action" aria-label="Read Part 2"`

Card 3 — Part 3 (complementarity-view → what-ai-cant-see):
- Replace `data-href="visualizations/complementarity-view/"` with `data-href="articles/what-ai-cant-see/"`
- Replace `href="visualizations/complementarity-view/" class="part__action" aria-label="Explore Part 3"` with `href="articles/what-ai-cant-see/" class="part__action" aria-label="Read Part 3"`

Card 4 — Part 4 (friction-spectrum → designing-around-gaps):
- Replace `data-href="visualizations/friction-spectrum/"` with `data-href="articles/designing-around-gaps/"`
- Replace `href="visualizations/friction-spectrum/" class="part__action" aria-label="Explore Part 4"` with `href="articles/designing-around-gaps/" class="part__action" aria-label="Read Part 4"`

Card 5 — Part 5 (cost-of-speed → cost-of-speed) — slug stays the same but path changes:
- Replace `data-href="visualizations/cost-of-speed/"` with `data-href="articles/cost-of-speed/"`
- Replace `href="visualizations/cost-of-speed/" class="part__action" aria-label="Explore Part 5"` with `href="articles/cost-of-speed/" class="part__action" aria-label="Read Part 5"`

- [ ] **Step 3: Verify zero leftover viz-direct links remain on the landing**

Run: `grep -nE 'href="visualizations/' index.html`
Expected: no output (no matches). All 5 part cards now point at `articles/`.

- [ ] **Step 4: Browser-verify the landing still renders identically**

Open: `http://localhost:8080/`
Expected: landing page renders bit-for-bit identical (god rays, starfield, hero, bento cards). Hover each card → confirms each "Explore →" / "Read →" CTA still works. Cards link to `articles/<slug>/` (which 404 until Wave 3 ships).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(landing): repoint part cards from /visualizations/ to /articles/"
```

---

# WAVE 3 — Article Assembly (5 parallel tasks)

Each article task starts from Reference A's canonical template and the matching Wave-1 extracted draft (`docs/superpowers/specs/extracted/part-N.md`). Tasks 13–17 run in parallel as fresh subagents — they share no state.

**Per-task input bundle for each Wave 3 subagent:**
- Reference A template (above)
- Extraction draft at `docs/superpowers/specs/extracted/part-N.md`
- Slot values from the per-article table above
- The neighbour titles/deks for prev/next nav (resolved from Wave-1 outputs of adjacent parts)

---

### Task 13: Build `articles/friction-reduction/index.html` (Part 1)

**Files:**
- Create: `articles/friction-reduction/index.html`
- Read: `docs/superpowers/specs/extracted/part-1.md` (for prose + suggested embed insertion)
- Read: `docs/superpowers/specs/extracted/part-2.md` (for next-card title + dek)

- [ ] **Step 1: Create the article directory**

Run: `mkdir -p articles/friction-reduction`

- [ ] **Step 2: Compose the article HTML from Reference A**

Write `articles/friction-reduction/index.html` filling Reference A's slots with these values:
- `n` = `1`
- `slug` = `friction-reduction`
- `viz-folder` = `collaboration-framework`
- `eyebrow-tag` = `THE FRICTION PRINCIPLE`
- `title` = (from Part 1 draft frontmatter / title)
- `dek` = (from Part 1 draft)
- `reading-time` = (from Part 1 draft, computed)
- `viz-title` = `Human-AI Collaboration Framework`
- `viz-caption` = `The Expertise × Consequence framework — click any quadrant to focus.`
- `prose-before-embed` = HTML-rendered Markdown from Part 1 draft, up to the suggested embed insertion point (paragraph identified in Wave 1)
- `prose-after-embed` = HTML-rendered Markdown from Part 1 draft, after the insertion point
- `footnotes-block-optional` = `<section class="article-footnotes"><h2 class="article-footnotes__heading">Notes</h2><ol>…</ol></section>` if Part 1 has footnotes; omit otherwise
- `prev-href` = `/#series`
- `prev-eyebrow` = `BACK TO THE SERIES`
- `prev-part` = (empty string)
- `prev-title` = `All five parts`
- `prev-dek` = `Return to the series overview.`
- `next-href` = `/articles/before-you-automate/`
- `next-eyebrow` = `NEXT`
- `next-part` = `PART 2`
- `next-title` = (Part 2's title from `part-2.md` frontmatter)
- `next-dek` = (Part 2's one-line dek)

Markdown-to-HTML rules:
- `# heading` → `<h1 class="article__title">` (only the article title; the body has no top-level heading)
- `## heading` → `<h2>`
- `### heading` → `<h3>`
- Paragraphs → `<p>`
- `> blockquote` → `<blockquote><p>…</p><cite>…</cite></blockquote>` (cite from the source attribution line)
- `**bold**` → `<strong>`, `*italic*` → `<em>`
- `[^N]` → `<sup class="footnote-ref"><a href="#fn-N">N</a></sup>`
- Stat callouts (PDF passages of the form "X% — Source Year") → `<aside class="stat-callout"><span class="stat-callout__number">X%</span><span class="stat-callout__label">…</span><span class="stat-callout__source">Source Year</span></aside>`

- [ ] **Step 3: Validate the HTML structure**

Run: `python3 -c "from html.parser import HTMLParser; import sys; HTMLParser().feed(open('articles/friction-reduction/index.html').read()); print('OK')"`
Expected: `OK` printed, no exception.

- [ ] **Step 4: Browser-verify the article loads**

Open: `http://localhost:8080/articles/friction-reduction/`
Expected:
- Page loads with title block, prose, embed (iframe of `/visualizations/collaboration-framework/?embed=1`), more prose, footer with "Back to the series" (left) and "Part 2" card (right).
- No console errors.
- Embed iframe loads the 2×2 framework.
- Click fullscreen icon → navigates to `/visualizations/collaboration-framework/?from=friction-reduction`.
- Browser back button → returns to article at same scroll position.
- Click "Next" card → navigates to `/articles/before-you-automate/` (will 404 until Task 14 ships).

- [ ] **Step 5: Commit**

```bash
git add articles/friction-reduction/index.html
git commit -m "feat(articles): add Part 1 — Friction Reduction Principle Always Wins"
```

---

### Task 14: Build `articles/before-you-automate/index.html` (Part 2)

**Files:**
- Create: `articles/before-you-automate/index.html`
- Read: `docs/superpowers/specs/extracted/part-2.md`
- Read: `docs/superpowers/specs/extracted/part-1.md` (prev neighbour)
- Read: `docs/superpowers/specs/extracted/part-3.md` (next neighbour)

- [ ] **Step 1: Create the article directory**

Run: `mkdir -p articles/before-you-automate`

- [ ] **Step 2: Compose the article HTML from Reference A**

Write `articles/before-you-automate/index.html` filling Reference A's slots:
- `n` = `2`
- `slug` = `before-you-automate`
- `viz-folder` = `four-rungs`
- `eyebrow-tag` = `BEFORE YOU AUTOMATE`
- `title` = (from Part 2 draft)
- `dek` = (from Part 2 draft)
- `reading-time` = (from Part 2 draft)
- `viz-title` = `The Four Rungs`
- `viz-caption` = `The Problem Abstraction Ladder — drag to rotate, click any rung to focus.`
- `prose-before-embed` / `prose-after-embed` = HTML-rendered Markdown from Part 2 draft, split at the suggested embed insertion point
- `footnotes-block-optional` = footnotes section if present
- `prev-href` = `/articles/friction-reduction/`
- `prev-eyebrow` = `PREVIOUS`
- `prev-part` = `PART 1`
- `prev-title` = (Part 1's title from `part-1.md`)
- `prev-dek` = (Part 1's one-line dek)
- `next-href` = `/articles/what-ai-cant-see/`
- `next-eyebrow` = `NEXT`
- `next-part` = `PART 3`
- `next-title` = (Part 3's title)
- `next-dek` = (Part 3's dek)

Markdown-to-HTML rules: same as Task 13 Step 2.

- [ ] **Step 3: Validate the HTML structure**

Run: `python3 -c "from html.parser import HTMLParser; HTMLParser().feed(open('articles/before-you-automate/index.html').read()); print('OK')"`
Expected: `OK`.

- [ ] **Step 4: Browser-verify**

Open: `http://localhost:8080/articles/before-you-automate/`
Expected: full article renders, four-rungs viz embeds, fullscreen navigates correctly, prev links to Part 1, next links to Part 3.

- [ ] **Step 5: Commit**

```bash
git add articles/before-you-automate/index.html
git commit -m "feat(articles): add Part 2 — Before You Automate"
```

---

### Task 15: Build `articles/what-ai-cant-see/index.html` (Part 3)

**Files:**
- Create: `articles/what-ai-cant-see/index.html`
- Read: `docs/superpowers/specs/extracted/part-3.md`
- Read: `docs/superpowers/specs/extracted/part-2.md` (prev)
- Read: `docs/superpowers/specs/extracted/part-4.md` (next)

- [ ] **Step 1: Create the article directory**

Run: `mkdir -p articles/what-ai-cant-see`

- [ ] **Step 2: Compose the article HTML from Reference A**

Fill Reference A's slots:
- `n` = `3`
- `slug` = `what-ai-cant-see`
- `viz-folder` = `complementarity-view`
- `eyebrow-tag` = `WHAT AI CAN'T SEE`
- `title`, `dek`, `reading-time`, prose = from `part-3.md`
- `viz-title` = `The Complementarity View`
- `viz-caption` = `The streetlight effect — drag to rotate, click any orb to focus.`
- `prev-href` = `/articles/before-you-automate/`, `prev-eyebrow` = `PREVIOUS`, `prev-part` = `PART 2`, `prev-title`/`prev-dek` = from `part-2.md`
- `next-href` = `/articles/designing-around-gaps/`, `next-eyebrow` = `NEXT`, `next-part` = `PART 4`, `next-title`/`next-dek` = from `part-4.md`

Markdown-to-HTML rules: same as Task 13 Step 2.

- [ ] **Step 3: Validate**

Run: `python3 -c "from html.parser import HTMLParser; HTMLParser().feed(open('articles/what-ai-cant-see/index.html').read()); print('OK')"`
Expected: `OK`.

- [ ] **Step 4: Browser-verify**

Open: `http://localhost:8080/articles/what-ai-cant-see/`
Expected: full article renders, complementarity-view viz embeds with view controls visible, scene fully interactive, NO GLB request in Network tab.

- [ ] **Step 5: Commit**

```bash
git add articles/what-ai-cant-see/index.html
git commit -m "feat(articles): add Part 3 — What AI Can't See"
```

---

### Task 16: Build `articles/designing-around-gaps/index.html` (Part 4)

**Files:**
- Create: `articles/designing-around-gaps/index.html`
- Read: `docs/superpowers/specs/extracted/part-4.md`
- Read: `docs/superpowers/specs/extracted/part-3.md` (prev)
- Read: `docs/superpowers/specs/extracted/part-5.md` (next)

- [ ] **Step 1: Create the article directory**

Run: `mkdir -p articles/designing-around-gaps`

- [ ] **Step 2: Compose the article HTML from Reference A**

Fill Reference A's slots:
- `n` = `4`
- `slug` = `designing-around-gaps`
- `viz-folder` = `friction-spectrum`
- `eyebrow-tag` = `DESIGNING AROUND THE GAPS`
- `title`, `dek`, `reading-time`, prose = from `part-4.md`
- `viz-title` = `The Friction Spectrum`
- `viz-caption` = `Calibrated permeability — drag through the four zones, click to focus.`
- `prev-href` = `/articles/what-ai-cant-see/`, `prev-part` = `PART 3`, `prev-title`/`prev-dek` = from `part-3.md`
- `next-href` = `/articles/cost-of-speed/`, `next-part` = `PART 5`, `next-title`/`next-dek` = from `part-5.md`

Markdown-to-HTML rules: same as Task 13 Step 2.

- [ ] **Step 3: Validate**

Run: `python3 -c "from html.parser import HTMLParser; HTMLParser().feed(open('articles/designing-around-gaps/index.html').read()); print('OK')"`
Expected: `OK`.

- [ ] **Step 4: Browser-verify**

Open: `http://localhost:8080/articles/designing-around-gaps/`
Expected: article + friction-spectrum embed (membrane permeability scene), prev → Part 3, next → Part 5.

- [ ] **Step 5: Commit**

```bash
git add articles/designing-around-gaps/index.html
git commit -m "feat(articles): add Part 4 — Designing Around the Gaps"
```

---

### Task 17: Build `articles/cost-of-speed/index.html` (Part 5)

**Files:**
- Create: `articles/cost-of-speed/index.html`
- Read: `docs/superpowers/specs/extracted/part-5.md`
- Read: `docs/superpowers/specs/extracted/part-4.md` (prev)

- [ ] **Step 1: Create the article directory**

Run: `mkdir -p articles/cost-of-speed`

- [ ] **Step 2: Compose the article HTML from Reference A**

Fill Reference A's slots:
- `n` = `5`
- `slug` = `cost-of-speed`
- `viz-folder` = `cost-of-speed`
- `eyebrow-tag` = `THE COST OF SPEED`
- `title`, `dek`, `reading-time`, prose = from `part-5.md`
- `viz-title` = `The Cost of Speed`
- `viz-caption` = `Stewart Brand's pace layers — drag to rotate, hover any layer.`
- `prev-href` = `/articles/designing-around-gaps/`, `prev-part` = `PART 4`, `prev-title`/`prev-dek` = from `part-4.md`
- `next-href` = `/#series`, `next-eyebrow` = `BACK TO THE SERIES`, `next-part` = (empty), `next-title` = `All five parts`, `next-dek` = `Return to the series overview.`

Markdown-to-HTML rules: same as Task 13 Step 2.

- [ ] **Step 3: Validate**

Run: `python3 -c "from html.parser import HTMLParser; HTMLParser().feed(open('articles/cost-of-speed/index.html').read()); print('OK')"`
Expected: `OK`.

- [ ] **Step 4: Browser-verify**

Open: `http://localhost:8080/articles/cost-of-speed/`
Expected: article + cost-of-speed embed (pace layers scene), prev → Part 4, next → Back to the series (`/#series`).

- [ ] **Step 5: Commit**

```bash
git add articles/cost-of-speed/index.html
git commit -m "feat(articles): add Part 5 — The Cost of Speed"
```

---

# WAVE 4 — QA / QC

Three QA passes run in parallel as separate subagents. The functional verification (Task 20) is the main thread's responsibility — it requires running the dev server and a browser session.

---

### Task 18: Code-quality QA pass

**Agent type:** `superpowers:code-reviewer`
**Scope:** every file created or modified across Tasks 6–17.

- [ ] **Step 1: List the changed-file inventory**

Run: `git diff --name-only $(git merge-base HEAD main)..HEAD`
Expected: roughly:
```
articles/before-you-automate/index.html
articles/cost-of-speed/index.html
articles/designing-around-gaps/index.html
articles/friction-reduction/index.html
articles/what-ai-cant-see/index.html
docs/superpowers/plans/2026-05-23-embedded-articles.md
docs/superpowers/specs/2026-05-23-embedded-articles-design.md
docs/superpowers/specs/extracted/part-1.md
docs/superpowers/specs/extracted/part-2.md
docs/superpowers/specs/extracted/part-3.md
docs/superpowers/specs/extracted/part-4.md
docs/superpowers/specs/extracted/part-5.md
index.html
shared/article.css
visualizations/collaboration-framework/index.html
visualizations/complementarity-view/index.html
visualizations/cost-of-speed/index.html
visualizations/four-rungs/index.html
visualizations/friction-spectrum/index.html
```

- [ ] **Step 2: Verify JS syntax on every viz main.js (untouched but smoke-check)**

Run:
```bash
for f in visualizations/*/main.js; do node --check "$f" && echo "OK: $f"; done
```
Expected: 4 lines `OK: ...` (collaboration-framework has no main.js).

- [ ] **Step 3: Verify HTML well-formedness on each new/modified HTML file**

Run:
```bash
for f in articles/*/index.html visualizations/*/index.html index.html; do
  python3 -c "from html.parser import HTMLParser; HTMLParser().feed(open('$f').read())" \
    && echo "OK: $f" || echo "FAIL: $f"
done
```
Expected: every file `OK`.

- [ ] **Step 4: Verify all internal article-side links resolve to real files**

Run:
```bash
grep -rohE 'href="(/?articles/[^"]+|/?visualizations/[^"]+|/?shared/[^"]+|/?#[^"]+)"' articles/ \
  | sort -u | while read line; do
    path=$(echo "$line" | sed -nE 's/href="(\/?)([^"#?]*)(.*)?"/\2/p')
    [ -z "$path" ] && continue
    if [ -f "$path" ] || [ -d "$path" ] || [ -f "${path}index.html" ]; then
      echo "OK: $path"
    else
      echo "FAIL: $path"
    fi
  done
```
Expected: no `FAIL:` lines.

- [ ] **Step 5: Confirm no leftover TODO/FIXME/placeholder strings in shipped code**

Run:
```bash
grep -rnE '(TODO|FIXME|XXX|\{\{[a-z-]+\}\})' articles/ shared/article.css index.html visualizations/*/index.html
```
Expected: no output (`{{slot}}` templates must all be filled in articles).

- [ ] **Step 6: Confirm Three.js + GSAP CDN versions remain pinned**

Run:
```bash
grep -rhE '(three\.min\.js|OrbitControls\.js|gsap\.min\.js)' visualizations/ index.html | sort -u
```
Expected: only `r128` for three.js, only `0.128.0` for OrbitControls, only `3.12.2` for GSAP. Any other version is a regression.

- [ ] **Step 7: Confirm git working tree is clean except for intended files**

Run: `git status`
Expected: empty (all changes already committed by their tasks).

- [ ] **Step 8: Write QA report**

Save findings to `docs/superpowers/specs/extracted/qa-code.md` listing all `FAIL:` results, regressions, or other issues. If clean: write `All code-QA checks pass.` and commit:
```bash
git add docs/superpowers/specs/extracted/qa-code.md
git commit -m "docs: code-quality QA report — all checks pass"
```

---

### Task 19: UI / front-end design QA pass

**Agent type:** `claude` (or any general-purpose) with browser MCP access to capture screenshots.
**Scope:** every article page + landing + every standalone viz, on desktop and mobile viewport sizes.

- [ ] **Step 1: Start the dev server if not running**

Run: `lsof -i :8080 | grep LISTEN` — if no output, run `python3 -m http.server 8080` in the background.

- [ ] **Step 2: Capture desktop screenshots of each article**

Using the Chrome plugin (`mcp__claude-in-chrome__*`):
1. Resize window to 1440×900: `mcp__claude-in-chrome__resize_window`
2. Navigate to each article and capture full-page screenshot:
   - `http://localhost:8080/articles/friction-reduction/`
   - `http://localhost:8080/articles/before-you-automate/`
   - `http://localhost:8080/articles/what-ai-cant-see/`
   - `http://localhost:8080/articles/designing-around-gaps/`
   - `http://localhost:8080/articles/cost-of-speed/`

- [ ] **Step 3: Verify typography per QA checklist**

For each screenshot, confirm visually:
- Title is Cormorant Garamond (serif, not sans-serif fallback)
- Body prose is IBM Plex Sans (sans-serif)
- Section headings (`<h2>`, `<h3>`) are Cormorant Garamond
- Blockquotes are italic Cormorant Garamond with warm-amber left border
- Stat callouts (if present) have large Cormorant Garamond number in amber

- [ ] **Step 4: Verify layout per QA checklist**

For each article:
- Prose column ~680 px wide, centered
- Embed breaks out to ~960 px wide, centered
- Embed is 16:9 aspect ratio
- Embed has visible thin border + drop shadow
- Fullscreen `⛶` icon visible top-right of embed, ~36×36 px
- Embed caption beneath in italic muted text
- Prev/next nav cards span ~1100 px max-width, 50/50 split

- [ ] **Step 5: Verify hover/interactive states**

For each article:
- Hover the wordmark in the header → confirm opacity transition
- Hover the fullscreen `⛶` button → confirm scale/color transition
- Hover prev/next cards → confirm lift + background brighten
- Scroll embed into view → confirm "drag · scroll · click" hint fades in then out after 4 s
- Drag inside embed → confirm rotation works, article does not scroll

- [ ] **Step 6: Capture and verify mobile screenshots**

Resize window to 390×844 (iPhone 14 Pro size). Re-navigate each article. Verify:
- No horizontal scroll
- Title 2.25 rem (smaller)
- Embed fills viewport width (no horizontal margins on the embed itself)
- Prev/next stack vertically
- Header wordmark visible, meta visible
- Body prose readable

- [ ] **Step 7: Verify landing-page regression**

Navigate to `http://localhost:8080/`. Confirm:
- God rays, starfield, hero text, bento cards all render identically to pre-change state
- Hover each Part card → preview backgrounds animate
- Click each Part card → navigates to `/articles/<slug>/` (not `/visualizations/<name>/`)

- [ ] **Step 8: Verify standalone-viz regression**

Navigate directly to each viz at `http://localhost:8080/visualizations/<name>/` (no `?embed=1`). Confirm:
- Header / quote / legend / controls hint / audio button all VISIBLE
- Scene renders identically
- All interactions work as before

- [ ] **Step 9: Write UI QA report**

Save findings to `docs/superpowers/specs/extracted/qa-ui.md` listing any visual regressions, broken hover states, typography fallbacks, layout issues. If clean: `All UI-QA checks pass.` Commit:
```bash
git add docs/superpowers/specs/extracted/qa-ui.md
git commit -m "docs: UI/design QA report"
```

---

### Task 20: Functional end-to-end verification

**Agent type:** main thread (not delegated — requires reading screenshots and reasoning across the full flow).
**Scope:** full reader journey from landing → article → embed → fullscreen → back → prev/next.

- [ ] **Step 1: Confirm dev server is running**

Run: `lsof -i :8080 | grep LISTEN`
Expected: a Python process listening. If not, start `python3 -m http.server 8080`.

- [ ] **Step 2: End-to-end flow walkthrough (use Chrome plugin)**

For each of the 5 articles, in series order:

1. Navigate to `http://localhost:8080/`
2. Click the Part N card
3. Confirm article loads with correct title
4. Scroll until embed is in view → confirm iframe loads, scene initializes
5. Read the "drag · scroll · click" hint appears then fades after 4 s
6. Drag inside the embed → confirm 3D rotation, article does not scroll
7. Click the `⛶` fullscreen button → confirm navigation to `/visualizations/<name>/?from=<slug>`
8. Confirm standalone has all chrome visible (header, legend, etc.) and full interactivity
9. Press browser back → confirm article restores at the exact scroll position
10. Scroll to footer → click "Next" card → confirm correct neighbour article loads
11. At Part 1, confirm "Back to the series" links to `/#series`
12. At Part 5, confirm "Back to the series" links to `/#series`

- [ ] **Step 3: Cross-browser sanity (optional but encouraged)**

If time allows, repeat Step 2 in a second browser (Safari if Chrome was used, or vice versa). Confirm scroll-restoration on back-navigation works.

- [ ] **Step 4: Confirm no console errors across the journey**

In Chrome DevTools Console, navigate the full series and confirm no red errors. `mcp__claude-in-chrome__read_console_messages` can extract these.

- [ ] **Step 5: Write functional QA report**

Save findings to `docs/superpowers/specs/extracted/qa-functional.md`. If clean: `All functional verification checks pass.` Commit:
```bash
git add docs/superpowers/specs/extracted/qa-functional.md
git commit -m "docs: functional E2E QA report"
```

- [ ] **Step 6: Report to user**

Print summary to the user listing:
- Server URL: `http://localhost:8080/`
- All 5 article URLs
- Any issues from the three QA reports
- Confirmation that the flow works end-to-end

---

## Self-Review

### Spec coverage
Cross-checking against `docs/superpowers/specs/2026-05-23-embedded-articles-design.md`:
- §2 success criteria → covered by Wave 3 + Wave 4 functional verification.
- §3 architecture → Wave 2 (CSS) + Wave 3 (article files).
- §4 series mapping → Reference A endpoint rules + Tasks 13–17.
- §5 page structure → Task 6 (article.css) + Reference A template.
- §6 embed contract → Tasks 7–11 + Reference A (the article-side fullscreen handler + scroll restore).
- §7 insertion points → Wave 1 outputs identify insertion points; Wave 3 splits prose.
- §8 landing changes → Task 12.
- §9 content extraction → Wave 1 (Tasks 1–5).
- §10 phasing → matches plan waves exactly.
- §11 QA matrix → Tasks 18 (code), 19 (UI), 20 (functional).
- §12 non-goals → respected; no router, no TOC, no progress bar, no multiple embeds per article.
- §14 file inventory → matches plan file structure.

### Placeholder scan
- Reference A uses `{{slot}}` placeholders — these are intentional template markers, all filled in Wave 3 tasks. Task 18 Step 5 explicitly greps for leftover `{{...}}` to ensure none ship.
- No `TBD`, no `TODO`, no "implement later" in any task step.
- Every code/CSS/HTML step contains the actual content the implementer writes.

### Type/signature consistency
- `embed-fullscreen-btn` class used consistently across Reference A, article.css (Task 6), and the article-side JS handler.
- `data-target` / `data-from` attributes used consistently.
- `sessionStorage` key format `'scroll:' + location.pathname` used consistently in both the writer (fullscreen click) and the reader (`pageshow` handler).
- `?embed=1` and `?from=<slug>` query-param names used consistently across spec, Reference A, Reference B, viz patches, and the article-side handlers.
- Slug names match across the series table, the per-article tables, the landing repoints (Task 12), and the article files (Tasks 13–17): `friction-reduction`, `before-you-automate`, `what-ai-cant-see`, `designing-around-gaps`, `cost-of-speed`.

No issues found.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-23-embedded-articles.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — A fresh subagent per task, two-stage review between tasks, fast iteration. Best for this plan because Waves 1 and 3 are explicitly designed for parallel subagent dispatch and the QA tracks in Wave 4 are explicitly intended as separate review passes.

**2. Inline Execution** — Execute all tasks in this session via the executing-plans skill, with batched checkpoints. Less parallelism, single conversation context.

**Which approach?**
