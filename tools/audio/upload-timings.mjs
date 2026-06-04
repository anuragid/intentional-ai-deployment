// Upload ONLY the regenerated narration.json timing files to Firebase Storage.
// No audio re-render, no manifest change (deployed manifests already reference
// audio/<slug>/narration.json). Use after realign.mjs.
//
// Usage (from repo root):
//   node --env-file=.env tools/audio/upload-timings.mjs                 # all local timings
//   node --env-file=.env tools/audio/upload-timings.mjs <slug> [slug2]

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import process from 'node:process';
import admin from 'firebase-admin';
import { uploadArtifacts } from './lib/upload.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = resolve(__dirname, '../../audio');

const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
if (!bucketName) { console.error('Missing FIREBASE_STORAGE_BUCKET (run with --env-file=.env)'); process.exit(1); }

admin.initializeApp({ storageBucket: bucketName });
const bucket = admin.storage().bucket();

function timingSlugs() {
  return readdirSync(AUDIO_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(slug => existsSync(resolve(AUDIO_DIR, slug, 'narration.json')));
}

const slugs = process.argv.slice(2).length ? process.argv.slice(2) : timingSlugs();
console.log(`Uploading timings → gs://${bucketName}/audio/<slug>/narration.json\n  ${slugs.join(', ')}\n`);

let fail = 0;
for (const slug of slugs) {
  const path = resolve(AUDIO_DIR, slug, 'narration.json');
  if (!existsSync(path)) { console.error(`[${slug}] no narration.json — skipped`); fail++; continue; }
  const buffer = readFileSync(path);
  const json = JSON.parse(buffer);          // validate it parses + has words
  const words = (json.blocks || []).reduce((n, b) => n + (b.words?.length || 0), 0);
  if (!words) { console.error(`[${slug}] narration.json has 0 words — refusing to upload an empty stub`); fail++; continue; }
  try {
    await uploadArtifacts(bucket, slug, [{ name: 'narration.json', buffer, contentType: 'application/json' }]);
    console.log(`[${slug}] uploaded ${statSync(path).size} bytes, ${words} words`);
  } catch (e) { console.error(`[${slug}] upload FAILED: ${e.message}`); fail++; }
}
process.exit(fail ? 1 : 0);
