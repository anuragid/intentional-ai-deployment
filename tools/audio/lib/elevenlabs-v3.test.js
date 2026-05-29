import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeV3 } from './elevenlabs.js';

function mockFetch(cap, audioBytes) {
  return async (url, opts) => {
    cap.url = url; cap.opts = opts;
    return { ok: true, status: 200, arrayBuffer: async () => Uint8Array.from(audioBytes).buffer };
  };
}

test('synthesizeV3 posts plain TTS with model_id eleven_v3, no timestamps/stitching', async () => {
  const cap = {};
  const res = await synthesizeV3('Remove [pause] the obstacle.', {
    apiKey: 'k', voiceId: 'V', modelId: 'eleven_v3',
    outputFormat: 'mp3_44100_192',
    voiceSettings: { stability: 0.6, similarity_boost: 0.75, style: 0, speed: 0.95, use_speaker_boost: true },
  }, mockFetch(cap, [73, 68, 51])); // "ID3"

  assert.ok(cap.url.includes('/v1/text-to-speech/V'));
  assert.ok(!cap.url.includes('/with-timestamps'));      // plain endpoint
  assert.ok(cap.url.includes('output_format=mp3_44100_192'));
  assert.equal(cap.opts.headers['xi-api-key'], 'k');
  const body = JSON.parse(cap.opts.body);
  assert.equal(body.text, 'Remove [pause] the obstacle.'); // tagged text passes through
  assert.equal(body.model_id, 'eleven_v3');
  assert.ok(!('previous_request_ids' in body));          // v3 has no stitching
  assert.equal(body.voice_settings.speed, 0.95);
  assert.ok(Buffer.isBuffer(res.audio));
  assert.equal(res.audio.toString(), 'ID3');
});

test('synthesizeV3 surfaces a non-OK response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 422, text: async () => 'bad voice_settings' });
  await assert.rejects(
    synthesizeV3('x', { apiKey: 'k', voiceId: 'V', modelId: 'eleven_v3' }, fetchImpl),
    /422.*bad voice_settings/,
  );
});
