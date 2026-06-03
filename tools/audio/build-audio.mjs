import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import process from 'node:process';
import admin from 'firebase-admin';

import { parseArgs } from './lib/cli.js';
import { extractBlocks } from './lib/extract.js';
import { segmentBlocks, capBlocks, JOIN_SEPARATOR } from './lib/chunk.js';
import { estimateCost } from './lib/cost.js';
import { mapNarration } from './lib/map.js';
import { pcmDurationSeconds } from './lib/pcm.js';
import { encodeMp3FromPcm, concatMp3, probeDurationSeconds, silenceMp3, silencePcm } from './lib/encode.js';
import {
  synthesizeWithTimestamps, synthesizeV3, createPodcast, pollProjectUntilDone, downloadPodcastAudio, fetchPodcastTranscript,
} from './lib/elevenlabs.js';
import { uploadArtifacts, buildManifest } from './lib/upload.js';
import { loadEnhanced } from './lib/enhance.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTICLES_DIR = resolve(__dirname, '../../articles');

// v3 contemplative read. Stability 0.5 = "Natural": responsive to delivery
// cues without v3's high-stability flatness. v3 paces via tags/punctuation,
// not a `speed` setting; `style`/`speed` are dropped (verified on first run).
const NARRATION_VOICE_SETTINGS = {
  stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true,
};
const NARRATION_MAX_CHARS = 9000; // under multilingual_v2's 10k limit, margin for normalization
// Free tier serves MP3 only; pcm_* is Pro-tier and gives the most pristine
// stitching. Override with ELEVENLABS_NARRATION_OUTPUT_FORMAT on Pro.
const NARRATION_OUTPUT_FORMAT = process.env.ELEVENLABS_NARRATION_OUTPUT_FORMAT || 'mp3_44100_192';

// v3's per-request limit is ~5000 chars; cap on the TAGGED length (tags inflate it).
const V3_MAX_CHARS = 4500;
const NARRATION_MODEL_ID = process.env.ELEVENLABS_NARRATION_MODEL_ID || 'eleven_v3';
// Breathing room inserted before each section heading (audiobook section break).
const HEADING_PAUSE_SECONDS = 0.7;
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
  // (2) enhance: load the committed expressive transcript for this article.
  // Per-block fallback to clean text on a missing/stale artifact (never desyncs).
  const enhanced = loadEnhanced(slug, blocks);

  // (3) synthesize v3: segment the ENHANCED text — consecutive prose grouped
  // into chunks, each section heading standing alone — so headings can be
  // bracketed with silence. No request stitching (eleven_v3 doesn't support it).
  const tagByIndex = new Map(blocks.map(b => [b.index, b.tag]));
  const taggedBlocks = enhanced.map(t => ({ index: t.index, text: t.tagged, tag: tagByIndex.get(t.index) }));
  const segments = segmentBlocks(taggedBlocks, V3_MAX_CHARS);
  const segAudio = [];
  for (const seg of segments) {
    // A heading-led segment carries the heading AND its following prose in one
    // request, so v3 reads the heading in natural flow (it has no out-of-band
    // context and reads lone fragments flat).
    const text = seg.blocks.map(b => b.text).join(JOIN_SEPARATOR);
    const { audio } = await synthesizeV3(text, {
      apiKey: cfg.apiKey, voiceId: cfg.narrationVoiceId, modelId: cfg.narrationModelId,
      outputFormat: fmt, voiceSettings: NARRATION_VOICE_SETTINGS,
    });
    segAudio.push(audio);
  }

  // (4) concat: gapless single file, with a beat of silence BEFORE each section
  // heading (the audiobook section break). The pause AFTER the heading is the
  // natural in-request beat between the spoken title and its first sentence.
  const silence = isPcm
    ? silencePcm(HEADING_PAUSE_SECONDS, { sampleRate: 44100, channels: 1 })
    : await silenceMp3(HEADING_PAUSE_SECONDS, { bitrate });
  const audioParts = [];
  for (let i = 0; i < segAudio.length; i++) {
    if (i > 0 && segments[i].headingLed) audioParts.push(silence);
    audioParts.push(segAudio[i]);
  }

  const mp3 = isPcm
    ? await encodeMp3FromPcm(Buffer.concat(audioParts), { sampleRate: 44100, channels: 1, bitrate: '192k' })
    : await concatMp3(audioParts, { bitrate });
  const encodedDuration = isPcm
    ? pcmDurationSeconds(Buffer.concat(audioParts).length)
    : await probeDurationSeconds(mp3);

  // (5) timings: karaoke is dormant (read-along dropped to maximize audio
  // quality — the director is free to reshape spoken text, which would desync
  // word-level highlight). We still emit a player-compatible narration.json so
  // the player's timings fetch never 404s; `blocks: []` => no highlight, audio
  // plays. Re-introduce forced-alignment here if word-sync is ever wanted.
  const timings = { duration: round4(encodedDuration), blocks: [] };

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
      console.log(`[${slug}] v3 narration: directed text is billed per character (tags + reshaping inflate it beyond the ~${estimateCost(blocks).narrationChars} clean chars). No forced-alignment call (karaoke dormant). No LLM tagging cost (committed transcripts).`);
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
