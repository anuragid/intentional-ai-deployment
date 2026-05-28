import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import process from 'node:process';
import admin from 'firebase-admin';

import { parseArgs } from './lib/cli.js';
import { extractBlocks } from './lib/extract.js';
import { chunkBlocks, JOIN_SEPARATOR } from './lib/chunk.js';
import { estimateCost } from './lib/cost.js';
import { mapNarration } from './lib/map.js';
import {
  synthesizeWithTimestamps, createPodcast, pollProjectUntilDone, downloadPodcastAudio,
} from './lib/elevenlabs.js';
import { uploadArtifacts, buildManifest } from './lib/upload.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = resolve(__dirname, '../../articles');

function env(name, required = true) {
  const v = process.env[name];
  if (required && !v) throw new Error(`Missing env ${name}`);
  return v;
}

function articleSlugs(arg) {
  if (arg !== 'all') return [arg];
  return readdirSync(ARTICLES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);
}

function readArticleHtml(slug) {
  return readFileSync(resolve(ARTICLES_DIR, slug, 'index.html'), 'utf8');
}

async function buildNarration(slug, blocks, cfg) {
  const chunkGroups = chunkBlocks(blocks);
  const audioParts = [];
  const alignments = [];
  const chunks = [];
  for (const group of chunkGroups) {
    const text = group.map(b => b.text).join(JOIN_SEPARATOR);
    const { audio, alignment } = await synthesizeWithTimestamps(text, {
      apiKey: cfg.apiKey, voiceId: cfg.narrationVoiceId, modelId: cfg.modelId,
    });
    const dur = alignment.character_end_times_seconds.at(-1) ?? 0;
    audioParts.push(audio);
    alignments.push(alignment);
    chunks.push({ blocks: group, text, audioDuration: dur });
  }
  const timings = mapNarration(chunks, alignments);
  return { mp3: Buffer.concat(audioParts), json: timings };
}

async function buildPodcast(slug, blocks, cfg) {
  const text = blocks.map(b => b.text).join('\n\n');
  const { projectId } = await createPodcast({
    apiKey: cfg.apiKey, modelId: cfg.modelId,
    source: { type: 'text', text },
    hostVoiceId: cfg.podcastHostVoiceId, guestVoiceId: cfg.podcastGuestVoiceId,
    instructionsPrompt: 'Contemplative, thoughtful two-host discussion. Calm pacing, no hype.',
  });
  await pollProjectUntilDone({ apiKey: cfg.apiKey, projectId });
  const mp3 = await downloadPodcastAudio({ apiKey: cfg.apiKey, projectId });
  return { mp3, json: { duration: 0, transcript: [] } }; // transcript best-effort; fill if project exposes it
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Secrets and Firebase are only needed for a real run; --dry-run just reports
  // block counts and cost estimates from the local HTML.
  let cfg = null;
  let bucket = null;
  if (!args.dryRun) {
    cfg = {
      apiKey: env('ELEVENLABS_API_KEY'),
      modelId: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2',
      narrationVoiceId: env('ELEVENLABS_NARRATION_VOICE_ID', args.mode !== 'podcast'),
      podcastHostVoiceId: env('ELEVENLABS_PODCAST_HOST_VOICE_ID', args.mode !== 'narration'),
      podcastGuestVoiceId: env('ELEVENLABS_PODCAST_GUEST_VOICE_ID', args.mode !== 'narration'),
    };
    admin.initializeApp({ storageBucket: env('FIREBASE_STORAGE_BUCKET') });
    bucket = admin.storage().bucket();
  }

  for (const slug of articleSlugs(args.article)) {
    const blocks = extractBlocks(readArticleHtml(slug));
    console.log(`\n[${slug}] ${blocks.length} blocks. ${estimateCost(blocks).summary}`);
    if (args.dryRun) continue;

    const modes = {};
    const files = [];
    if (args.mode === 'narration' || args.mode === 'both') {
      const n = await buildNarration(slug, blocks, cfg);
      files.push(
        { name: 'narration.mp3', buffer: n.mp3, contentType: 'audio/mpeg' },
        { name: 'narration.json', buffer: Buffer.from(JSON.stringify(n.json)), contentType: 'application/json' },
      );
      modes.narration = { duration: n.json.duration };
      console.log(`[${slug}] narration ${n.json.duration}s, ${n.mp3.length} bytes`);
    }
    if (args.mode === 'podcast' || args.mode === 'both') {
      const p = await buildPodcast(slug, blocks, cfg);
      files.push(
        { name: 'podcast.mp3', buffer: p.mp3, contentType: 'audio/mpeg' },
        { name: 'podcast.json', buffer: Buffer.from(JSON.stringify(p.json)), contentType: 'application/json' },
      );
      modes.podcast = { duration: p.json.duration };
      console.log(`[${slug}] podcast ${p.mp3.length} bytes`);
    }
    const manifest = buildManifest(slug, modes);
    files.push({ name: 'manifest.json', buffer: Buffer.from(JSON.stringify(manifest)), contentType: 'application/json' });
    await uploadArtifacts(bucket, slug, files);
    console.log(`[${slug}] uploaded ${files.length} files to audio/${slug}/`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
