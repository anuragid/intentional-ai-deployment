# Quality Standards & Non-Negotiables

> **Read this at the start of every session.** These standards ensure consistency and quality across all work.

---

## Visual Consistency (Cross-Visualization)

### Typography
- **Display Font:** Cormorant Garamond
- **Body Font:** IBM Plex Sans
- **Never deviate** from these fonts across any visualization or page

### Font Import (copy exactly)
```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans:wght@300;400;500&display=swap" rel="stylesheet">
```

### CSS Variables (must match across files)
```css
--font-display: 'Cormorant Garamond', Georgia, serif;
--font-body: 'IBM Plex Sans', -apple-system, sans-serif;
```

---

## UI Component Consistency

### View Controls (Tabs)
All visualizations must use identical tab styling:
- Container: `border-radius: 8px`, `backdrop-filter: blur(12px)`
- Buttons: `border-radius: 6px`, `font-size: 0.7rem`
- Padding: `0.3rem` container, `0.5rem 0.9rem` buttons
- Background: `rgba(8, 8, 12, 0.85)`

### Positioning Standards
| Element | Desktop Position | Mobile Position |
|---------|-----------------|-----------------|
| View Controls | `top: 1.5rem; left: 50%` | `bottom: 4rem; left: 50%` |
| Insight/Stat Overlay | `top: 1.5rem; right: 2rem` | Same |
| Legend | `bottom: 1.5rem; left: 2rem` | Varies |
| Audio Button | `bottom: 1.5rem; right: 2rem` | Same |

### Active State Colors
- Use territory-specific colors with consistent opacity patterns
- Border: `rgba(color, 0.3)`
- Background: `rgba(color, 0.08)`

---

## Technical Non-Negotiables

### Three.js Version
```
Three.js r128 — DO NOT UPGRADE
```
Reason: OrbitControls compatibility. Later versions break CDN loading.

### CDN URLs (exact versions)
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
```

### Local Development
```bash
python3 -m http.server 8080  # ALWAYS use port 8080
```

### Validation Before Commit
```bash
node --check main.js  # Always validate JS syntax
```

### Browser Testing
- Use **Claude Code's Chrome plugin** for browser testing and screenshots
- Do NOT use Playwright or other browser automation tools
- Test at `http://localhost:8080` with the Python server running

---

## Animation Standards

### Principles
1. **Continuous & cyclic** — No visible resets or jumps
2. **Smooth easing** — Use GSAP or CSS transitions with proper easing
3. **Contemplative pace** — Subtle movements, not flashy
4. **Dark phase transitions** — View mode changes go through darkness first

### Forbidden
- Jerky or abrupt animations
- Visible loop resets
- Overly fast movements
- Particle "nonsense" (user's words)

---

## Data Accuracy

### Citations Must Be Verified
- Never use unverified statistics
- Current verified stat: **84%** (RAND Corporation, 2024) — data scientists cite "misunderstanding the problem" as primary cause of AI project failure
- The commonly cited "80%" is from Gartner 2018 and less rigorous

### When Adding New Data
1. Web search to find primary source
2. Verify the exact claim
3. Include source attribution in UI

---

## Code Quality

### File Organization
- All CSS embedded in `index.html` `<style>` tags
- All JS in separate `main.js` file
- No build tools — direct CDN loading

### Naming Conventions
- CSS classes: BEM-style (`.detail-panel__nav-btn`)
- JS functions: camelCase (`focusOnOrb`)
- Constants: UPPER_SNAKE_CASE (`CONFIG.colors`)

### Comments
- Section headers: `// ============================================================`
- Function descriptions where non-obvious
- No excessive inline comments

---

## Before Every Commit

### Checklist
- [ ] JS syntax validated (`node --check main.js`)
- [ ] Tested in browser at `localhost:8080`
- [ ] Typography consistent (Cormorant Garamond + IBM Plex Sans)
- [ ] View controls styling matches other visualizations
- [ ] Animations are smooth and cyclic
- [ ] Any statistics are verified with sources

---

## Aesthetic Goals

> "Quiet awe, like stargazing" — not technical impressiveness

- Contemplative, not flashy
- Minimal text — let visualization speak
- Warm (human/amber) vs cool (AI/cyan) color separation
- Observatory/exploratory feeling

---

## Files to Cross-Reference for Consistency

When making UI changes, check these files match:
1. `visualizations/four-rungs/index.html` — Latest standards
2. `visualizations/complementarity-view/index.html` — Must match Four Rungs
3. `index.html` (root) — Landing page typography
4. `shared/design-system.css` — Design tokens

---

*Last Updated: December 29, 2025*
