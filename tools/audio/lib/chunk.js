export const JOIN_SEPARATOR = '\n\n';

// Take leading blocks until adding the next would exceed maxChars (joined length).
// Always keeps at least the first block. Used by --max-chars for budget-capped
// validation runs. Returns all blocks when maxChars is falsy.
export function capBlocks(blocks, maxChars) {
  if (!maxChars) return blocks;
  const out = [];
  let total = 0;
  for (const b of blocks) {
    const add = (out.length ? JOIN_SEPARATOR.length : 0) + b.text.length;
    if (out.length && total + add > maxChars) break;
    out.push(b);
    total += add;
  }
  return out;
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
export function isHeadingTag(tag) {
  return HEADING_TAGS.has((tag || '').toLowerCase());
}

// Order-preserving segmentation for narration. A section heading starts a NEW
// segment and is rendered ATTACHED to the prose that follows it (eleven_v3 has
// no out-of-band context, so a heading read in isolation comes out flat — it
// needs adjacent text in the same request to sound natural). Such a segment is
// flagged `headingLed` so the build inserts silence BEFORE it (the audiobook
// section break). Prose is otherwise grouped into chunks <= maxChars; if a
// heading's section overflows, only its first chunk is `headingLed`.
// Returns [{ blocks: [...], headingLed: bool }] in reading order.
export function segmentBlocks(blocks, maxChars = 4500) {
  const segments = [];
  let cur = [];
  let len = 0;
  let headingLed = false;
  const flush = () => {
    if (cur.length) { segments.push({ blocks: cur, headingLed }); cur = []; len = 0; headingLed = false; }
  };
  for (const b of blocks) {
    if (isHeadingTag(b.tag)) {
      flush();
      cur = [b];
      len = b.text.length;
      headingLed = true;
      continue;
    }
    const add = (cur.length ? JOIN_SEPARATOR.length : 0) + b.text.length;
    if (cur.length && len + add > maxChars) flush();
    cur.push(b);
    len += (cur.length > 1 ? JOIN_SEPARATOR.length : 0) + b.text.length;
  }
  flush();
  return segments;
}

// Groups blocks into chunks whose joined text length <= maxChars.
// A single oversized block becomes its own chunk (sent as-is).
export function chunkBlocks(blocks, maxChars = 4500) {
  const chunks = [];
  let current = [];
  let len = 0;
  for (const b of blocks) {
    const add = (current.length ? JOIN_SEPARATOR.length : 0) + b.text.length;
    if (current.length && len + add > maxChars) {
      chunks.push(current);
      current = [];
      len = 0;
    }
    current.push(b);
    len += (current.length > 1 ? JOIN_SEPARATOR.length : 0) + b.text.length;
  }
  if (current.length) chunks.push(current);
  return chunks;
}
