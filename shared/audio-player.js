import { SELECTOR, blockNarrationText, tokenizeWords } from './audio-tokenize.js';

// ---- Pure: binary search for the word covering time t ----
export function findActiveWordIndex(words, t) {
  if (!words.length || t < words[0].start) return -1;
  let lo = 0, hi = words.length - 1, ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].start <= t) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans;
}

// ---- Everything below runs only in the browser ----
const slug = (typeof document !== 'undefined') && document.body?.dataset?.slug;
const proseEl = (typeof document !== 'undefined') && document.querySelector('.article__prose');
const supported = typeof window !== 'undefined' && 'Highlight' in window && CSS?.highlights;

// GSAP is optional: dynamically imported for spring motion. The dock is fully
// styled and functional via CSS without it (graceful fallback on import failure).
let gsap = null;
async function loadGsap() {
  if (gsap) return gsap;
  try {
    const mod = await import('https://cdn.jsdelivr.net/npm/gsap@3.12.5/+esm');
    gsap = mod.gsap || mod.default || null;
  } catch { gsap = null; }
  return gsap;
}

if (slug && proseEl) init();

async function init() {
  const manifest = await loadManifest(slug);
  if (!manifest) return;                       // no audio → no player
  const ui = buildPlayer(manifest);
  document.body.appendChild(ui.root);
  ui.enter();
}

async function loadManifest(slug) {
  try {
    const url = await storageUrl(`audio/${slug}/manifest.json`);
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Resolve a Storage object path to a download URL via the Firebase config.
// Local-dev override (inert in production): `?awLocal` on the URL, or a global
// `window.__AW_AUDIO_BASE__`, serves `<base>/<path>` from the dev server instead
// of Firebase Storage — used to verify the player against local build output.
async function storageUrl(path) {
  const localBase = localAudioBase();
  if (localBase != null) return `${localBase}/${path}`;
  const bucket = (await getBucket());
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

function localAudioBase() {
  if (typeof window !== 'undefined' && typeof window.__AW_AUDIO_BASE__ === 'string') {
    return window.__AW_AUDIO_BASE__;
  }
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('awLocal')) {
    return ''; // server root: `/audio/<slug>/...`
  }
  return null;
}

async function getBucket() {
  // Prefer Hosting-served init.json; fall back to local config module.
  try {
    const r = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    if (r.ok) { const c = await r.json(); if (c.storageBucket) return c.storageBucket; }
  } catch {}
  try { const m = await import('./firebase-config.js'); return m.firebaseConfig.storageBucket; } catch {}
  return null;
}

// ---- Inline SVG icons (render identically across browsers/OSes) ----
const ICON = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a.5.5 0 0 0 .77.42l10.5-6.86a.5.5 0 0 0 0-.84L8.77 4.72A.5.5 0 0 0 8 5.14Z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="3.4" height="14" rx="1.2"/><rect x="14.1" y="5" width="3.4" height="14" rx="1.2"/></svg>',
  caret: '<svg class="aw-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9l7 7 7-7"/></svg>',
  check: '<svg class="aw-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 6.5"/></svg>',
  // Read-along: three lines; the middle (current) line is wrapped to pulse while following.
  follow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="6.5" x2="20" y2="6.5"/><g class="aw-follow-mark"><path d="M3.5 12h1.4"/><line x1="8" y1="12" x2="16" y2="12"/></g><line x1="8" y1="17.5" x2="20" y2="17.5"/></svg>',
};

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
const fmtSpeed = (v) => `${v}×`;

function buildPlayer(manifest) {
  const root = document.createElement('div');
  root.className = 'aw-player';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Article audio player');

  const dock = document.createElement('div');
  dock.className = 'aw-dock';
  root.appendChild(dock);

  const audio = new Audio();
  audio.preload = 'none';

  const modes = Object.keys(manifest.modes);
  let current = modes.includes('narration') ? 'narration' : modes[0];
  let timings = null;
  let wordIndex = [];
  let following = true;        // read-along auto-scroll on by default
  let lastIdx = -1;            // last highlighted word index

  dock.innerHTML = `
    <button class="aw-btn aw-play" aria-label="Play">${ICON.play}</button>
    <span class="aw-sep"></span>
    <input class="aw-seek" type="range" min="0" max="1000" value="0" aria-label="Seek">
    <span class="aw-time"><span class="aw-time-cur">0:00</span><span class="aw-time-slash"> / </span><span class="aw-time-total">0:00</span></span>
    <span class="aw-sep"></span>
    <div class="aw-speed-wrap">
      <button class="aw-speed" aria-haspopup="true" aria-expanded="false" aria-label="Playback speed">
        <span class="aw-speed-label">${fmtSpeed(1)}</span>${ICON.caret}
      </button>
      <div class="aw-speed-menu" role="menu" hidden>
        ${SPEEDS.map(v => `
          <button class="aw-speed-opt" role="menuitemradio" data-v="${v}" aria-checked="${v === 1}">
            <span>${fmtSpeed(v)}</span>${ICON.check}
          </button>`).join('')}
      </div>
    </div>
    <button class="aw-btn aw-follow" aria-label="Follow read-along" aria-pressed="true" title="Keep the spoken line in view">${ICON.follow}</button>
  `;

  const playBtn = dock.querySelector('.aw-play');
  const seek = dock.querySelector('.aw-seek');
  const curEl = dock.querySelector('.aw-time-cur');
  const totalEl = dock.querySelector('.aw-time-total');
  const speedBtn = dock.querySelector('.aw-speed');
  const speedLabel = dock.querySelector('.aw-speed-label');
  const speedMenu = dock.querySelector('.aw-speed-menu');
  const followBtn = dock.querySelector('.aw-follow');

  // ── Audio source / mode loading ──
  async function setMode(mode) {
    current = mode;
    const wasPlaying = !audio.paused;
    audio.pause();
    audio.src = await storageUrl(manifest.modes[mode].audio);
    clearHighlight();
    if (mode === 'narration' && manifest.modes[mode].timings) {
      timings = await (await fetch(await storageUrl(manifest.modes[mode].timings))).json();
      wordIndex = buildWordIndex(timings);
    } else {
      timings = null; wordIndex = [];
    }
    if (wasPlaying) audio.play();
  }

  // ── Play / pause ──
  playBtn.addEventListener('click', async () => {
    if (!audio.src) await setMode(current);
    if (audio.paused) audio.play(); else audio.pause();
  });
  audio.addEventListener('play', () => {
    playBtn.innerHTML = ICON.pause;
    playBtn.setAttribute('aria-label', 'Pause');
    tick();
  });
  audio.addEventListener('pause', () => {
    playBtn.innerHTML = ICON.play;
    playBtn.setAttribute('aria-label', 'Play');
  });
  audio.addEventListener('loadedmetadata', () => { if (audio.duration) totalEl.textContent = fmt(audio.duration); });

  // ── Seek ──
  seek.addEventListener('input', () => {
    if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration;
    seek.style.setProperty('--aw-pct', `${seek.value / 10}%`);
  });

  // ── Speed menu (custom; replaces native <select> for consistent type) ──
  function openSpeed(open) {
    speedBtn.setAttribute('aria-expanded', String(open));
    if (open) {
      speedMenu.hidden = false;
      if (gsap) gsap.fromTo(speedMenu, { scale: 0.9, opacity: 0, y: 6 }, { scale: 1, opacity: 1, y: 0, duration: 0.22, ease: 'back.out(1.7)' });
    } else if (gsap) {
      gsap.to(speedMenu, { scale: 0.92, opacity: 0, y: 6, duration: 0.14, ease: 'power2.in', onComplete: () => { speedMenu.hidden = true; } });
    } else {
      speedMenu.hidden = true;
    }
  }
  speedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openSpeed(speedBtn.getAttribute('aria-expanded') !== 'true');
  });
  speedMenu.querySelectorAll('.aw-speed-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const v = +opt.dataset.v;
      audio.playbackRate = v;
      speedLabel.textContent = fmtSpeed(v);
      speedMenu.querySelectorAll('.aw-speed-opt').forEach(o => o.setAttribute('aria-checked', String(o === opt)));
      openSpeed(false);
    });
  });
  document.addEventListener('click', (e) => {
    if (speedBtn.getAttribute('aria-expanded') === 'true' && !e.target.closest('.aw-speed-wrap')) openSpeed(false);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') openSpeed(false); });

  // ── Follow toggle + user-scroll detection ──
  const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar']);
  function setFollowing(on) {
    following = on;
    followBtn.setAttribute('aria-pressed', String(on));
    if (on) lastIdx = -1;                          // re-anchor on next tick
  }
  followBtn.addEventListener('click', () => setFollowing(!following));
  const onUserScroll = () => { if (following) setFollowing(false); };
  window.addEventListener('wheel', onUserScroll, { passive: true });
  window.addEventListener('touchmove', onUserScroll, { passive: true });
  window.addEventListener('keydown', (e) => { if (SCROLL_KEYS.has(e.key)) onUserScroll(); }, { passive: true });

  // ── Dock motion (GSAP springs; CSS-class fallback) ──
  let hovering = false, scrolling = false, scrollTimer = 0;
  function applyDockMotion() {
    const scale = scrolling ? 0.93 : (hovering ? 1.02 : 1);
    const y = scrolling ? 0 : (hovering ? -5 : 0);
    const opacity = scrolling ? 0.72 : 1;
    if (gsap) {
      gsap.to(dock, { scale, y, opacity, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    } else {
      root.classList.toggle('is-hover', hovering && !scrolling);
      root.classList.toggle('is-scrolling', scrolling);
    }
  }
  dock.addEventListener('pointerenter', () => { hovering = true; applyDockMotion(); });
  dock.addEventListener('pointerleave', () => { hovering = false; applyDockMotion(); });
  const onScrollMotion = () => {
    if (!scrolling) { scrolling = true; applyDockMotion(); }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { scrolling = false; applyDockMotion(); }, 650);
  };
  window.addEventListener('wheel', onScrollMotion, { passive: true });
  window.addEventListener('touchmove', onScrollMotion, { passive: true });

  function enter() {
    loadGsap().then(g => {
      if (!g) return;
      root.classList.add('aw-gsap');            // hand transform control to GSAP (drops CSS transition)
      g.from(dock, { y: 22, opacity: 0, duration: 0.6, ease: 'power3.out' });
    });
  }

  // ── Per-frame update ──
  function tick() {
    if (audio.paused) return;
    const t = audio.currentTime;
    if (audio.duration) {
      const pct = (t / audio.duration) * 1000;
      seek.value = String(pct);
      seek.style.setProperty('--aw-pct', `${pct / 10}%`);
      curEl.textContent = fmt(t);
    }
    if (current === 'narration' && wordIndex.length) highlightAt(t);
    requestAnimationFrame(tick);
  }

  return { root, enter };

  // ----- narration highlight via CSS Custom Highlight API -----
  function buildWordIndex(timings) {
    const blockEls = [...proseEl.querySelectorAll(SELECTOR)].filter(el => !el.closest('figure'));
    const flat = [];
    timings.blocks.forEach((tb) => {
      const el = blockEls[tb.index];
      if (!el) return;
      const tokens = tokenizeWords(blockNarrationText(el));
      tb.words.forEach((w, i) => {
        const tok = tokens[i];
        if (!tok) return;
        flat.push({ el, start: w.start, end: w.end, charStart: tok.charStart, charEnd: tok.charEnd });
      });
    });
    return flat;
  }

  function rangeForWord(w) {
    const range = document.createRange();
    let acc = 0, set = false;
    const walker = document.createTreeWalker(w.el, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        return n.parentElement?.closest('sup.footnote-ref') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      const len = node.textContent.length;
      if (!set && acc + len > w.charStart) { range.setStart(node, Math.max(0, w.charStart - acc)); set = true; }
      if (set && acc + len >= w.charEnd) { range.setEnd(node, Math.min(len, w.charEnd - acc)); return range; }
      acc += len;
    }
    return set ? range : null;
  }

  function highlightAt(t) {
    const idx = findActiveWordIndex(wordIndex, t);
    if (idx === lastIdx || idx < 0) return;
    lastIdx = idx;
    if (!supported) return;                  // graceful: no highlight, audio still plays
    const range = rangeForWord(wordIndex[idx]);
    if (!range) return;
    CSS.highlights.set('aw-active', new Highlight(range));
    maybeFollow(range);
  }

  // Gentle: only scroll when the spoken word drifts OUT of a comfortable middle
  // band — not a jittery re-center on every word.
  function maybeFollow(range) {
    if (!following || prefersReducedMotion()) return;
    const rect = range.getBoundingClientRect();
    const vh = window.innerHeight;
    if (rect.top < vh * 0.30 || rect.bottom > vh * 0.68) {
      window.scrollTo({ top: window.scrollY + rect.top - vh * 0.42, behavior: 'smooth' });
    }
  }

  function clearHighlight() { if (supported) CSS.highlights.delete('aw-active'); lastIdx = -1; }
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
function fmt(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
