import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapNarration } from './map.js';

// One chunk, two blocks joined by '\n\n'. Build a fake alignment where each
// character takes 0.1s sequentially.
function fakeAlignment(text, t0 = 0) {
  const characters = [...text];
  const character_start_times_seconds = characters.map((_, i) => +(t0 + i * 0.1).toFixed(4));
  const character_end_times_seconds = characters.map((_, i) => +(t0 + (i + 1) * 0.1).toFixed(4));
  return { characters, character_start_times_seconds, character_end_times_seconds };
}

test('mapNarration maps words to absolute times across blocks', () => {
  const blocks = [{ index: 0, text: 'AI wins' }, { index: 1, text: 'Go now' }];
  const chunkText = 'AI wins\n\nGo now';
  const result = mapNarration(
    [{ blocks, text: chunkText, audioDuration: chunkText.length * 0.1 }],
    [fakeAlignment(chunkText)],
  );
  assert.equal(result.blocks.length, 2);
  const ai = result.blocks[0].words[0];
  assert.equal(ai.text, 'AI');
  assert.equal(ai.start, 0);                 // char 0
  assert.ok(Math.abs(ai.end - 0.2) < 1e-6);  // chars 0..1 -> end of char index1
  const go = result.blocks[1].words[0];
  assert.equal(go.text, 'Go');
  // 'Go' starts at char index 9 in chunkText -> 0.9s
  assert.ok(Math.abs(go.start - 0.9) < 1e-6);
});

test('mapNarration offsets a second chunk by accumulated duration', () => {
  const b0 = [{ index: 0, text: 'one' }];
  const b1 = [{ index: 1, text: 'two' }];
  const c0 = { blocks: b0, text: 'one', audioDuration: 0.3 };
  const c1 = { blocks: b1, text: 'two', audioDuration: 0.3 };
  const result = mapNarration([c0, c1], [fakeAlignment('one'), fakeAlignment('two')]);
  // block 1 word 'two' should start at 0.3 (offset) + 0
  assert.ok(Math.abs(result.blocks[1].words[0].start - 0.3) < 1e-6);
});
