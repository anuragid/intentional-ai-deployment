import { tokenizeWords } from '../../../shared/audio-tokenize.js';

const RESYNC_WINDOW = 6;   // entries to scan when re-syncing on aligner drift
const LOOSE_LOOKAHEAD = 4; // real aligner words to scan past a spurious split
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

// Gap-tolerant variant. ElevenLabs forced-alignment returns ONLY the transcript
// words it could place in the audio, in reading order — so when the narrator
// skips inline citations like "(Ryseff et al., 2024)", those clean tokens have
// NO aligned counterpart. The aligned words are thus a SUBSEQUENCE of the clean
// tokens. We walk the clean tokens against that subsequence: a clean token that
// the aligner skipped (unspoken) gets a zero-width timing at the previous word's
// end, so the read-along highlight glides over it instead of stalling.
//
// blocks: [{index, text}] (CLEAN text sent to alignment, same order)
// words:  flat aligned [{text,start,end,...}] in reading order
// -> { duration, blocks:[{index, words:[{start,end}]}], skipped }
export function mapAlignedWordsLoose(blocks, words) {
  // Drop whitespace/punctuation-only aligner entries up front.
  const real = words.filter(w => norm(w.text) !== '');
  const outBlocks = [];
  let cursor = 0;
  let lastEnd = 0;
  let skipped = 0;
  for (const block of blocks) {
    const emitted = [];
    for (const tok of tokenizeWords(block.text)) {
      const want = norm(tok.text);
      // Scan a small lookahead for the next spoken match (tolerates a stray
      // aligner split). A real match advances the cursor; no match means the
      // narrator skipped this token.
      let found = -1;
      for (let i = cursor; i < real.length && i < cursor + LOOSE_LOOKAHEAD; i++) {
        if (norm(real[i].text) === want) { found = i; break; }
      }
      if (found >= 0) {
        const w = real[found];
        emitted.push({ text: tok.text, start: round(w.start), end: round(w.end) });
        lastEnd = w.end;
        cursor = found + 1;
      } else {
        // Unspoken (citation, dropped word): zero-width at the prior word's end.
        emitted.push({ text: tok.text, start: round(lastEnd), end: round(lastEnd) });
        skipped++;
      }
    }
    outBlocks.push({ index: block.index, words: emitted });
  }
  const duration = outBlocks.length
    ? round(outBlocks.flatMap(b => b.words).reduce((mx, w) => Math.max(mx, w.end), 0))
    : 0;
  return { duration, blocks: outBlocks, skipped };
}
