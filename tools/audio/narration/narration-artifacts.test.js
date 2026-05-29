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

test('every enhanced block stays word-synced to its live article block', () => {
  for (const file of artifacts) {
    const slug = file.replace(/\.json$/, '');
    const data = JSON.parse(readFileSync(resolve(NARRATION_DIR, file), 'utf8'));
    const live = extractBlocks(readFileSync(resolve(ARTICLES_DIR, slug, 'index.html'), 'utf8'));
    const byIndex = new Map(data.blocks.map((b) => [b.index, b]));
    for (const b of live) {
      const entry = byIndex.get(b.index);
      assert.ok(entry, `${slug}: missing enhanced block ${b.index}`);
      assert.ok(sameWords(entry.enhanced, b.text),
        `${slug} block ${b.index}: enhanced words drift from the article`);
    }
  }
});
