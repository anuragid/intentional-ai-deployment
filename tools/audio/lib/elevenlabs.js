const BASE = 'https://api.elevenlabs.io';

async function call(url, opts, fetchImpl) {
  const f = fetchImpl || fetch;
  const res = await f(url, opts);
  if (!res.ok) {
    const detail = await res.text?.().catch(() => '') ?? '';
    throw new Error(`ElevenLabs ${res.status} for ${url}: ${detail}`);
  }
  return res;
}

// Narration: returns { audio: Buffer, alignment }
export async function synthesizeWithTimestamps(text, { apiKey, voiceId, modelId }, fetchImpl) {
  const url = `${BASE}/v1/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`;
  const res = await call(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: modelId }),
  }, fetchImpl);
  const json = await res.json();
  return { audio: Buffer.from(json.audio_base64, 'base64'), alignment: json.alignment };
}

// Podcast: kicks off async Studio project. Returns { projectId }.
export async function createPodcast({ apiKey, modelId, source, hostVoiceId, guestVoiceId, instructionsPrompt, durationScale }, fetchImpl) {
  const url = `${BASE}/v1/studio/podcasts`;
  const body = {
    model_id: modelId,
    mode: { type: 'conversation', conversation: { host_voice_id: hostVoiceId, guest_voice_id: guestVoiceId } },
    source,
    ...(instructionsPrompt ? { instructions_prompt: instructionsPrompt } : {}),
    ...(durationScale ? { duration_scale: durationScale } : {}),
  };
  const res = await call(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, fetchImpl);
  const json = await res.json();
  return { projectId: json.project?.project_id ?? json.project_id };
}

// Poll a Studio project until conversion finishes. Returns the project JSON.
export async function pollProjectUntilDone({ apiKey, projectId, intervalMs = 5000, timeoutMs = 600000, sleep }, fetchImpl) {
  const wait = sleep || ((ms) => new Promise(r => setTimeout(r, ms)));
  const url = `${BASE}/v1/studio/projects/${projectId}`;
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await call(url, { headers: { 'xi-api-key': apiKey } }, fetchImpl);
    const json = await res.json();
    const state = json.project?.state ?? json.state;
    if (state === 'default' || state === 'done' || state === 'ready') return json;
    if (Date.now() > deadline) throw new Error(`Podcast project ${projectId} timed out (state=${state})`);
    await wait(intervalMs);
  }
}

// Download rendered podcast audio. The Studio export path is version-sensitive;
// confirm against https://elevenlabs.io/docs at implementation time.
// Strategy: list snapshots for the project, then stream the latest snapshot.
export async function downloadPodcastAudio({ apiKey, projectId }, fetchImpl) {
  const snapsUrl = `${BASE}/v1/studio/projects/${projectId}/snapshots`;
  const snapsRes = await call(snapsUrl, { headers: { 'xi-api-key': apiKey } }, fetchImpl);
  const snaps = await snapsRes.json();
  const list = snaps.snapshots ?? snaps;
  const latest = list[list.length - 1];
  const snapId = latest.project_snapshot_id ?? latest.snapshot_id ?? latest.id;
  const streamUrl = `${BASE}/v1/studio/projects/${projectId}/snapshots/${snapId}/stream`;
  const res = await call(streamUrl, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ convert_to_mpeg: true }),
  }, fetchImpl);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}
