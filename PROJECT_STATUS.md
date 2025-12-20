# Project Status: Interactive Data Visualizations

> **Last Updated:** December 20, 2025
> **Current Focus:** Landing page complete, Complementarity View functional

---

## Quick Start

```bash
# Start server (use port 8080)
python3 -m http.server 8080

# View landing page
open http://localhost:8080/

# View Complementarity View directly
open http://localhost:8080/visualizations/complementarity-view/
```

---

## Project Overview

This is an **Independent Study project** creating interactive data visualizations for the article series **"We Are Choosing By Not Choosing: The Default Path of AI Automation"** — a five-part series on intentional AI deployment.

### Purpose
Create compelling, interactive visualizations that help readers understand complex concepts about human-AI collaboration, model limitations, and organizational decision-making around AI automation.

### Target Contexts
Each visualization must work in **three contexts**:
1. **Immersive/Standalone** — Full-screen experience with maximum visual impact
2. **Embeddable Cards** — Smaller embedded format within articles
3. **Presentation** — Viewable from distance, high contrast, larger text

---

## Project Structure

```
interactive-data-viz/
├── index.html                    # Landing page (observatory aesthetic)
├── package.json                  # Dependencies (shadcn for dev)
├── PROJECT_STATUS.md             # This file
├── CLAUDE.md                     # Instructions for Claude
│
├── shared/                       # Shared assets across all visualizations
│   ├── design-system.css         # Comprehensive design system (ShadCN-inspired)
│   ├── styles/base.css           # Base styles for gallery
│   ├── utils/
│   │   ├── animation.js          # Animation utilities
│   │   └── webgl-utils.js        # WebGL helpers
│   └── components/
│       └── tooltip.js            # Shared tooltip component
│
├── visualizations/
│   └── complementarity-view/     # The Complementarity View (FUNCTIONAL)
│       ├── index.html            # HTML shell with embedded CSS
│       └── main.js               # Three.js visualization logic
│
├── embed/
│   └── loader.js                 # Embed loader for articles
│
└── .claude/                      # Claude skills, settings, and plans
    ├── plans/                    # Implementation plans
    ├── commands/                 # Custom slash commands
    └── settings.local.json       # Local settings
```

---

## Technology Stack

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Three.js** | r128 | 3D rendering, scene management, WebGL abstraction |
| **GSAP** | 3.12.2 | Animation, timelines, smooth transitions |
| **OrbitControls** | r128 | Camera pan/tilt/zoom functionality |
| **Vanilla JS** | ES6+ | No frameworks, pure JavaScript |
| **CSS Custom Properties** | — | Design tokens, theming |

### Why These Choices

- **Three.js r128** (not latest): Required for stable global `OrbitControls` support. Later versions deprecated `examples/js/` in favor of ES modules, which breaks CDN loading.
- **No build tools**: Visualizations load directly via CDN `<script>` tags for simplicity and portability.
- **Vanilla JS**: Keeps bundle size minimal, no framework overhead.
- **CSS-in-HTML**: Styles are embedded in `index.html` for self-contained visualizations.

### CDN URLs (Critical)
```html
<!-- Three.js r128 - DO NOT UPGRADE without testing OrbitControls -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>

<!-- GSAP -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
```

---

## Visualizations

### 1. Complementarity View (FUNCTIONAL)

**Status:** Functional, ready for refinement
**Location:** `visualizations/complementarity-view/`
**Article Part:** Part 3

#### Concept
Illustrates the "streetlight effect" — what AI can observe vs. the vast domain of human tacit knowledge that remains invisible to models.

#### Visual Metaphor
An **isometric 3D street scene**:
- **Street lamp** casts a cone of warm light = AI's observable domain
- **AI figure** (cyan, geometric) stands in the light = AI working within its context window
- **Human figure** (green, organic) stands at the boundary = Human accessing broader knowledge
- **Green perception circle** on ground = Human's perception area (overlaps ~20% with AI's light)
- **8 Unobservable orbs** (amber) float in human's area = Tacit knowledge AI cannot see

#### The 8 Unobservables
1. **Intuition** (◎) — Knowing something is wrong before you can articulate why
2. **Physical Presence** (◈) — The weight of a handshake, the tension in a room
3. **Reading the Room** (◇) — The collective mood, energy that shifts without anyone speaking
4. **Relationship Capital** (∞) — Trust built through years
5. **Institutional Memory** (⌘) — How things actually work, beyond the org chart
6. **Contextual Meaning** (⟡) — Understanding what "fine" really means
7. **Timing & Rhythm** (◐) — Knowing when to push and when to wait
8. **What's Not Said** (○) — The pause that speaks volumes

#### Technical Implementation
- **Scene setup:** Three.js with PerspectiveCamera, WebGLRenderer
- **Lighting:** AmbientLight + DirectionalLight + SpotLight (from lamp)
- **Controls:** OrbitControls with damping, zoom limits, ground clipping prevention
- **Labels:** HTML overlays projected to 3D positions via `Vector3.project(camera)`
- **Animation:** GSAP for intro, requestAnimationFrame for continuous animation

#### Current Features
- Isometric corner camera view
- Pan/tilt/zoom with mouse (drag, scroll, right-drag)
- Hover tooltips on unobservables
- Animated intro with camera zoom
- Legend with color-coded elements
- Scene labels that move with camera

#### Known Issues / Future Work
- Consider adding audio toggle (ambient soundscape)
- May need responsive adjustments for smaller viewports
- Touch support for mobile (partially implemented)

---

### 2. The Four Rungs (PLANNED)
**Article Part:** Part 2
**Concept:** Problem Abstraction Ladder — Human territory (Outcome, Approach) vs AI territory (Method, Execution)

### 3. The Friction Spectrum (PLANNED)
**Article Part:** Part 4
**Concept:** Seams matched to stakes — From seamless automation to human-only domains

### 4. Information Asymmetry Map (PLANNED)
**Article Part:** Part 3
**Concept:** 2x2 matrix — AI visibility × Human awareness

### 5. Human-AI Collaboration Framework (PLANNED)
**Article Part:** Part 4
**Concept:** Expertise × Consequence matrix

### 6. Organizational Pace Layers (PLANNED)
**Article Part:** Part 5
**Concept:** Stewart Brand's pace layers adapted for organizational cultural debt

---

## Landing Page

**Status:** Complete (first version)
**Location:** `index.html` (root)

### Design Approach
- **Aesthetic:** Observatory/exploratory — like stepping into a planetarium
- **Entry Point:** Works for both article readers and direct discovery
- **Navigation:** Recommended journey order, but flexible exploration allowed

### Features
- **Starfield Background:** Canvas-based twinkling animation
- **Hero Section:** "We Are Choosing By Not Choosing" with staggered reveal
- **Thesis Section:** Ken Holstein quote + Streetlight Effect explanation
- **Journey Section:** 6 chapter cards (1 ready, 5 coming soon)
- **Scroll Reveals:** IntersectionObserver-based animations

### Typography
- **Display:** Fraunces (elegant, variable font)
- **Body:** DM Sans (clean, geometric)

### Color Palette
```css
--color-void: #07070a;           /* Deep space background */
--color-text: #f4f3f1;           /* Warm white text */
--color-accent-warm: #fbbf24;    /* Amber highlights */
--color-accent-ai: #22d3ee;      /* Cyan for AI */
--color-accent-human: #34d399;   /* Green for human */
```

### Future Improvements
- Add preview thumbnails/animations for each visualization card
- Consider adding a subtle ambient sound toggle
- Responsive testing on various devices

---

## Design System

The project uses a comprehensive design system defined in `shared/design-system.css`.

### Color Palette (Dark Theme Default)

| Semantic | Variable | Hex | Usage |
|----------|----------|-----|-------|
| AI/Technology | `--accent-ai` | `#22d3ee` (cyan-400) | AI figures, observable domain labels |
| Human/Organic | `--accent-human` | `#34d399` (emerald-400) | Human figures, perception area |
| Unobservable | `--accent-unobservable` | `#fbbf24` (amber-400) | Unobservable orbs, warnings |
| Background | `--background` | `#0f0e0d` (neutral-950) | Canvas backgrounds |
| Foreground | `--foreground` | `#f0ede8` (neutral-100) | Primary text |
| Muted | `--foreground-muted` | `#a8a094` (neutral-400) | Secondary text, labels |

### Typography
- **Display:** Cormorant Garamond (elegant serif) — Headlines, quotes
- **Body:** Outfit (geometric sans-serif) — Labels, UI text
- **Visualization:** Playfair Display + Source Sans 3 (complementarity-view specific)

### Spacing & Sizing
Uses a consistent spacing scale: `--space-1` through `--space-24`

---

## Development Workflow

### Running Locally
```bash
# From project root (use port 8080)
python3 -m http.server 8080

# Then visit:
# http://localhost:8080/                                    # Landing page
# http://localhost:8080/visualizations/complementarity-view/ # Viz directly
```

### File Editing
1. Edit `main.js` for visualization logic
2. Edit `index.html` for HTML structure and embedded CSS
3. Refresh browser to see changes (no build step)

### Git Workflow
- Commit after meaningful changes
- Use conventional commit messages: `feat:`, `fix:`, `refactor:`

---

## Do's and Don'ts

### DO

1. **Keep CDN versions locked** — Three.js r128 and OrbitControls must match
2. **Use CSS custom properties** — Maintain consistency with design system
3. **Project labels to 3D** — All text labels should use `Vector3.project(camera)` for 3D positioning
4. **Test pan/tilt/zoom** — After any camera changes, verify OrbitControls still work
5. **Check fallbacks** — Wrap OrbitControls in `if (typeof THREE.OrbitControls !== 'undefined')`
6. **Keep materials compatible** — Use `MeshBasicMaterial` properties correctly (no `emissiveIntensity` on BasicMaterial)
7. **Validate JS syntax** — Run `node --check main.js` before committing
8. **Maintain the metaphor** — Visual elements must reinforce the conceptual story

### DON'T

1. **Don't upgrade Three.js** — r128 is specifically chosen for OrbitControls compatibility
2. **Don't use ES modules** — Stick to global `THREE` namespace for CDN loading
3. **Don't add build tools** — Keep it simple with direct script loading
4. **Don't break the 3-context requirement** — Visualizations must work standalone, embedded, and in presentations
5. **Don't use fixed positioning for scene labels** — They must move with the 3D camera
6. **Don't forget touch support** — Mobile users exist
7. **Don't overcomplicate animations** — Subtle, contemplative movements over flashy effects
8. **Don't ignore the emotional goal** — Should evoke "quiet awe," not technical impressiveness

---

## Key Files to Understand

### For Complementarity View

1. **`visualizations/complementarity-view/main.js`**
   - `init()` — Scene setup, camera, renderer, controls
   - `createStreetLamp()` + `createLightCone()` — Lamp and light cone
   - `createAIFigure()` / `createHumanFigure()` — The two figures
   - `createUnobservables()` — The 8 amber orbs
   - `createSceneLabels()` — "Observable Data" / "The Unobservable" labels
   - `updateLabels()` — Projects all labels to screen coordinates
   - `animate()` — Main render loop
   - `playIntro()` — GSAP camera animation on load

2. **`visualizations/complementarity-view/index.html`**
   - All CSS is embedded in `<style>` tags
   - CDN script imports for Three.js, OrbitControls, GSAP
   - HTML structure for labels, tooltip, legend, controls hint

3. **`shared/design-system.css`**
   - Complete design token definitions
   - Should be used for future visualizations
   - Note: Complementarity View uses its own inline styles currently

---

## Important Context

### The Core Message
> "Humans access information the model never had" — Ken Holstein

This quote drives the visualization. The metaphor is a **streetlight at night**:
- We (humans and AI) can only see clearly where the light falls
- But humans can perceive things in the darkness that AI fundamentally cannot
- It's not about AI being "bad" — it's about epistemic limitations

### Aesthetic Goals
- **Contemplative, not flashy** — Like stargazing
- **Quiet awe** — Not technical impressiveness
- **Minimal text** — Let the visualization speak
- **Warm vs cool colors** — Amber (human knowledge) vs cyan (AI/data)

---

## Quick Reference

### Common Operations

**Check JS syntax:**
```bash
node --check visualizations/complementarity-view/main.js
```

**Start local server:**
```bash
python3 -m http.server 8080
```

**View pages:**
```
http://localhost:8080/                                    # Landing page
http://localhost:8080/visualizations/complementarity-view/ # Complementarity View
```

### Color Hex Values (Complementarity View)
```javascript
bg: 0x08080c         // Dark background
lampGlow: 0xfbbf24   // Amber lamp light
ai: 0x22d3ee         // Cyan AI figure
human: 0x34d399      // Green human figure
unobservable: 0xf59e0b // Orange unobservables
```

### Camera Position
```javascript
camera.position.set(12, 12, 14);  // Isometric corner view
controls.target.set(2, 0, 0);     // Look at center of scene
```

---

## Session Continuity

When starting a new session, read this file first.

### Checklist for New Sessions
1. **Server running?** Check `http://localhost:8080`
2. **Git status?** Run `git status` to see uncommitted changes
3. **Recent work?** Run `git log --oneline -5` to see recent commits
4. **Plan file?** Check `.claude/plans/` for any active implementation plans

### Current State (as of Dec 20, 2025)
- **Landing Page:** Complete first version, ready for refinement
- **Complementarity View:** Functional with pan/tilt/zoom, hover tooltips, animated intro
- **Other Visualizations:** Planned but not started

### Key Design Decisions Made
1. **Landing Page Aesthetic:** Observatory/exploratory feel (like a planetarium)
2. **Typography:** Fraunces (display) + DM Sans (body) for landing; Playfair Display + Source Sans 3 for viz
3. **Three.js Version:** Locked to r128 for OrbitControls compatibility
4. **No Build Tools:** Direct CDN loading for simplicity

### Files to Review for Context
1. `PROJECT_STATUS.md` — This file (start here)
2. `index.html` — Landing page
3. `visualizations/complementarity-view/main.js` — Visualization logic
4. `.claude/plans/sharded-zooming-allen.md` — Complementarity View rebuild plan (may be outdated)

---

## Contact & Attribution

- **Project:** Independent Study, Semester 4
- **Article Series:** "We Are Choosing By Not Choosing"
- **Ken Holstein Quote:** Used with attribution in header
