// Rough one-time cost estimate for --dry-run. Rates are indicative only.
const USD_PER_1K_CHARS = 0.30; // adjust to your ElevenLabs plan

export function estimateCost(blocks) {
  const narrationChars = blocks.reduce((n, b) => n + b.text.length, 0);
  const usd = (narrationChars / 1000) * USD_PER_1K_CHARS;
  return {
    narrationChars,
    estimatedUsd: Number(usd.toFixed(2)),
    summary: `Narration: ${narrationChars} chars (~$${usd.toFixed(2)}). Podcast billed separately by ElevenLabs.`,
  };
}
