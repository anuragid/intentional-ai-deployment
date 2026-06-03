import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { extractBlocks } from '../lib/extract.js';
import { sameWords } from '../lib/enhance.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = resolve(__dirname, '../../../articles');
const NARRATION_DIR = __dirname;

const artifacts = readdirSync(NARRATION_DIR).filter((f) => f.endsWith('.json'));

test('there is a narration artifact for every article', () => {
  const articleSlugs = readdirSync(ARTICLES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const artifactSlugs = artifacts.map((f) => f.replace(/\.json$/, '')).sort();
  assert.deepEqual(artifactSlugs, articleSlugs);
});

// Karaoke is dormant, so `enhanced` (the spoken text) is free to reshape for
// delivery. What must NOT drift is the stored `clean` snapshot: it is the
// staleness anchor loadEnhanced compares against the live article. If `clean`
// matches live for every block, no committed transcript is stale (which would
// otherwise silently fall back to flat clean text at build time).
test('every artifact block carries enhanced text and a clean snapshot synced to the live article', () => {
  for (const file of artifacts) {
    const slug = file.replace(/\.json$/, '');
    const data = JSON.parse(readFileSync(resolve(NARRATION_DIR, file), 'utf8'));
    const live = extractBlocks(readFileSync(resolve(ARTICLES_DIR, slug, 'index.html'), 'utf8'));
    const byIndex = new Map(data.blocks.map((b) => [b.index, b]));
    for (const b of live) {
      const entry = byIndex.get(b.index);
      assert.ok(entry, `${slug}: missing artifact block ${b.index}`);
      assert.ok(typeof entry.enhanced === 'string' && entry.enhanced.trim().length > 0,
        `${slug} block ${b.index}: enhanced text missing/empty`);
      assert.ok(sameWords(entry.clean, b.text),
        `${slug} block ${b.index}: clean snapshot drifted from the article — re-author this block`);
    }
  }
});
