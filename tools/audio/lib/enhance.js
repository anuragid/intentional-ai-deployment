import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { collapseWhitespace } from '../../../shared/audio-tokenize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = resolve(__dirname, '../narration');

// Remove only bracketed delivery tags (e.g. [sighs], [pause]). Leave spoken
// words, ellipses, capitalization, and ordinary punctuation untouched.
export function stripTags(text) {
  return text.replace(/\[[^\]]*\]/g, '');
}

// The spoken-word sequence of a string: strip tags, lowercase, turn every
// non-letter/non-digit (punctuation, ellipses, dashes) into a separator,
// collapse whitespace, split. Two strings with an equal result carry the same
// words in the same order regardless of tags, caps, ellipses, or punctuation.
export function normalizeWords(text) {
  const noTags = stripTags(text).toLowerCase();
  const wordsOnly = noTags.replace(/[^\p{L}\p{N}\s]+/gu, ' ');
  const collapsed = collapseWhitespace(wordsOnly);
  return collapsed ? collapsed.split(' ') : [];
}

export function sameWords(a, b) {
  const wa = normalizeWords(a);
  const wb = normalizeWords(b);
  if (wa.length !== wb.length) return false;
  for (let i = 0; i < wa.length; i++) if (wa[i] !== wb[i]) return false;
  return true;
}

// Load the committed enhanced transcript for `slug` and align it to the LIVE
// article blocks. Returns [{ index, clean, tagged }] where `clean` is always
// the live block text (so downstream alignment + DOM mapping use the current
// article). A missing file, missing index, or word-altered (stale) entry falls
// that block back to `tagged = clean` (+ warning) so a build never desyncs the
// karaoke highlight.
export function loadEnhanced(slug, blocks, { dir = DEFAULT_DIR, onWarn = console.warn, readImpl } = {}) {
  const read = readImpl || ((p) => readFileSync(p, 'utf8'));
  const byIndex = new Map();
  try {
    const data = JSON.parse(read(resolve(dir, `${slug}.json`)));
    for (const b of (data.blocks || [])) byIndex.set(b.index, b);
  } catch (e) {
    onWarn(`[enhance] ${slug}: no usable artifact (${e.message}); using clean text`);
  }
  return blocks.map((b) => {
    const entry = byIndex.get(b.index);
    if (entry && typeof entry.enhanced === 'string' && sameWords(entry.enhanced, b.text)) {
      return { index: b.index, clean: b.text, tagged: entry.enhanced };
    }
    if (byIndex.size) onWarn(`[enhance] ${slug} block ${b.index}: missing/stale enhanced text; using clean`);
    return { index: b.index, clean: b.text, tagged: b.text };
  });
}
