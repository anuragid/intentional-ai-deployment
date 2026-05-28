import { test } from 'node:test';
import assert from 'node:assert/strict';
import { synthesizeWithTimestamps, createPodcast } from './elevenlabs.js';

function mockFetch(captured, response) {
  return async (url, opts) => {
    captured.url = url; captured.opts = opts;
    return { ok: true, status: 200, json: async () => response };
  };
}

test('synthesizeWithTimestamps posts to the with-timestamps endpoint and decodes audio', async () => {
  const cap = {};
  const audioB64 = Buffer.from('ID3fake').toString('base64');
  const fetchImpl = mockFetch(cap, {
    audio_base64: audioB64,
    alignment: { characters: ['a'], character_start_times_seconds: [0], character_end_times_seconds: [0.1] },
  });
  const res = await synthesizeWithTimestamps('hello', {
    apiKey: 'k', voiceId: 'V', modelId: 'M',
  }, fetchImpl);

  assert.ok(cap.url.includes('/v1/text-to-speech/V/with-timestamps'));
  assert.equal(cap.opts.headers['xi-api-key'], 'k');
  assert.equal(JSON.parse(cap.opts.body).text, 'hello');
  assert.equal(JSON.parse(cap.opts.body).model_id, 'M');
  assert.ok(Buffer.isBuffer(res.audio));
  assert.equal(res.audio.toString(), 'ID3fake');
  assert.deepEqual(res.alignment.character_end_times_seconds, [0.1]);
});

test('createPodcast posts conversation mode with both voices', async () => {
  const cap = {};
  const fetchImpl = mockFetch(cap, { project: { project_id: 'P1' } });
  const res = await createPodcast({
    apiKey: 'k', modelId: 'M', source: { type: 'text', text: 'article' },
    hostVoiceId: 'H', guestVoiceId: 'G',
  }, fetchImpl);

  assert.ok(cap.url.includes('/v1/studio/podcasts'));
  const body = JSON.parse(cap.opts.body);
  assert.equal(body.mode.type, 'conversation');
  assert.equal(body.mode.conversation.host_voice_id, 'H');
  assert.equal(body.mode.conversation.guest_voice_id, 'G');
  assert.equal(res.projectId, 'P1');
});
