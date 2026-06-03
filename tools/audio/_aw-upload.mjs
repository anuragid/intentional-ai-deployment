// Upload ALREADY-BUILT narration artifacts from local audio/<slug>/ to Firebase
// Storage. No ElevenLabs re-render — just publishes the existing mp3/json/manifest.
// Run: node --env-file=.env tools/audio/_aw-upload.mjs [slug ...]
//   (no slugs = all five). Requires GOOGLE_APPLICATION_CREDENTIALS + FIREBASE_STORAGE_BUCKET.
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { uploadArtifacts } from './lib/upload.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '../..');
const AUDIO = resolve(REPO, 'audio');

const ALL = ['what-ai-cant-see', 'before-you-automate', 'cost-of-speed', 'designing-around-gaps', 'friction-reduction'];
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
if (!bucketName) { console.error('Missing FIREBASE_STORAGE_BUCKET'); process.exit(1); }
admin.initializeApp({ storageBucket: bucketName });
const bucket = admin.storage().bucket();

const FILES = [
  { name: 'narration.mp3', contentType: 'audio/mpeg' },
  { name: 'narration.json', contentType: 'application/json' },
  { name: 'manifest.json', contentType: 'application/json' },
];

for (const slug of slugs) {
  const dir = resolve(AUDIO, slug);
  const files = [];
  for (const f of FILES) {
    const p = resolve(dir, f.name);
    if (!existsSync(p)) { console.error(`MISSING ${p} — build it first (--local-out audio)`); process.exit(1); }
    files.push({ name: f.name, buffer: readFileSync(p), contentType: f.contentType });
  }
  await uploadArtifacts(bucket, slug, files);
  const mb = (files[0].buffer.length / 1048576).toFixed(1);
  console.log(`✓ uploaded ${slug} -> audio/${slug}/ (mp3 ${mb} MB) on ${bucketName}`);
}
console.log(`\nDone. ${slugs.length} article(s) published to Firebase Storage.`);
