import { JOIN_SEPARATOR } from './chunk.js';
import { tokenizeWords } from '../../../shared/audio-tokenize.js';

// For a char offset within a chunk, return the time at that char's start.
function timeAtChar(alignment, charIndex, which) {
  const arr = which === 'end'
    ? alignment.character_end_times_seconds
    : alignment.character_start_times_seconds;
  const clamped = Math.max(0, Math.min(charIndex, arr.length - 1));
  return arr[clamped];
}

// chunks: [{ blocks:[{index,text}], text, audioDuration }]
// alignments: per-chunk ElevenLabs alignment objects (same order)
export function mapNarration(chunks, alignments) {
  const outBlocks = [];
  let timeOffset = 0;
  chunks.forEach((chunk, ci) => {
    const alignment = alignments[ci];
    let blockCharCursor = 0;
    chunk.blocks.forEach((block, bi) => {
      const blockStartInChunk = blockCharCursor;
      const words = tokenizeWords(block.text).map((tok) => {
        const gStart = blockStartInChunk + tok.charStart;
        const gEnd = blockStartInChunk + tok.charEnd - 1; // last char index
        return {
          text: tok.text,
          start: +(timeOffset + timeAtChar(alignment, gStart, 'start')).toFixed(4),
          end: +(timeOffset + timeAtChar(alignment, gEnd, 'end')).toFixed(4),
        };
      });
      outBlocks.push({ index: block.index, words });
      // advance cursor past this block + separator (except after last block)
      blockCharCursor += block.text.length;
      if (bi < chunk.blocks.length - 1) blockCharCursor += JOIN_SEPARATOR.length;
    });
    timeOffset += chunk.audioDuration;
  });
  const duration = outBlocks.length
    ? outBlocks.flatMap(b => b.words).reduce((mx, w) => Math.max(mx, w.end), 0)
    : 0;
  return { duration: +duration.toFixed(4), blocks: outBlocks };
}
