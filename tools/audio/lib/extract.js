import { parse } from 'node-html-parser';
import { SELECTOR, blockNarrationText } from '../../../shared/audio-tokenize.js';

// Returns ordered narratable blocks from an article's HTML string.
export function extractBlocks(html) {
  const root = parse(html);
  const prose = root.querySelector('.article__prose');
  if (!prose) return [];
  const els = prose.querySelectorAll(SELECTOR);
  const blocks = [];
  for (const el of els) {
    // Skip blocks inside figures/embeds (e.g. captions).
    if (el.closest('figure')) continue;
    const text = blockNarrationText(el);
    if (!text) continue;
    blocks.push({ index: blocks.length, text });
  }
  return blocks;
}
