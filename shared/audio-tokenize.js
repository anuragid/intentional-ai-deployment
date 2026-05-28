// Shared by the audio build tool (Node) and the runtime player (browser).
// Pure ESM, no DOM/global assumptions beyond a minimal node interface.

export const SELECTOR = 'p, h2, h3, blockquote, li';

export function collapseWhitespace(s) {
  return s.replace(/\s+/g, ' ').trim();
}

// Visible narration text of a block element, excluding footnote-ref sups.
// `node` may be a browser Element or a node-html-parser element.
export function blockNarrationText(node) {
  let out = '';
  for (const child of node.childNodes || []) {
    if (child.nodeType === 3) {                       // text node
      out += child.textContent ?? child.rawText ?? '';
    } else if (child.nodeType === 1) {                // element
      const tag = (child.tagName || '').toLowerCase();
      const cls = child.getAttribute ? (child.getAttribute('class') || '') : '';
      if (tag === 'sup' && /footnote-ref/.test(cls)) continue; // skip footnote markers
      out += blockNarrationText(child);
    }
  }
  return collapseWhitespace(out);
}

export function tokenizeWords(text) {
  const tokens = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    tokens.push({ text: m[0], charStart: m.index, charEnd: m.index + m[0].length });
  }
  return tokens;
}
