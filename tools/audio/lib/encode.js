import { spawn } from 'node:child_process';

// Encode raw PCM (S16LE, `channels`, `sampleRate`) to MP3 bytes via ffmpeg.
// We generate narration chunks as PCM and concatenate them sample-accurately,
// then encode the whole stream once — gapless, with no MP3-join drift.
// I/O wrapper (not unit-tested); ffmpeg must be on PATH (validated at run time).
export function encodeMp3FromPcm(pcm, { sampleRate = 44100, channels = 1, bitrate = '192k' } = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      '-hide_banner', '-loglevel', 'error',
      '-f', 's16le', '-ar', String(sampleRate), '-ac', String(channels), '-i', 'pipe:0',
      '-codec:a', 'libmp3lame', '-b:a', bitrate, '-f', 'mp3', 'pipe:1',
    ];
    const ff = spawn('ffmpeg', args);
    const out = [];
    const err = [];
    ff.stdout.on('data', (d) => out.push(d));
    ff.stderr.on('data', (d) => err.push(d));
    ff.on('error', (e) => reject(new Error(`ffmpeg failed to start (is it installed?): ${e.message}`)));
    ff.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out));
      else reject(new Error(`ffmpeg exited ${code}: ${Buffer.concat(err).toString()}`));
    });
    ff.stdin.on('error', () => {}); // swallow EPIPE if ffmpeg exits early
    ff.stdin.write(pcm);
    ff.stdin.end();
  });
}
