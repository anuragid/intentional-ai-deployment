import { collapseWhitespace } from '../../../shared/audio-tokenize.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// Remove only bracketed delivery tags (e.g. [pause], [sighs]); leave every
// spoken word and ordinary punctuation untouched. Tags are additive insertions,
// so stripping them must reproduce the clean text (modulo whitespace).
export function stripTags(text) {
  return text.replace(/\[[^\]]*\]/g, '');
}

// Sparse, contemplative, delivery-only tagging. The §6 strip-check is the
// real enforcement; the prompt just steers a good first attempt.
export function buildTagPrompt(clean) {
  return [
    'You are an audiobook director adding sparse, contemplative delivery cues',
    'to a single paragraph for an expressive TTS voice.',
    'RULES:',
    '- Return the paragraph VERBATIM. Do not change, add, reorder, or remove any',
    '  spoken word or its punctuation. Tags are ADDITIVE bracketed insertions only.',
    '- Use at most one tag for most paragraphs; a tag every few sentences at most.',
    '- Allowed delivery tags only: [pause], [sighs], [exhales], and light emphasis.',
    '- NO literal sound-effects ([door slams], [applause], music, ambience).',
    '- Quiet, reflective, never performative.',
    'Output ONLY the tagged paragraph, nothing else.',
    '',
    `Paragraph:\n${clean}`,
  ].join('\n');
}

// Default I/O impl: Anthropic Messages REST. Returns the model's text.
async function anthropicCall({ apiKey, model, prompt }, fetchImpl) {
  const f = fetchImpl || fetch;
  const res = await f(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const detail = await res.text?.().catch(() => '') ?? '';
    throw new Error(`Anthropic ${res.status}: ${detail}`);
  }
  const json = await res.json();
  return (json.content?.[0]?.text ?? '').trim();
}

// blocks: [{index, text}]  ->  [{index, clean, tagged}]
// callImpl({apiKey, model, clean, prompt}) -> tagged string  (injectable for tests)
export async function tagBlocks(blocks, { apiKey, model, callImpl, onWarn = console.warn } = {}) {
  const call = callImpl || ((args, fetchImpl) => anthropicCall(args, fetchImpl));
  const out = [];
  for (const b of blocks) {
    const clean = b.text;
    const prompt = buildTagPrompt(clean);
    let tagged = clean;
    try {
      const raw = await call({ apiKey, model, clean, prompt });
      // Enforce the additive-only invariant; otherwise fall back safely.
      if (collapseWhitespace(stripTags(raw)) === clean) tagged = raw;
      else onWarn(`[tag] block ${b.index}: tag-strip mismatch, using clean text`);
    } catch (e) {
      onWarn(`[tag] block ${b.index}: ${e.message}; using clean text`);
    }
    out.push({ index: b.index, clean, tagged });
  }
  return out;
}
