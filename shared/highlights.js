// Highlights UI: selection menu, paragraph anchoring, render, hover tooltip.
//
// Phase 1: just the Highlight button on the selection menu and a count tooltip
// on hover. Reactions and sharing arrive in phases 2 and 3.

import {
  listenHighlights,
  createHighlight,
} from './highlights-data.js';

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

  // Track live highlights for this article
  let highlights = [];
  listenHighlights(slug, (list) => {
    highlights = list;
    renderHighlights(proseEl, highlights);
    attachHoverHandlers(proseEl, highlights, tooltip);
  });

  wireSelectionMenu(proseEl, menu, async (anchor) => {
    await createHighlight(slug, anchor, null, null);
    hideMenu(menu);
    window.getSelection()?.removeAllRanges();
  });
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
  menu.innerHTML = `
    <button type="button" class="hl-menu__btn" data-action="highlight" aria-label="Highlight selection">
      <span aria-hidden="true">✎</span> Highlight
    </button>
  `;
  return menu;
}

function showMenu(menu, rect) {
  menu.classList.add('hl-menu--visible');
  // Center menu horizontally above the selection
  const menuRect = menu.getBoundingClientRect();
  const left = rect.left + (rect.width / 2) - (menuRect.width / 2) + window.scrollX;
  const top = rect.top - menuRect.height - 10 + window.scrollY;
  menu.style.left = `${Math.max(8, left)}px`;
  menu.style.top = `${Math.max(8, top)}px`;
}

function hideMenu(menu) {
  menu.classList.remove('hl-menu--visible');
}

function wireSelectionMenu(prose, menu, onHighlight) {
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

  // Hide on click outside menu/selection
  document.addEventListener('mousedown', (e) => {
    if (menu.contains(e.target)) return;
    if (window.getSelection()?.isCollapsed) hideMenu(menu);
  });

  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'highlight' && currentAnchor) {
      onHighlight(currentAnchor);
    }
  });
}

// ===== Anchoring =====
// Compute the (paragraphId, startOffset, endOffset, quote) for a selection.
// Restricted to selections that begin and end inside the same block element.

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
  if (targetNode.nodeType === Node.ELEMENT_NODE) {
    // Selection ended at an element boundary — walk to compute up to that point
    const w2 = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let p = 0;
    while ((node = w2.nextNode())) {
      if (targetNode.contains(node)) {
        const range = document.createRange();
        range.selectNodeContents(targetNode);
        range.setEnd(node, node.nodeValue.length);
        p += node.nodeValue.length;
      } else {
        p += node.nodeValue.length;
      }
    }
    return p;
  }
  return pos;
}

// ===== Render highlights =====

function renderHighlights(prose, highlights) {
  // Group by paragraphId
  const byPid = new Map();
  for (const hl of highlights) {
    if (!byPid.has(hl.paragraphId)) byPid.set(hl.paragraphId, []);
    byPid.get(hl.paragraphId).push(hl);
  }

  // For each block: restore pristine HTML, then apply highlights in order
  const blocks = prose.querySelectorAll('[data-pid]');
  blocks.forEach((block) => {
    if (block.dataset.pristine === undefined) {
      block.dataset.pristine = block.innerHTML;
    } else {
      block.innerHTML = block.dataset.pristine;
    }
    const list = byPid.get(block.dataset.pid);
    if (!list) return;

    // Re-anchor each highlight (offsets may have shifted if text changed; we try quote first)
    const resolved = list.map((hl) => resolveAnchor(block, hl)).filter(Boolean);
    // Sort by start offset
    resolved.sort((a, b) => a.startOffset - b.startOffset);

    for (const hl of resolved) {
      wrapRange(block, hl.startOffset, hl.endOffset, hl);
    }
  });
}

// Try original offsets first; fall back to text search on quote.
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
  // Fallback: find the quote in the text
  if (hl.quote) {
    const idx = text.indexOf(hl.quote);
    if (idx !== -1) {
      return { ...hl, startOffset: idx, endOffset: idx + hl.quote.length };
    }
  }
  return null;
}

function wrapRange(block, startOffset, endOffset, hl) {
  // Walk text nodes; skip nodes already inside .hl marks
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
    // Note: we don't break here because text after a skipped (already-marked)
    // node may push positions beyond endOffset incorrectly. Walking the full
    // block keeps offsets consistent with the pristine text count above.
    if (pos >= block.textContent.length) break;
  }

  // Apply in reverse so node-splitting doesn't shift earlier offsets
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
    let cursor = node.nextSibling;
    parent.insertBefore(mark, cursor);
    if (after) parent.insertBefore(document.createTextNode(after), mark.nextSibling);
  }
}

function intensityFor(hl) {
  const total = (hl.counts && hl.counts.total) || 1;
  // Clamp 0.18 -> 0.40 as count grows
  const alpha = Math.min(0.40, 0.18 + 0.025 * (total - 1));
  return alpha.toFixed(3);
}

// ===== Hover tooltip =====

function createTooltip() {
  const t = document.createElement('div');
  t.className = 'hl-tooltip';
  t.setAttribute('role', 'tooltip');
  return t;
}

function showTooltip(tooltip, mark, text) {
  tooltip.textContent = '';
  const span = document.createElement('span');
  span.className = 'hl-tooltip__count';
  span.textContent = text;
  tooltip.appendChild(span);
  tooltip.classList.add('hl-tooltip--visible');
  const rect = mark.getBoundingClientRect();
  const tt = tooltip.getBoundingClientRect();
  const top = rect.top - tt.height - 8 + window.scrollY;
  const left = rect.left + rect.width / 2 - tt.width / 2 + window.scrollX;
  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

function hideTooltip(tooltip) {
  tooltip.classList.remove('hl-tooltip--visible');
}

function attachHoverHandlers(prose, highlights, tooltip) {
  const byId = new Map(highlights.map((h) => [h.id, h]));
  const marks = prose.querySelectorAll('mark.hl');
  marks.forEach((mark) => {
    if (mark.dataset.hoverBound === '1') return;
    mark.dataset.hoverBound = '1';
    mark.addEventListener('mouseenter', () => {
      const hl = byId.get(mark.dataset.hlId);
      if (!hl) return;
      const total = (hl.counts && hl.counts.total) || 1;
      const text = total === 1 ? '1 highlight' : `${total} highlights`;
      showTooltip(tooltip, mark, text);
    });
    mark.addEventListener('mouseleave', () => hideTooltip(tooltip));
  });
}
