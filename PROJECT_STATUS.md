# Project Status: Interactive Data Visualizations

> **Last Updated:** December 29, 2025
> **Current Focus:** Four Rungs visualization complete, cross-visualization consistency

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
intentional-ai-deployment/
├── index.html                    # Landing page (observatory aesthetic with god rays)
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
│   ├── complementarity-view/     # Part 3: What AI Can't See (FUNCTIONAL)
│   │   ├── index.html            # HTML shell with embedded CSS
│   │   ├── main.js               # Three.js visualization logic
│   │   └── styles.css            # Additional styles
│   │
│   └── four-rungs/               # Part 2: Before You Automate (FUNCTIONAL)
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

## Landing Page

**Status:** Complete with WebGL god rays effect
**Location:** `index.html` (root)

### Design Approach
- **Aesthetic:** Observatory/exploratory — like stepping into a planetarium
- **Entry Point:** Works for both article readers and direct discovery
- **Navigation:** Recommended journey order, but flexible exploration allowed

### Features
- **Starfield Background:** Canvas-based multi-layer parallax with shooting stars
- **God Rays Effect:** WebGL shader-based volumetric light shafts (Three.js)
- **Atmospheric Overlay:** Subtle colored gradients for depth
- **Cursor Glow:** Mouse-follow ambient light effect
- **Depth Fog:** Appears when scrolled past hero section
- **Hero Section:** "We Are Choosing By Not Choosing" with staggered reveal
- **Thesis Section:** Ken Holstein quote + Streetlight Effect explanation
- **Series Cards:** Bento grid layout with animated preview backgrounds
- **Voices Section:** Expert quotes in card grid
- **Scroll Reveals:** IntersectionObserver-based animations

### God Rays Component (WebGL Shader)

The god rays are implemented using Three.js WebGL with a custom fragment shader (lines 1388-1616 in `index.html`).

#### Controllable Uniforms

| Property | Current Value | Purpose |
|----------|---------------|---------|
| `u_colorBack` | `(0.02, 0.02, 0.027, 0.0)` | Background color (RGBA) |
| `u_color1` | `(0.984, 0.749, 0.141, 0.35)` | Primary ray color (amber) |
| `u_color2` | `(0.961, 0.620, 0.043, 0.25)` | Secondary ray color (deep amber) |
| `u_color3` | `(1.0, 0.85, 0.4, 0.18)` | Tertiary ray color (light gold) |
| `u_offsetX` | `0.0` | Horizontal light source position |
| `u_offsetY` | `-1.0` | Vertical light source position (top of viewport) |
| `u_frequency` | `0.75` | Number of rays (reduced from 1.5) |
| `u_spotty` | `0.5` | Ray irregularity |
| `u_midSize` | `0.5` | Central glow size |
| `u_midIntensity` | `0.16` | Central glow brightness (reduced from 0.8) |
| `u_density` | `0.35` | Ray density/thickness (reduced from 0.7) |
| `u_bloom` | `0.9` | Glow blending (0=normal, 1=additive) |
| `u_speed` | `0.7` | Animation speed (increased from 0.5) |

#### Distance Fade (in fragment shader)
```glsl
// Line 1577 - controls how far rays extend
float distanceFade = 1.0 - smoothstep(0.0, 20.0, radius);  // Extended from 5.0 to 20.0
```

#### Recent Adjustments (Dec 20, 2025)
- Reduced ray frequency by 50% (1.5 → 0.75)
- Reduced ray density by 50% (0.7 → 0.35)
- Reduced central glow brightness by 80% (0.8 → 0.16)
- Increased animation speed (0.5 → 0.7)
- Extended distance fade to maximum (5.0 → 20.0)

### Typography (Consistent Across All Pages)
- **Display:** Cormorant Garamond (elegant serif)
- **Body:** IBM Plex Sans (clean, professional)

### Color Palette
```css
--color-void: #050507;           /* Deep space background */
--color-text: #f4f3f1;           /* Warm white text */
--color-accent-warm: #fbbf24;    /* Amber highlights */
--color-accent-ai: #22d3ee;      /* Cyan for AI */
--color-accent-human: #34d399;   /* Green for human */
```

---

## Visualizations

### 1. Complementarity View (FULLY ENHANCED)

**Status:** Complete with 24+ interactive features
**Location:** `visualizations/complementarity-view/`
**Article Part:** Part 3

#### Concept
Illustrates the "streetlight effect" — what AI can observe vs. the vast domain of human tacit knowledge that remains invisible to models.

#### Visual Metaphor
An **isometric 3D street scene**:
- **Street lamp** casts a cone of cool LED blue/white light = AI's observable domain
- **AI figure** (cyan, geometric) stands in the light = AI working within its context window
- **Human figure** (green, organic) stands at the boundary = Human accessing broader knowledge
- **Green perception circle** on ground = Human's perception area (overlaps ~20% with AI's light)
- **8 Unobservable orbs** (amber) float in human's area = Tacit knowledge AI cannot see

**Color Separation:** LED blue/white for AI's observable domain, amber for unobservables (distinct, no conflict)

#### The 8 Unobservables
Each orb has unique visual identity with orbiting/external elements for distinctiveness:

1. **Intuition** (◎) — Irregular pulsing + 3 erratic spark particles orbiting
2. **Physical Presence** (◈) — Lower float, slow breathing + 5 gravity particles falling around
3. **Reading the Room** (◇) — Scanning ring that flows smoothly around the orb's surface (top to bottom loop)
4. **Relationship Capital** (∞) — Dual infinity rings + 2 bond particles traveling along paths
5. **Institutional Memory** (⌘) — 3 nested wireframe spheres with pulsing opacity
6. **Contextual Meaning** (⟡) — Amber-only color shift (no red) + 3 orbiting context particles
7. **Timing & Rhythm** (◐) — Clock hand with discrete steps + 4 orbiting hour markers
8. **What's Not Said** (○) — Asymmetric fade cycle + 4 ghost wisps drifting outward

**Animation Principles:** All animations are continuous, smooth, and cyclic with NO visible resets

#### Technical Implementation
- **Scene setup:** Three.js with PerspectiveCamera, WebGLRenderer
- **Lighting:** AmbientLight + DirectionalLight + SpotLight (from lamp)
- **Controls:** OrbitControls with damping, zoom limits, ground clipping prevention
- **Labels:** HTML overlays projected to 3D positions via `Vector3.project(camera)`
- **Animation:** GSAP for intro, requestAnimationFrame for continuous animation
- **State Management:** Centralized StateManager for modes, focus, audio, idle time
- **Audio:** Web Audio API with ambient soundscape and spatial positioning

#### Interactive Features

**View Modes (Top Center Controls)**
- **Overview** — Balanced view showing both AI and human perspectives
- **See as AI** — Dims unobservables, brightens light cone, shows AI's limited view
- **See as Human** — Expands unobservables (1.2x), shows full perception domain
- All transitions go through dark phase first for consistent, contemplative feel

**Click-to-Focus System**
- Click any orb → Camera animates to focus position
- Detail panel appears with full description
- Connection line drawn from orb to human figure
- Other elements dim to draw attention
- ESC or click elsewhere to exit focus mode

**Hover Interactions**
- Orb hover → Tooltip with name and description
- Connection line appears linking orb to human figure
- Subtle hover sound effect (when audio enabled)

**Audio System (Bottom Right)**
- Toggle button for ambient soundscape
- Night ambiance with subtle environmental audio
- Hover and focus sound effects
- Default OFF (respects browser autoplay policy)

**Visual Atmosphere**
- Dust particles drifting downward in light beam (50 particles, from lamp to ground)
- Human figure heartbeat glow (emissive intensity pulse ~1Hz)
- Human figure breathing animation (subtle Y-scale oscillation)
- Constellation lines visible when zoomed out
- Proximity-based orb glow (brighter when camera is close)
- Auto-orbit idle mode after 30s inactivity

**Keyboard Navigation**
- Arrow keys cycle through orbs
- 1-3 for preset camera views
- ESC exits focus mode

#### UI Layout
- **Top Center:** View mode controls (Overview / See as AI / See as Human) in pill-shaped container
- **Bottom Left:** Legend (vertical orientation) with color-coded elements
- **Bottom Center:** PTZ instructions (floating text, no container)
- **Bottom Right:** Audio toggle

#### Known Issues / Future Work
- Responsive adjustments for smaller viewports
- Touch support for mobile (partially implemented)
- Consider cinematic intro option via URL parameter

---

### 2. The Four Rungs (FULLY FUNCTIONAL)

**Status:** Complete with interactive view modes
**Location:** `visualizations/four-rungs/`
**Article Part:** Part 2

#### Concept
The Problem Abstraction Ladder — shows why 84% of AI projects fail due to "rung-skipping" (starting at Method/Execution without defining Outcome/Approach).

#### Visual Metaphor
**Four stacked platforms** connected by a central conduit beam:
- **Human Territory (Top, Warm Colors)**
  - **Outcome** — "What does success look like?"
  - **Approach** — "How will you create differentiated value?"
- **Judgment Boundary (Middle)** — Rotating fog layer separating territories
- **AI Territory (Bottom, Cool Colors)**
  - **Method** — "What capabilities will we deploy?"
  - **Execution** — "How will we implement day-to-day?"

#### Color Palette
```javascript
outcome: 0xe8c496      // Soft gold (Human)
approach: 0xd4b07a     // Warm amber (Human)
boundary: 0xe0d8c8     // Cream/neutral (Judgment Boundary)
method: 0x7a9cb8       // Steel blue (AI)
execution: 0x6889a0    // Slate blue (AI)
warning: 0xd4756a      // Dusty rose (84% stat)
```

#### Interactive Features
- **View Modes:** "Recommended" (particles flow down) vs "Current" (particles flow up)
- **Click-to-Focus:** Click any rung to see detail panel with description
- **84% Statistic:** Shows in "Current" view mode (RAND Corporation, 2024)
- **Judgment Boundary:** Rotating fog layer with shader-based noise
- **Navigation:** Previous/Next buttons in detail panel

#### Key Implementation Details
- Platforms are hexagonal with glow effects
- Central beam with gradient (warm top → cool bottom)
- Particles flow based on view mode direction
- Fog uses rotating FBM noise shader

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

### Typography (Unified Dec 29, 2025)
- **All Pages:** Cormorant Garamond (display) + IBM Plex Sans (body)
- This applies to: Landing page, Complementarity View, Four Rungs, Design System
- **Never deviate** — see `.claude/QUALITY_STANDARDS.md` for non-negotiables

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

## Narration (audiobook v3)

Per-article narration is built by the offline CLI in `tools/audio/` (ElevenLabs `eleven_v3` TTS → Forced Alignment → karaoke `narration.json`). It is never run in the browser.

**Expressiveness comes from committed transcripts — no recurring LLM cost.** Each article has a hand-authored "enhanced transcript" at `tools/audio/narration/<slug>.json` (`{ slug, blocks: [{ index, clean, enhanced }] }`). The `enhanced` text adds sparse, contemplative delivery cues — ellipses (`…`) for breath, light caps emphasis, and the occasional v3 audio tag (`[exhales]`, `[thoughtful]`) — that v3 renders. `build-audio.mjs` loads these via `lib/enhance.js` (`loadEnhanced`); there is no build-time API call for tagging (the old Anthropic `tag.js` step was retired).

**Karaoke stays in sync** because the director may only add tags/punctuation/caps, never change a spoken word. `lib/enhance.js` enforces a **word-sequence invariant** (`sameWords`): `narration/narration-artifacts.test.js` checks every committed transcript against live article extraction, so a desynced build cannot be committed. Alignment still runs against the **clean** text, so the highlight tracks the live DOM exactly.

**Voice settings:** v3 uses `stability: 0.5` ("Natural" — responsive to cues without high-stability flatness); `speed`/`style` are dropped (v3 paces via tags/punctuation).

**Operator note:** `ELEVENLABS_NARRATION_VOICE_ID` is the single biggest v3 lever — it must point at an expressive IVC or designed voice, not a PVC or a flat voice. To re-author cues: edit the `enhanced` fields and keep `node --test` green. To scaffold a new article's transcript: `node tools/audio/scaffold-narration.mjs <slug>`.

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

### For Landing Page

1. **`index.html`** (root)
   - All CSS is embedded in `<style>` tags (lines 15-1094)
   - Starfield canvas animation (lines 1619-1770)
   - God rays WebGL shader (lines 1388-1616)
   - Cursor glow effect (lines 1772-1797)
   - Depth fog management (lines 1799-1821)
   - Scroll reveal animations (lines 1823-1846)
   - Part card preview animations with CSS `@property` (lines 535-675)

### For Complementarity View

1. **`visualizations/complementarity-view/main.js`**

   **Core Setup**
   - `init()` — Scene setup, camera, renderer, controls
   - `createStreetLamp()` + `createLightCone()` — Lamp and light cone
   - `createAIFigure()` / `createHumanFigure()` — The two figures
   - `createUnobservables()` — The 8 amber orbs with unique visual identities
   - `createSceneLabels()` — "Observable Data" / "The Unobservable" labels

   **State & Interaction**
   - `StateManager` — Centralized state object (viewMode, focusedOrb, audioEnabled, idleTime)
   - `focusOnOrb()` / `exitFocus()` — Click-to-focus system
   - `applyViewMode()` — Handle view transitions (Overview/AI/Human) with dark phase
   - `createConnectionLine()` / `removeConnectionLine()` / `updateConnectionLine()` — Orb-to-human links

   **Visual Effects**
   - `createDustParticles()` — 50 particles drifting downward from lamp
   - `ORB_EFFECTS` — Per-orb unique animations (sparks, gravity particles, wisps, rings, etc.)
   - `updateProximityGlow()` — Orbs glow brighter when camera is close
   - `updateConstellationLines()` — Lines between orbs visible when zoomed out

   **Audio**
   - `AudioManager` — Web Audio API wrapper
   - `createAmbientSoundscape()` — Multi-layer ambient pad with drone, harmonics, noise
   - `playHoverSound()` / `playFocusSound()` — Interaction feedback
   - `toggleAmbient()` — Audio on/off toggle

   **Animation & Camera**
   - `animate()` — Main render loop with all visual updates
   - `playIntro()` — GSAP camera animation on load
   - `revealUnobservables()` — Staggered orb reveal animation
   - `updateLabels()` — Projects all labels to screen coordinates
   - Auto-orbit after 30s idle

2. **`visualizations/complementarity-view/index.html`**
   - All CSS is embedded in `<style>` tags
   - CDN script imports for Three.js, OrbitControls, GSAP
   - HTML structure for labels, tooltip, legend, controls hint
   - View mode buttons (top center)
   - Audio toggle (bottom right)
   - Detail panel for focused orb

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
lampLight: 0xf0f6ff  // Cool white LED (slight blue tint)
lampGlow: 0xd8e8ff   // LED blue/white glow
ai: 0x22d3ee         // Cyan AI figure
human: 0x34d399      // Green human figure
unobservable: 0xf59e0b // Amber unobservables (distinct from lamp)
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

### Current State (as of Dec 29, 2025)
- **Landing Page:** Complete with WebGL god rays effect
  - Starfield with multi-layer parallax and shooting stars
  - God rays shader (tuned: fewer rays, less dense, dimmer center, faster, extended reach)
  - Bento grid series cards with animated backgrounds
  - Part 2 card now links to Four Rungs visualization
  - **Typography:** Cormorant Garamond + IBM Plex Sans

- **Complementarity View (Part 3):** Fully enhanced with 24+ features including:
  - Three view modes (Overview, See as AI, See as Human) with consistent dark transitions
  - Click-to-focus on orbs with detail panel and connection lines
  - Audio system (ambient soundscape, hover/focus sounds)
  - Visual effects (50 dust particles flowing downward, human breathing/heartbeat)
  - Each orb has unique orbiting/external elements (sparks, gravity particles, wisps, etc.)
  - LED blue/white light for AI domain (distinct from amber unobservables)
  - **Typography:** Cormorant Garamond + IBM Plex Sans
  - All animations are smooth and cyclic (no jerky resets)
  - Auto-orbit idle mode, keyboard navigation, constellation lines
  - View controls: consistent styling with Four Rungs (border-radius: 8px, etc.)

- **Four Rungs (Part 2):** Complete with interactive view modes
  - Two view modes: "Recommended" (down flow) and "Current" (up flow)
  - 84% statistic with RAND Corporation citation
  - Click-to-focus on rungs with detail panel
  - Judgment Boundary with rotating fog shader
  - Central conduit beam with gradient
  - Particle system flowing based on view mode
  - **Typography:** Cormorant Garamond + IBM Plex Sans

- **Cross-Visualization Consistency (Dec 29):**
  - Unified typography across all pages
  - Matching view control styles (8px border-radius, same padding/fonts)
  - Consistent insight overlay positioning
  - Quality standards documented in `.claude/QUALITY_STANDARDS.md`

- **Other Visualizations:** Planned but not started

### Key Design Decisions Made
1. **Landing Page Aesthetic:** Observatory/exploratory feel (like a planetarium)
2. **Typography:** Cormorant Garamond (display) + IBM Plex Sans (body) — UNIFIED across all pages
3. **Three.js Version:** Locked to r128 for OrbitControls compatibility
4. **No Build Tools:** Direct CDN loading for simplicity
5. **View Transitions:** All mode changes go through dark phase first for consistency
6. **Audio Default:** Off by default, user must click to enable
7. **UI Layout:** View controls top center (8px radius), legend bottom left, audio bottom right
8. **God Rays:** WebGL shader implementation for performance and quality
9. **Color Separation:** LED blue/white for AI's observable domain, amber for unobservables (no color conflict)
10. **Animation Quality:** All animations must be continuous, smooth, cyclic — no visible resets or jerky movements
11. **Cross-Visualization Consistency:** Same fonts, same tab styling, same positioning patterns

### Files to Review for Context
1. `PROJECT_STATUS.md` — This file (start here)
2. `index.html` — Landing page with god rays
3. `visualizations/complementarity-view/main.js` — Full visualization logic with all features
4. `visualizations/complementarity-view/index.html` — HTML structure and CSS
5. `shared/design-system.css` — Design tokens for future use

---

## Contact & Attribution

- **Project:** Independent Study, Semester 4
- **Article Series:** "We Are Choosing By Not Choosing"
- **Ken Holstein Quote:** Used with attribution in header
