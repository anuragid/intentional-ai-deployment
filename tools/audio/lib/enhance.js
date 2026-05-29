import { collapseWhitespace } from '../../../shared/audio-tokenize.js';

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
