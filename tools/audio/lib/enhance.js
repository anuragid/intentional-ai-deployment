import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { tokenizeWords } from '../../../shared/audio-tokenize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = resolve(__dirname, '../narration');

// Remove only bracketed delivery tags (e.g. [sighs], [pause]). Leave spoken
// words, ellipses, capitalization, and ordinary punctuation untouched.
export function stripTags(text) {
  return text.replace(/\[[^\]]*\]/g, '');
}

// The spoken-word sequence of a string. Mirrors EXACTLY the tokenizer the
// karaoke mapper uses (align-map.js): strip tags, split on whitespace
// (tokenizeWords), then drop every non-alphanumeric WITHIN each token without
// inserting a separator and lowercase. This keeps the guard identical to the
// runtime path, so e.g. "state-of-the-art" stays one token (not four) just as
// the aligner sees it. Two strings with an equal result carry the same spoken
// words in the same order regardless of tags, caps, ellipses, or punctuation.
export function normalizeWords(text) {
  return tokenizeWords(stripTags(text))
    .map((t) => t.text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
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
