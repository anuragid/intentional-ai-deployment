// One-time helper: scaffold tools/audio/narration/<slug>.json from live
// article extraction with `enhanced = clean` (valid by construction). Then
// hand-author the `enhanced` fields per the design's §5 authoring guide.
// Usage:  node scaffold-narration.mjs [slug|all] [--force]
// Refuses to overwrite an existing artifact unless --force is passed.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { extractBlocks } from './lib/extract.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = resolve(__dirname, '../../articles');
const OUT_DIR = resolve(__dirname, 'narration');

const args = process.argv.slice(2);
const force = args.includes('--force');
const slugArg = args.find((a) => !a.startsWith('--')) || 'all';
const slugs = slugArg === 'all'
  ? readdirSync(ARTICLES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [slugArg];

mkdirSync(OUT_DIR, { recursive: true });
for (const slug of slugs) {
  const out = resolve(OUT_DIR, `${slug}.json`);
  if (existsSync(out) && !force) { console.log(`skip ${slug} (exists; --force to overwrite)`); continue; }
  const html = readFileSync(resolve(ARTICLES_DIR, slug, 'index.html'), 'utf8');
  const blocks = extractBlocks(html).map((b) => ({ index: b.index, clean: b.text, enhanced: b.text }));
  writeFileSync(out, JSON.stringify({ slug, blocks }, null, 2) + '\n');
  console.log(`wrote ${out} (${blocks.length} blocks)`);
}
