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

if (slug && proseEl) init();

async function init() {
  const manifest = await loadManifest(slug);
  if (!manifest) return;                       // no audio → no player
  const ui = buildPlayer(manifest);
  document.body.appendChild(ui.root);
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

function buildPlayer(manifest) {
  const root = document.createElement('div');
  root.className = 'aw-player';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Article audio player');

  const audio = new Audio();
  audio.preload = 'none';

  const modes = Object.keys(manifest.modes);          // ['narration','podcast']
  let current = modes.includes('narration') ? 'narration' : modes[0];
  let timings = null;                                 // narration word data
  let wordIndex = [];                                 // flattened [{el-less} words + range builder]
  let following = true;
  let lastIdx = -1;                                   // last highlighted word index (declared before any use)

  root.innerHTML = `
    <button class="aw-play" aria-label="Play">▶</button>
    <input class="aw-seek" type="range" min="0" max="1000" value="0" aria-label="Seek">
    <span class="aw-time">0:00</span>
    <select class="aw-speed" aria-label="Playback speed">
      <option value="1">1×</option><option value="1.25">1.25×</option>
      <option value="1.5">1.5×</option><option value="2">2×</option>
    </select>
    <button class="aw-follow" aria-label="Resume auto-scroll" hidden>Follow</button>
    ${modes.length > 1 ? `<div class="aw-modes" role="tablist">
      ${modes.map(m => `<button class="aw-mode" data-mode="${m}" role="tab">${m}</button>`).join('')}
    </div>` : ''}
  `;

  const playBtn = root.querySelector('.aw-play');
  const seek = root.querySelector('.aw-seek');
  const timeEl = root.querySelector('.aw-time');

  async function setMode(mode) {
    current = mode;
    const wasPlaying = !audio.paused;
    audio.pause();
    audio.src = await storageUrl(manifest.modes[mode].audio);
    clearHighlight();
    if (mode === 'narration') {
      timings = await (await fetch(await storageUrl(manifest.modes[mode].timings))).json();
      wordIndex = buildWordIndex(timings);
    } else {
      timings = null; wordIndex = [];
    }
    root.querySelectorAll('.aw-mode').forEach(b =>
      b.setAttribute('aria-selected', String(b.dataset.mode === mode)));
    if (wasPlaying) audio.play();
  }

  playBtn.addEventListener('click', async () => {
    if (!audio.src) await setMode(current);
    if (audio.paused) { audio.play(); } else { audio.pause(); }
  });
  audio.addEventListener('play', () => { playBtn.textContent = '❚❚'; playBtn.setAttribute('aria-label', 'Pause'); tick(); });
  audio.addEventListener('pause', () => { playBtn.textContent = '▶'; playBtn.setAttribute('aria-label', 'Play'); });
  root.querySelector('.aw-speed').addEventListener('change', e => { audio.playbackRate = +e.target.value; });
  seek.addEventListener('input', () => { if (audio.duration) audio.currentTime = (seek.value / 1000) * audio.duration; });
  root.querySelectorAll('.aw-mode').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

  // Disable auto-scroll only on genuine USER scroll intent — NOT the player's own
  // programmatic smooth-scroll (which also fires 'scroll' and would self-disable).
  const followBtn = root.querySelector('.aw-follow');
  const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar']);
  const stopFollowing = () => { if (following) { following = false; if (followBtn) followBtn.hidden = false; } };
  window.addEventListener('wheel', stopFollowing, { passive: true });
  window.addEventListener('touchmove', stopFollowing, { passive: true });
  window.addEventListener('keydown', (e) => { if (SCROLL_KEYS.has(e.key)) stopFollowing(); }, { passive: true });
  followBtn?.addEventListener('click', () => { following = true; followBtn.hidden = true; lastIdx = -1; });

  function tick() {
    if (audio.paused) return;
    const t = audio.currentTime;
    if (audio.duration) {
      seek.value = String((t / audio.duration) * 1000);
      timeEl.textContent = fmt(t);
    }
    if (current === 'narration' && wordIndex.length) highlightAt(t);
    requestAnimationFrame(tick);
  }

  return { root };

  // ----- narration highlight via CSS Custom Highlight API -----
  function buildWordIndex(timings) {
    // Map each timing-word to a live DOM word by re-tokenizing blocks in order.
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
    // Walk text nodes of the block (skipping footnote sups) to find char offsets.
    const range = document.createRange();
    let acc = 0, set = false;
    const walker = document.createTreeWalker(w.el, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        return n.parentElement?.closest('sup.footnote-ref') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    });
    let node;
    // text in walker is raw; collapse handled by matching tokenized offsets approximately
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
    const w = wordIndex[idx];
    const range = rangeForWord(w);
    if (!range) return;
    const hl = new Highlight(range);
    CSS.highlights.set('aw-active', hl);
    if (following && !prefersReducedMotion()) {
      const rect = range.getBoundingClientRect();
      const target = window.scrollY + rect.top - window.innerHeight / 2;
      window.scrollTo({ top: target, behavior: 'smooth' });
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
