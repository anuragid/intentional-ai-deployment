# Claude Instructions

## First Step for Every Session

**Read `PROJECT_STATUS.md` before doing anything else.** It contains:
- Complete project context and purpose
- Technology stack with version constraints (Three.js r128 is critical)
- Current status of all visualizations
- Do's and Don'ts
- File structure and key code locations

## Quick Context

This project creates interactive visualizations for a 5-part article series on Human-AI collaboration. The current focus is **The Complementarity View** — an isometric 3D scene showing AI's observable domain (street lamp light) vs human tacit knowledge (darkness with glowing orbs).

## Critical Constraints

1. **Three.js version MUST stay at r128** — OrbitControls requires this
2. **No build tools** — Use CDN script tags directly
3. **Visualizations must work in 3 contexts:** standalone, embedded, presentation
4. **Aesthetic: contemplative, not flashy** — "Quiet awe like stargazing"

## Key Files

- `visualizations/complementarity-view/main.js` — All visualization logic
- `visualizations/complementarity-view/index.html` — HTML + embedded CSS
- `shared/design-system.css` — Design tokens (for future visualizations)

## Local Development

```bash
python3 -m http.server 8000
# Visit: http://localhost:8000/visualizations/complementarity-view/
```

## Before Editing

1. Read the relevant file first
2. Validate JS: `node --check main.js`
3. Test in browser after changes
4. Commit meaningful changes with descriptive messages
