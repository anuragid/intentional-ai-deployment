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
  synthesizeWithTimestamps, synthesizeV3, createPodcast, pollProjectUntilDone, downloadPodcastAudio, fetchPodcastTranscript,
} from './lib/elevenlabs.js';
import { uploadArtifacts, buildManifest } from './lib/upload.js';
import { tagBlocks } from './lib/tag.js';
import { forcedAlign } from './lib/align.js';
import { mapAlignedWords } from './lib/align-map.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = resolve(__dirname, '../../articles');

// Steady, contemplative read (see plan amendment A4).
const NARRATION_VOICE_SETTINGS = {
  stability: 0.6, similarity_boost: 0.75, style: 0, speed: 0.95, use_speaker_boost: true,
};
const NARRATION_MAX_CHARS = 9000; // under multilingual_v2's 10k limit, margin for normalization
// Free tier serves MP3 only; pcm_* is Pro-tier and gives the most pristine
// stitching. Override with ELEVENLABS_NARRATION_OUTPUT_FORMAT on Pro.
const NARRATION_OUTPUT_FORMAT = process.env.ELEVENLABS_NARRATION_OUTPUT_FORMAT || 'mp3_44100_192';

// v3's per-request limit is ~5000 chars; cap on the TAGGED length (tags inflate it).
const V3_MAX_CHARS = 4500;
const NARRATION_MODEL_ID = process.env.ELEVENLABS_NARRATION_MODEL_ID || 'eleven_v3';
const ALIGNMENT_LOSS_MAX = 0.5;     // per-article quality gate (tune on first real run)
const round4 = (n) => +Number(n).toFixed(4);

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
  const bitrate = `${fmt.match(/mp3_\d+_(\d+)/)?.[1] ?? '192'}k`;

  // (1) extract already done by caller -> `blocks` are the CLEAN blocks.
  // (2) tag: clean -> tagged (additive only; strip-check fallback inside).
  const tagged = await tagBlocks(blocks, { apiKey: cfg.anthropicApiKey, model: cfg.anthropicModel });

  // (3) synthesize v3: chunk the TAGGED text on block boundaries; no stitching.
  const taggedBlocks = tagged.map(t => ({ index: t.index, text: t.tagged }));
  const chunkGroups = chunkBlocks(taggedBlocks, V3_MAX_CHARS);
  const audioParts = [];
  for (const group of chunkGroups) {
    const text = group.map(b => b.text).join(JOIN_SEPARATOR);
    const { audio } = await synthesizeV3(text, {
      apiKey: cfg.apiKey, voiceId: cfg.narrationVoiceId, modelId: cfg.narrationModelId,
      outputFormat: fmt, voiceSettings: NARRATION_VOICE_SETTINGS,
    });
    audioParts.push(audio);
  }

  // (4) concat: gapless single file + true encoded duration.
  const mp3 = isPcm
    ? await encodeMp3FromPcm(Buffer.concat(audioParts), { sampleRate: 44100, channels: 1, bitrate: '192k' })
    : await concatMp3(audioParts, { bitrate });
  const encodedDuration = isPcm
    ? pcmDurationSeconds(Buffer.concat(audioParts).length)
    : await probeDurationSeconds(mp3);

  // (5) align: full mp3 vs full CLEAN transcript (tag-free).
  const cleanBlocks = tagged.map(t => ({ index: t.index, text: t.clean }));
  const transcript = cleanBlocks.map(b => b.text).join(JOIN_SEPARATOR);
  const alignment = await forcedAlign({ apiKey: cfg.apiKey, audio: mp3, transcript, contentType: 'audio/mpeg' });

  // quality gate: reject drifting karaoke rather than ship it.
  if (typeof alignment.loss === 'number' && alignment.loss > ALIGNMENT_LOSS_MAX) {
    throw new Error(`[${slug}] forced-alignment loss ${alignment.loss} > ${ALIGNMENT_LOSS_MAX}`);
  }

  // (6) map: aligned words -> narration.json (player-compatible shape).
  const timings = mapAlignedWords(cleanBlocks, alignment.words);
  const drift = Math.abs(timings.duration - encodedDuration);
  if (drift > 2.0) {
    console.warn(`[${slug}] alignment max-end ${timings.duration}s vs encoded ${encodedDuration.toFixed(2)}s (drift ${drift.toFixed(2)}s)`);
  }
  timings.duration = round4(encodedDuration); // trust the encoded file for total length

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
      narrationModelId: NARRATION_MODEL_ID,
      anthropicApiKey: env('ANTHROPIC_API_KEY', args.mode !== 'podcast'),
      anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-opus-4-8',
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
    if (args.dryRun) {
      const taggedCharsNote = 'tagged-char count ~= clean + a few tags/block';
      console.log(`[${slug}] v3 narration: ~${estimateCost(blocks).narrationChars} clean chars (${taggedCharsNote}); + 1 forced-alignment call (paid, per-file); + 1 Claude tagging pass per block.`);
      continue;
    }

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
