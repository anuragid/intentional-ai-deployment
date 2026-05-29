// Remove only bracketed delivery tags (e.g. [pause], [sighs]); leave every
// spoken word and ordinary punctuation untouched. Tags are additive insertions,
// so stripping them must reproduce the clean text (modulo whitespace).
export function stripTags(text) {
  return text.replace(/\[[^\]]*\]/g, '');
}
