// True duration of raw PCM audio. ElevenLabs `pcm_44100` is signed 16-bit
// little-endian, mono — so duration = bytes / bytesPerSample / sampleRate.
// Used to offset karaoke word timings across stitched chunks WITHOUT the
// drift you'd get from trusting the last character_end_times_seconds value.
export function pcmDurationSeconds(byteLength, sampleRate = 44100, bytesPerSample = 2) {
  if (!byteLength) return 0;
  return byteLength / bytesPerSample / sampleRate;
}
