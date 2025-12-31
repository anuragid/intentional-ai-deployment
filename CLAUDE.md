# Claude Instructions

## PARAMOUNT QUALITY STANDARD

**This project aims to be awe-inspiring, groundbreaking, world-changing.** Every output must meet this bar. Never settle for "functional" — every visualization must evoke wonder, invite exploration, and demonstrate mastery.

If what you're building isn't remarkable, stop and redesign.

## First Step for Every Session

1. **Read `PROJECT_STATUS.md`** — Complete context, tech stack, current status
2. **Read `.claude/QUALITY_STANDARDS.md`** — Non-negotiables for consistency
3. **Understand the CONCEPT before implementing** — Read article content, understand metaphors

## Before Building Any Visualization

### Conceptual Understanding (MANDATORY)
1. What is the core idea being visualized?
2. What metaphor communicates this idea?
3. How does the visual make the abstract tangible?
4. What should the user FEEL when interacting?

**Never start coding until you can articulate these.**

## Critical Technical Constraints

1. **Three.js r128** — LOCKED. OrbitControls requires this version.
2. **Full 3D Interactivity** — Every visualization needs:
   - OrbitControls (drag to rotate, scroll to zoom, right-drag to pan)
   - Click interactions (focus, details)
   - Hover feedback
3. **No Tiny Canvases** — Full-screen immersive experiences, not grids of thumbnails
4. **No Build Tools** — Direct CDN script loading
5. **Three Contexts** — Must work: standalone, embedded, presentation

## Aesthetic Mandate

- **"Quiet awe like stargazing"** — contemplative, not flashy
- **Invite exploration** — users should WANT to interact
- **Visual metaphors must be precise** — every element has meaning
- **Consistency** — same fonts, colors, UI patterns across all visualizations

## The Friction Spectrum Concepts (Part 4)

> "Calibrated friction: seams matched to stakes"

- **Seamless**: Zero friction. AI output indistinguishable from human. Information flows freely.
- **Visible**: AI's contribution is VISIBLE. You can see/discern what AI did. "Beautiful seams."
- **Gated**: Human-in-the-loop. Flow PAUSES for human approval before continuing.
- **Human-Only**: Human is fully in control. Not just approving — deciding.

This is about the FLOW of information and WHERE human oversight enters.

## Local Development

```bash
python3 -m http.server 8080
# Visit: http://localhost:8080/
```

**Always use port 8080.**

## Before Every Commit

1. Validate JS: `node --check main.js`
2. Test in browser
3. Ask: "Is this awe-inspiring?" If not, iterate.
