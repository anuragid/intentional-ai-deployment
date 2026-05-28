export const JOIN_SEPARATOR = '\n\n';

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
