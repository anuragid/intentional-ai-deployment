import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  synthesizeWithTimestamps, createPodcast, pollProjectUntilDone, transcriptFromChapter,
} from './elevenlabs.js';

function mockFetch(captured, response, headers = {}) {
  const h = new Map(Object.entries(headers));
  return async (url, opts) => {
    captured.url = url; captured.opts = opts;
    return { ok: true, status: 200, headers: { get: (k) => h.get(k) ?? null }, json: async () => response };
  };
}

// Returns a fetch that yields each response in sequence (for polling).
function queueFetch(responses) {
  let i = 0;
  return async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i++;
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => r };
  };
}

test('synthesizeWithTimestamps: pcm output, voice_settings, stitching, requestId from header', async () => {
  const cap = {};
  const audioB64 = Buffer.from('PCMDATA').toString('base64');
  const fetchImpl = mockFetch(cap, {
    audio_base64: audioB64,
    alignment: { characters: ['a'], character_start_times_seconds: [0], character_end_times_seconds: [0.1] },
  }, { 'request-id': 'req-123' });

  const res = await synthesizeWithTimestamps('hello', {
    apiKey: 'k', voiceId: 'V', modelId: 'M',
    voiceSettings: { stability: 0.6, speed: 0.95 },
    previousRequestIds: ['req-000'],
  }, fetchImpl);

  assert.ok(cap.url.includes('/v1/text-to-speech/V/with-timestamps'));
  assert.ok(cap.url.includes('output_format=pcm_44100'));   // default is PCM now
  const body = JSON.parse(cap.opts.body);
  assert.equal(body.text, 'hello');
  assert.equal(body.model_id, 'M');
  assert.deepEqual(body.voice_settings, { stability: 0.6, speed: 0.95 });
  assert.deepEqual(body.previous_request_ids, ['req-000']);
  assert.equal(res.audio.toString(), 'PCMDATA');
  assert.equal(res.requestId, 'req-123');
});

test('createPodcast: conversation mode with quality_preset + duration_scale', async () => {
  const cap = {};
  const fetchImpl = mockFetch(cap, { project: { project_id: 'P1' } });
  const res = await createPodcast({
    apiKey: 'k', modelId: 'M', source: { type: 'text', text: 'article' },
    hostVoiceId: 'H', guestVoiceId: 'G', qualityPreset: 'high', durationScale: 'default',
  }, fetchImpl);

  assert.ok(cap.url.includes('/v1/studio/podcasts'));
  const body = JSON.parse(cap.opts.body);
  assert.equal(body.mode.type, 'conversation');
  assert.equal(body.mode.conversation.host_voice_id, 'H');
  assert.equal(body.mode.conversation.guest_voice_id, 'G');
  assert.equal(body.quality_preset, 'high');
  assert.equal(body.duration_scale, 'default');
  assert.equal(res.projectId, 'P1');
});

test('pollProjectUntilDone: resolves when creation_meta.status is finished', async () => {
  const fetchImpl = queueFetch([
    { project: { state: 'creating', creation_meta: { status: 'creating' } } },
    { project: { state: 'converting', creation_meta: { status: 'creating' } } },
    { project: { state: 'default', can_be_downloaded: true, creation_meta: { status: 'finished' } } },
  ]);
  const json = await pollProjectUntilDone(
    { apiKey: 'k', projectId: 'P1', intervalMs: 0, sleep: async () => {} }, fetchImpl);
  assert.equal((json.project ?? json).creation_meta.status, 'finished');
});

test('pollProjectUntilDone: throws on failed conversion', async () => {
  const fetchImpl = queueFetch([
    { project: { state: 'converting', creation_meta: { status: 'creating' } } },
    { project: { state: 'default', creation_meta: { status: 'failed' } } },
  ]);
  await assert.rejects(
    () => pollProjectUntilDone({ apiKey: 'k', projectId: 'P1', intervalMs: 0, sleep: async () => {} }, fetchImpl),
    /failed/);
});

test('transcriptFromChapter: maps voice ids to Host/Guest and merges consecutive turns', () => {
  const chapter = { content: { blocks: [
    { nodes: [{ type: 'tts_node', voice_id: 'H', text: 'Hello there.' }] },
    { nodes: [{ type: 'tts_node', voice_id: 'H', text: 'And welcome.' }] },
    { nodes: [{ type: 'tts_node', voice_id: 'G', text: 'Glad to be here.' }] },
    { nodes: [{ type: 'image_node', voice_id: 'H', text: 'ignored' }] },
  ] } };
  const t = transcriptFromChapter(chapter, 'H', 'G');
  assert.deepEqual(t, [
    { speaker: 'Host', text: 'Hello there. And welcome.' },
    { speaker: 'Guest', text: 'Glad to be here.' },
  ]);
});
