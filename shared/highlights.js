// Highlights UI: selection menu, paragraph anchoring, render, hover tooltip,
// reactions, sharing, article-level reactions.

import {
  listenHighlights,
  createHighlight,
  toggleHighlightReaction,
  listenArticleReactions,
  toggleArticleReaction,
  getCurrentUid,
} from './highlights-data.js';

const REACTIONS = [
  { type: 'heart', glyph: '♥', label: 'Heart' },
  { type: 'clap',  glyph: '👏', label: 'Clap' },
  { type: 'like',  glyph: '👍', label: 'Like' },
];

let activeTooltipHl = null;   // id of currently-shown highlight, if any
let tooltipPinned = false;    // sticky after click

// ===== Setup =====

const slug = document.body.dataset.slug;
if (!slug) {
  console.warn('[highlights] document.body.data-slug missing; highlights disabled');
}

const proseEl = document.querySelector('.article__prose');

if (slug && proseEl) {
  init();
}

function init() {
  assignParagraphIds(proseEl);
  const menu = createMenu();
  const tooltip = createTooltip();
  document.body.appendChild(menu);
  document.body.appendChild(tooltip);

  let highlights = [];
  let highlightById = new Map();
  let deepLinkConsumed = false;

  listenHighlights(slug, (list) => {
    highlights = list;
    highlightById = new Map(list.map((h) => [h.id, h]));
    renderHighlights(proseEl, highlights);
    attachHighlightHandlers(proseEl, highlightById, tooltip);
    refreshActiveTooltip(tooltip, highlightById);
    if (!deepLinkConsumed) {
      const handled = consumeDeepLink(proseEl);
      if (handled) deepLinkConsumed = true;
    }
  });

  wireSelectionMenu(proseEl, menu, async (anchor, action) => {
    const reactionType = (action === 'highlight' || action === 'copy') ? null : action;
    const id = await createHighlight(slug, anchor, reactionType, null);
    if (action === 'copy') {
      await copyDeepLink(slug, id);
    }
    hideMenu(menu);
    window.getSelection()?.removeAllRanges();
  });

  wireTooltipReactions(tooltip);
  wireTooltipCopy(tooltip);
  wireDismissTooltip(tooltip);

  // Article-level reactions row
  mountArticleReactions();
}

// ===== Paragraph IDs =====

function assignParagraphIds(prose) {
  const blocks = prose.querySelectorAll(':scope > p, :scope > h2, :scope > h3, :scope > blockquote, :scope > ul, :scope > ol');
  blocks.forEach((el, i) => {
    el.dataset.pid = `p-${i + 1}`;
  });
}

// ===== Selection menu =====

function createMenu() {
  const menu = document.createElement('div');
  menu.className = 'hl-menu';
  menu.setAttribute('role', 'toolbar');
  const reactionBtns = REACTIONS.map((r) =>
    `<button type="button" class="hl-menu__btn hl-menu__btn--icon" data-action="${r.type}" aria-label="Highlight and ${r.label.toLowerCase()}">
       <span aria-hidden="true">${r.glyph}</span>
     </button>`
  ).join('');
  menu.innerHTML = `
    <button type="button" class="hl-menu__btn" data-action="highlight" aria-label="Highlight selection">
      <span aria-hidden="true">✎</span> Highlight
    </button>
    <span class="hl-menu__sep" aria-hidden="true"></span>
    ${reactionBtns}
    <span class="hl-menu__sep" aria-hidden="true"></span>
    <button type="button" class="hl-menu__btn hl-menu__btn--icon" data-action="copy" aria-label="Copy link to this passage">
      <span aria-hidden="true">⤴</span>
    </button>
  `;
  return menu;
}

function showMenu(menu, rect) {
  menu.classList.add('hl-menu--visible');
  const menuRect = menu.getBoundingClientRect();
  const left = rect.left + (rect.width / 2) - (menuRect.width / 2) + window.scrollX;
  const top = rect.top - menuRect.height - 10 + window.scrollY;
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
}

function hideMenu(menu) {
  menu.classList.remove('hl-menu--visible');
}

function wireSelectionMenu(prose, menu, onCreate) {
  let currentAnchor = null;

  document.addEventListener('selectionchange', () => {
    const sel = document.getSelection();
    if (!sel || sel.isCollapsed) {
      hideMenu(menu);
      currentAnchor = null;
      return;
    }
    const range = sel.getRangeAt(0);
    const anchor = computeAnchor(prose, range);
    if (!anchor) {
      hideMenu(menu);
      currentAnchor = null;
      return;
    }
    currentAnchor = anchor;
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      hideMenu(menu);
      return;
    }
    showMenu(menu, rect);
  });

  document.addEventListener('mousedown', (e) => {
    if (menu.contains(e.target)) return;
    if (window.getSelection()?.isCollapsed) hideMenu(menu);
  });

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || !currentAnchor) return;
    onCreate(currentAnchor, btn.dataset.action);
  });
}

// ===== Anchoring =====

function computeAnchor(prose, range) {
  const startBlock = findBlock(prose, range.startContainer);
  const endBlock = findBlock(prose, range.endContainer);
  if (!startBlock || !endBlock || startBlock !== endBlock) return null;

  const block = startBlock;
  const pid = block.dataset.pid;
  if (!pid) return null;

  const startOffset = textOffsetInBlock(block, range.startContainer, range.startOffset);
  const endOffset = textOffsetInBlock(block, range.endContainer, range.endOffset);
  if (endOffset <= startOffset) return null;

  const quote = block.textContent.slice(startOffset, endOffset);
  if (!quote.trim()) return null;

  return { paragraphId: pid, startOffset, endOffset, quote };
}

function findBlock(prose, node) {
  let cur = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (cur && cur !== prose) {
    if (cur.dataset && cur.dataset.pid) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function textOffsetInBlock(block, targetNode, targetOffset) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let node;
  while ((node = walker.nextNode())) {
    if (node === targetNode) return pos + targetOffset;
    pos += node.nodeValue.length;
  }
  return pos;
}

// ===== Render highlights =====

function renderHighlights(prose, highlights) {
  const byPid = new Map();
  for (const hl of highlights) {
    if (!byPid.has(hl.paragraphId)) byPid.set(hl.paragraphId, []);
    byPid.get(hl.paragraphId).push(hl);
  }

  const blocks = prose.querySelectorAll('[data-pid]');
  blocks.forEach((block) => {
    if (block.dataset.pristine === undefined) {
      block.dataset.pristine = block.innerHTML;
    } else {
      block.innerHTML = block.dataset.pristine;
    }
    const list = byPid.get(block.dataset.pid);
    if (!list || list.length === 0) return;

    const resolved = list.map((hl) => resolveAnchor(block, hl)).filter(Boolean);
    resolved.sort((a, b) => a.startOffset - b.startOffset);

    for (const hl of resolved) {
      wrapRange(block, hl.startOffset, hl.endOffset, hl);
    }
  });
}

function resolveAnchor(block, hl) {
  const text = block.textContent;
  if (
    typeof hl.startOffset === 'number' &&
    typeof hl.endOffset === 'number' &&
    hl.endOffset <= text.length &&
    text.slice(hl.startOffset, hl.endOffset) === hl.quote
  ) {
    return hl;
  }
  if (hl.quote) {
    const idx = text.indexOf(hl.quote);
    if (idx !== -1) {
      return { ...hl, startOffset: idx, endOffset: idx + hl.quote.length };
    }
  }
  return null;
}

function wrapRange(block, startOffset, endOffset, hl) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.parentElement && node.parentElement.closest('mark.hl')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const segments = [];
  let pos = 0;
  let node;
  while ((node = walker.nextNode())) {
    const len = node.nodeValue.length;
    const nodeStart = pos;
    const nodeEnd = pos + len;
    if (nodeEnd > startOffset && nodeStart < endOffset) {
      const localStart = Math.max(0, startOffset - nodeStart);
      const localEnd = Math.min(len, endOffset - nodeStart);
      segments.push({ node, localStart, localEnd });
    }
    pos = nodeEnd;
    if (pos >= block.textContent.length) break;
  }

  for (let i = segments.length - 1; i >= 0; i--) {
    const { node, localStart, localEnd } = segments[i];
    if (localStart >= localEnd) continue;
    const original = node.nodeValue;
    const before = original.slice(0, localStart);
    const middle = original.slice(localStart, localEnd);
    const after = original.slice(localEnd);

    const mark = document.createElement('mark');
    mark.className = 'hl';
    mark.dataset.hlId = hl.id;
    mark.style.setProperty('--hl-alpha', String(intensityFor(hl)));
    mark.textContent = middle;

    node.nodeValue = before;
    const parent = node.parentNode;
    parent.insertBefore(mark, node.nextSibling);
    if (after) parent.insertBefore(document.createTextNode(after), mark.nextSibling);
  }
}

function intensityFor(hl) {
  const total = (hl.counts && hl.counts.total) || 1;
  const alpha = Math.min(0.40, 0.18 + 0.025 * (total - 1));
  return alpha.toFixed(3);
}

// ===== Tooltip (interactive) =====

function createTooltip() {
  const t = document.createElement('div');
  t.className = 'hl-tooltip';
  t.setAttribute('role', 'tooltip');
  return t;
}

function renderTooltipBody(tooltip, hl) {
  const counts = hl.counts || { heart: 0, clap: 0, like: 0, total: 0 };
  const uid = getCurrentUid();
  const mine = (hl.reactions && hl.reactions[uid]) || [];
  const total = counts.total || 0;
  const totalText = total === 1 ? '1 highlight' : `${total} highlights`;

  const reactionBtns = REACTIONS.map((r) => {
    const active = mine.includes(r.type);
    const count = counts[r.type] || 0;
    return `<button type="button" class="hl-tooltip__react ${active ? 'is-active' : ''}" data-reaction="${r.type}" aria-pressed="${active}" aria-label="${r.label} (${count})">
      <span class="hl-tooltip__glyph" aria-hidden="true">${r.glyph}</span>
      ${count > 0 ? `<span class="hl-tooltip__rcount">${count}</span>` : ''}
    </button>`;
  }).join('');

  tooltip.innerHTML = `
    <div class="hl-tooltip__row">
      <span class="hl-tooltip__count">${totalText}</span>
    </div>
    <div class="hl-tooltip__row hl-tooltip__row--actions">
      ${reactionBtns}
      <span class="hl-tooltip__sep" aria-hidden="true"></span>
      <button type="button" class="hl-tooltip__react" data-action="copy" aria-label="Copy link to this passage">
        <span class="hl-tooltip__glyph" aria-hidden="true">⤴</span>
      </button>
    </div>
  `;
}

function positionTooltip(tooltip, mark) {
  const rect = mark.getBoundingClientRect();
  const tt = tooltip.getBoundingClientRect();
  const top = rect.top - tt.height - 10 + window.scrollY;
  const left = rect.left + rect.width / 2 - tt.width / 2 + window.scrollX;
  tooltip.style.left = `${Math.max(8, Math.min(left, window.innerWidth - tt.width - 8))}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

function showTooltipFor(tooltip, mark, hl, opts = {}) {
  activeTooltipHl = hl.id;
  tooltipPinned = !!opts.pinned;
  renderTooltipBody(tooltip, hl);
  tooltip.classList.add('hl-tooltip--visible');
  if (tooltipPinned) tooltip.classList.add('hl-tooltip--pinned');
  else tooltip.classList.remove('hl-tooltip--pinned');
  positionTooltip(tooltip, mark);
  tooltip.dataset.hlId = hl.id;
}

function hideTooltip(tooltip) {
  tooltip.classList.remove('hl-tooltip--visible', 'hl-tooltip--pinned');
  activeTooltipHl = null;
  tooltipPinned = false;
  delete tooltip.dataset.hlId;
}

function refreshActiveTooltip(tooltip, byId) {
  if (!activeTooltipHl) return;
  const hl = byId.get(activeTooltipHl);
  if (!hl) {
    hideTooltip(tooltip);
    return;
  }
  renderTooltipBody(tooltip, hl);
  const mark = document.querySelector(`mark.hl[data-hl-id="${CSS.escape(activeTooltipHl)}"]`);
  if (mark) positionTooltip(tooltip, mark);
}

function attachHighlightHandlers(prose, byId, tooltip) {
  const marks = prose.querySelectorAll('mark.hl');
  marks.forEach((mark) => {
    if (mark.dataset.bound === '1') return;
    mark.dataset.bound = '1';

    mark.addEventListener('mouseenter', () => {
      if (tooltipPinned) return;
      const hl = byId.get(mark.dataset.hlId);
      if (!hl) return;
      showTooltipFor(tooltip, mark, hl, { pinned: false });
    });

    mark.addEventListener('mouseleave', () => {
      if (tooltipPinned) return;
      // Slight delay so user can move cursor into the tooltip
      setTimeout(() => {
        if (tooltipPinned) return;
        if (!tooltip.matches(':hover')) hideTooltip(tooltip);
      }, 80);
    });

    mark.addEventListener('click', (e) => {
      e.stopPropagation();
      const hl = byId.get(mark.dataset.hlId);
      if (!hl) return;
      showTooltipFor(tooltip, mark, hl, { pinned: true });
    });
  });
}

function wireTooltipReactions(tooltip) {
  tooltip.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-reaction]');
    if (!btn) return;
    const hlId = tooltip.dataset.hlId;
    if (!hlId) return;
    e.stopPropagation();
    await toggleHighlightReaction(slug, hlId, btn.dataset.reaction);
    // The listenHighlights subscription will re-render and refreshActiveTooltip
  });

  tooltip.addEventListener('mouseleave', () => {
    if (tooltipPinned) return;
    hideTooltip(tooltip);
  });
}

function wireTooltipCopy(tooltip) {
  tooltip.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action="copy"]');
    if (!btn) return;
    const hlId = tooltip.dataset.hlId;
    if (!hlId) return;
    e.stopPropagation();
    await copyDeepLink(slug, hlId);
  });
}

function wireDismissTooltip(tooltip) {
  document.addEventListener('mousedown', (e) => {
    if (!tooltipPinned) return;
    if (tooltip.contains(e.target)) return;
    if (e.target.closest('mark.hl')) return;
    hideTooltip(tooltip);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tooltipPinned) hideTooltip(tooltip);
  });
}

// ===== Sharing / deep-link =====

function buildHighlightUrl(slug, hlId) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('h', hlId);
  return url.toString();
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
    return;
  } catch {
    // Fallback for non-secure contexts or non-gesture invocations
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  ta.style.pointerEvents = 'none';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast(successMessage); }
  catch { showToast('Copy failed — try selecting URL manually'); }
  document.body.removeChild(ta);
}

async function copyDeepLink(slug, hlId) {
  await copyText(buildHighlightUrl(slug, hlId), 'Link copied');
}

function consumeDeepLink(prose) {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('h');
  if (!id) return false;
  const mark = prose.querySelector(`mark.hl[data-hl-id="${CSS.escape(id)}"]`);
  if (!mark) return false;
  window.__hlDeepLink = { id, ranAt: Date.now() };
  const target = mark.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.35;
  window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  mark.classList.add('hl--flash');
  setTimeout(() => mark.classList.remove('hl--flash'), 1800);
  setTimeout(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('h');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }, 2000);
  return true;
}

// ===== Toast =====

let toastEl = null;
let toastTimer = null;

function ensureToast() {
  if (toastEl) return toastEl;
  toastEl = document.createElement('div');
  toastEl.className = 'hl-toast';
  toastEl.setAttribute('role', 'status');
  toastEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastEl);
  return toastEl;
}

function showToast(message) {
  const t = ensureToast();
  t.textContent = message;
  t.classList.add('hl-toast--visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('hl-toast--visible'), 2500);
}

// ===== Article-level reactions =====

function mountArticleReactions() {
  // Insert before the prev/next nav, after the footnotes section if present
  const nav = document.querySelector('.article-nav');
  if (!nav) return;

  const row = document.createElement('div');
  row.className = 'article-reactions';
  row.innerHTML = `
    <div class="article-reactions__inner">
      <div class="article-reactions__buttons">
        ${REACTIONS.map((r) => `
          <button type="button" class="article-reactions__btn" data-reaction="${r.type}" aria-pressed="false" aria-label="${r.label} this article">
            <span class="article-reactions__glyph" aria-hidden="true">${r.glyph}</span>
            <span class="article-reactions__count" data-count-for="${r.type}">0</span>
          </button>
        `).join('')}
      </div>
      <button type="button" class="article-reactions__share" data-action="copy-article" aria-label="Copy link to this article">
        <span aria-hidden="true">⤴</span> Copy link
      </button>
    </div>
  `;
  nav.parentNode.insertBefore(row, nav);

  // Subscribe to article reactions
  listenArticleReactions(slug, ({ counts, mine }) => {
    REACTIONS.forEach((r) => {
      const btn = row.querySelector(`[data-reaction="${r.type}"]`);
      if (!btn) return;
      const count = counts[r.type] || 0;
      const isMine = mine.includes(r.type);
      btn.classList.toggle('is-active', isMine);
      btn.setAttribute('aria-pressed', String(isMine));
      btn.querySelector(`[data-count-for="${r.type}"]`).textContent = String(count);
    });
  });

  row.addEventListener('click', async (e) => {
    const reactBtn = e.target.closest('[data-reaction]');
    if (reactBtn) {
      await toggleArticleReaction(slug, reactBtn.dataset.reaction);
      return;
    }
    const shareBtn = e.target.closest('[data-action="copy-article"]');
    if (shareBtn) {
      const url = new URL(window.location.href);
      url.search = '';
      url.hash = '';
      await copyText(url.toString(), 'Article link copied');
    }
  });
}
