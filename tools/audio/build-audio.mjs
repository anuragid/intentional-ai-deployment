import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import process from 'node:process';
import admin from 'firebase-admin';

import { parseArgs } from './lib/cli.js';
import { extractBlocks } from './lib/extract.js';
import { chunkBlocks, capBlocks, JOIN_SEPARATOR } from './lib/chunk.js';
import { estimateCost } from './lib/cost.js';
import { mapNarration } from './lib/map.js';
import { pcmDurationSeconds } from './lib/pcm.js';
import { encodeMp3FromPcm, concatMp3, probeDurationSeconds } from './lib/encode.js';
import {
  synthesizeWithTimestamps, createPodcast, pollProjectUntilDone, downloadPodcastAudio, fetchPodcastTranscript,
} from './lib/elevenlabs.js';
import { uploadArtifacts, buildManifest } from './lib/upload.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = resolve(__dirname, '../../articles');

// Steady, contemplative read (see plan amendment A4).
const NARRATION_VOICE_SETTINGS = {
  stability: 0.6, similarity_boost: 0.75, style: 0, speed: 0.95, use_speaker_boost: true,
};
const NARRATION_MAX_CHARS = 9000; // under multilingual_v2's 10k limit, margin for normalization
// Free tier serves MP3 only; pcm_* is Pro-tier and gives the most pristine
// stitching. Override with ELEVENLABS_NARRATION_OUTPUT_FORMAT on Pro.
const NARRATION_OUTPUT_FORMAT = process.env.ELEVENLABS_NARRATION_OUTPUT_FORMAT || 'mp3_44100_128';

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
  const fmt = cfg.narrationOutputFormat;
  const isPcm = fmt.startsWith('pcm');
  const bitrate = `${fmt.match(/mp3_\d+_(\d+)/)?.[1] ?? '128'}k`;
  const chunkGroups = chunkBlocks(blocks, NARRATION_MAX_CHARS);
  const audioParts = [];
  const alignments = [];
  const chunks = [];
  const prevRequestIds = [];          // request-stitching chain for prosody continuity
  for (const group of chunkGroups) {
    const text = group.map(b => b.text).join(JOIN_SEPARATOR);
    const { audio, alignment, requestId } = await synthesizeWithTimestamps(text, {
      apiKey: cfg.apiKey, voiceId: cfg.narrationVoiceId, modelId: cfg.modelId,
      outputFormat: fmt, voiceSettings: NARRATION_VOICE_SETTINGS,
      previousRequestIds: prevRequestIds.slice(-3),
    });
    audioParts.push(audio);
    alignments.push(alignment);
    // True per-chunk duration: PCM sample count (Pro) or ffprobe (MP3) — never
    // the last char-end-time, which omits trailing silence and would drift.
    const dur = isPcm ? pcmDurationSeconds(audio.length) : await probeDurationSeconds(audio);
    chunks.push({ blocks: group, text, audioDuration: dur });
    if (requestId) prevRequestIds.push(requestId);
  }
  const timings = mapNarration(chunks, alignments);
  // PCM path: concat samples + encode once. MP3 path: gapless ffmpeg concat.
  const mp3 = isPcm
    ? await encodeMp3FromPcm(Buffer.concat(audioParts), { sampleRate: 44100, channels: 1, bitrate: '192k' })
    : await concatMp3(audioParts, { bitrate });
  return { mp3, json: timings };
}

async function buildPodcast(slug, blocks, cfg) {
  const text = blocks.map(b => b.text).join('\n\n');
  const { projectId } = await createPodcast({
    apiKey: cfg.apiKey, modelId: cfg.modelId,
    source: { type: 'text', text },
    hostVoiceId: cfg.podcastHostVoiceId, guestVoiceId: cfg.podcastGuestVoiceId,
    instructionsPrompt: 'Contemplative, thoughtful two-host discussion. Calm pacing, no hype.',
    durationScale: 'default', qualityPreset: 'high',
  });
  await pollProjectUntilDone({ apiKey: cfg.apiKey, projectId });
  const mp3 = await downloadPodcastAudio({ apiKey: cfg.apiKey, projectId });
  const transcript = await fetchPodcastTranscript({
    apiKey: cfg.apiKey, projectId,
    hostVoiceId: cfg.podcastHostVoiceId, guestVoiceId: cfg.podcastGuestVoiceId,
  });
  return { mp3, json: { duration: 0, transcript } };
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
      narrationOutputFormat: NARRATION_OUTPUT_FORMAT,
      narrationVoiceId: env('ELEVENLABS_NARRATION_VOICE_ID', args.mode !== 'podcast'),
      podcastHostVoiceId: env('ELEVENLABS_PODCAST_HOST_VOICE_ID', args.mode !== 'narration'),
      podcastGuestVoiceId: env('ELEVENLABS_PODCAST_GUEST_VOICE_ID', args.mode !== 'narration'),
    };
    // --local-out writes artifacts to disk instead of Firebase (no service account needed).
    if (!args.localOut) {
      admin.initializeApp({ storageBucket: env('FIREBASE_STORAGE_BUCKET') });
      bucket = admin.storage().bucket();
    }
  }

  for (const slug of articleSlugs(args.article)) {
    let blocks = extractBlocks(readArticleHtml(slug));
    if (args.maxChars) {
      const capped = capBlocks(blocks, args.maxChars);
      console.log(`[${slug}] --max-chars ${args.maxChars}: using ${capped.length}/${blocks.length} blocks`);
      blocks = capped;
    }
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

    if (args.localOut) {
      const dir = resolve(args.localOut, slug);
      mkdirSync(dir, { recursive: true });
      for (const f of files) writeFileSync(resolve(dir, f.name), f.buffer);
      console.log(`[${slug}] wrote ${files.length} files to ${dir}`);
    } else {
      await uploadArtifacts(bucket, slug, files);
      console.log(`[${slug}] uploaded ${files.length} files to audio/${slug}/`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
