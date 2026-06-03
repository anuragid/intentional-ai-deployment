import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Run a command, feeding `input` (Buffer|null) to stdin, collecting stdout bytes.
function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    const out = [];
    const err = [];
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => err.push(d));
    p.on('error', (e) => reject(new Error(`${cmd} failed to start (installed?): ${e.message}`)));
    p.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`${cmd} exited ${code}: ${Buffer.concat(err).toString()}`));
    });
    if (input) { p.stdin.on('error', () => {}); p.stdin.write(input); }
    p.stdin.end();
  });
}

// Encode raw PCM (S16LE) to MP3 via ffmpeg. Used for the Pro-tier PCM path
// (concatenate PCM sample-accurately, then encode once — pristine + gapless).
export async function encodeMp3FromPcm(pcm, { sampleRate = 44100, channels = 1, bitrate = '192k' } = {}) {
  return run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 's16le', '-ar', String(sampleRate), '-ac', String(channels), '-i', 'pipe:0',
    '-codec:a', 'libmp3lame', '-b:a', bitrate, '-f', 'mp3', 'pipe:1',
  ], pcm);
}

// `seconds` of digital silence as an MP3 buffer (for the concat path: inserted
// around section headings so they read with audiobook-style breathing room).
export async function silenceMp3(seconds, { sampleRate = 44100, channels = 1, bitrate = '192k' } = {}) {
  const cl = channels === 1 ? 'mono' : 'stereo';
  return run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', `anullsrc=r=${sampleRate}:cl=${cl}`,
    '-t', String(seconds), '-codec:a', 'libmp3lame', '-b:a', bitrate, '-f', 'mp3', 'pipe:1',
  ], null);
}

// `seconds` of silence as a zero-filled S16LE PCM buffer (for the Pro PCM path).
export function silencePcm(seconds, { sampleRate = 44100, channels = 1 } = {}) {
  return Buffer.alloc(Math.round(seconds * sampleRate * channels * 2));
}

// True duration (seconds) of an encoded audio buffer, via ffprobe.
export async function probeDurationSeconds(buffer) {
  const dir = mkdtempSync(join(tmpdir(), 'aw-probe-'));
  const f = join(dir, 'a.mp3');
  try {
    writeFileSync(f, buffer);
    const out = await run('ffprobe', [
      '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', f,
    ], null);
    return parseFloat(out.toString().trim()) || 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Concatenate MP3 chunk buffers into one gapless MP3 (free-tier path: ElevenLabs
// only serves MP3 below Pro). ffmpeg's concat demuxer decodes + re-encodes, so
// joins are gapless. A single chunk is returned untouched (no re-encode).
export async function concatMp3(buffers, { bitrate = '128k' } = {}) {
  if (buffers.length === 1) return buffers[0];
  const dir = mkdtempSync(join(tmpdir(), 'aw-concat-'));
  try {
    const list = [];
    buffers.forEach((b, i) => {
      const f = join(dir, `part-${i}.mp3`);
      writeFileSync(f, b);
      list.push(`file '${f}'`);
    });
    const listFile = join(dir, 'list.txt');
    writeFileSync(listFile, list.join('\n'));
    const outFile = join(dir, 'out.mp3');
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error',
      '-f', 'concat', '-safe', '0', '-i', listFile,
      '-codec:a', 'libmp3lame', '-b:a', bitrate, outFile,
    ], null);
    return readFileSync(outFile);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
