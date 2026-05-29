import { tokenizeWords } from '../../../shared/audio-tokenize.js';

const RESYNC_WINDOW = 6;   // entries to scan when re-syncing on aligner drift
const round = (n) => +Number(n).toFixed(4);
// Case/punctuation-insensitive compare for verifying word identity.
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// blocks: [{index, text}] (the CLEAN text sent to alignment, same order)
// words:  flat aligned [{text,start,end,...}] in reading order
// -> { duration, blocks:[{index, words:[{text,start,end}]}] }
export function mapAlignedWords(blocks, words) {
  const outBlocks = [];
  let cursor = 0;
  for (const block of blocks) {
    const expected = tokenizeWords(block.text);
    const emitted = [];
    for (const tok of expected) {
      const want = norm(tok.text);
      let i = cursor;
      // Re-sync: skip up to RESYNC_WINDOW aligner entries to find the exact word.
      while (i < words.length && i < cursor + RESYNC_WINDOW && norm(words[i].text) !== want) i++;
      if (i >= words.length || norm(words[i].text) !== want) {
        throw new Error(`align-map: cannot match word "${tok.text}" in block ${block.index} (drift exceeded window)`);
      }
      const w = words[i];
      emitted.push({ text: tok.text, start: round(w.start), end: round(w.end) });
      cursor = i + 1;
    }
    outBlocks.push({ index: block.index, words: emitted });
  }
  const duration = outBlocks.length
    ? round(outBlocks.flatMap(b => b.words).reduce((mx, w) => Math.max(mx, w.end), 0))
    : 0;
  return { duration, blocks: outBlocks };
}
