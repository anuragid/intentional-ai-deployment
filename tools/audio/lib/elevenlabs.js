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

// Narration: returns { audio: Buffer, alignment, requestId }.
// Defaults to PCM (pcm_44100, S16LE mono) so chunks can be concatenated
// sample-accurately and encoded to MP3 once at the end (gapless, no drift).
// `previousRequestIds` conditions this generation on prior chunks for prosody
// continuity ("request stitching"); requires sequential generation.
export async function synthesizeWithTimestamps(text, {
  apiKey, voiceId, modelId, outputFormat = 'pcm_44100',
  voiceSettings, previousRequestIds, previousText, nextText,
}, fetchImpl) {
  const url = `${BASE}/v1/text-to-speech/${voiceId}/with-timestamps?output_format=${outputFormat}`;
  const body = {
    text,
    model_id: modelId,
    ...(voiceSettings ? { voice_settings: voiceSettings } : {}),
    ...(previousRequestIds?.length ? { previous_request_ids: previousRequestIds } : {}),
    ...(previousText ? { previous_text: previousText } : {}),
    ...(nextText ? { next_text: nextText } : {}),
  };
  const res = await call(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, fetchImpl);
  const json = await res.json();
  return {
    audio: Buffer.from(json.audio_base64, 'base64'),
    alignment: json.alignment,
    requestId: res.headers?.get?.('request-id') ?? null,
  };
}

// v3 audiobook TTS. Plain POST (no with-timestamps), no request stitching
// (eleven_v3 does not support previous_request_ids). Returns audio bytes only.
// `text` is the TAGGED chunk; voice_settings is the contemplative profile
// (drop any field v3 rejects — the response error is surfaced verbatim).
// NOTE: eleven_v3 also rejects previous_text/next_text ("unsupported_model"),
// so prosodic context must come from text adjacent IN the same request — which
// is why section headings are read attached to their following prose, not as
// isolated fragments.
export async function synthesizeV3(text, {
  apiKey, voiceId, modelId = 'eleven_v3', outputFormat = 'mp3_44100_192', voiceSettings,
}, fetchImpl) {
  const url = `${BASE}/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`;
  const body = {
    text,
    model_id: modelId,
    ...(voiceSettings ? { voice_settings: voiceSettings } : {}),
  };
  const res = await call(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, fetchImpl);
  const ab = await res.arrayBuffer();
  return { audio: Buffer.from(ab) };
}

// Podcast: kicks off async Studio project. Returns { projectId }.
export async function createPodcast({
  apiKey, modelId, source, hostVoiceId, guestVoiceId,
  instructionsPrompt, durationScale, qualityPreset,
}, fetchImpl) {
  const url = `${BASE}/v1/studio/podcasts`;
  const body = {
    model_id: modelId,
    mode: { type: 'conversation', conversation: { host_voice_id: hostVoiceId, guest_voice_id: guestVoiceId } },
    source,
    ...(instructionsPrompt ? { instructions_prompt: instructionsPrompt } : {}),
    ...(durationScale ? { duration_scale: durationScale } : {}),
    ...(qualityPreset ? { quality_preset: qualityPreset } : {}),
  };
  const res = await call(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, fetchImpl);
  const json = await res.json();
  return { projectId: json.project?.project_id ?? json.project_id };
}

export async function getProject({ apiKey, projectId }, fetchImpl) {
  const res = await call(`${BASE}/v1/studio/projects/${projectId}`,
    { headers: { 'xi-api-key': apiKey } }, fetchImpl);
  return res.json();
}

// Poll a Studio project until conversion finishes. Terminal signal is
// creation_meta.status === 'finished' (state === 'default' alone is also the
// idle state → would false-positive on a freshly-created project).
export async function pollProjectUntilDone({ apiKey, projectId, intervalMs = 5000, timeoutMs = 600000, sleep }, fetchImpl) {
  const wait = sleep || ((ms) => new Promise(r => setTimeout(r, ms)));
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const json = await getProject({ apiKey, projectId }, fetchImpl);
    const proj = json.project ?? json;
    const status = proj.creation_meta?.status;
    if (status === 'finished' || (proj.state === 'default' && proj.can_be_downloaded)) return json;
    if (status === 'failed') throw new Error(`Podcast project ${projectId} conversion failed`);
    if (Date.now() > deadline) throw new Error(`Podcast project ${projectId} timed out (status=${status}, state=${proj.state})`);
    await wait(intervalMs);
  }
}

// Download rendered podcast audio: latest snapshot → stream as MPEG.
export async function downloadPodcastAudio({ apiKey, projectId }, fetchImpl) {
  const snapsUrl = `${BASE}/v1/studio/projects/${projectId}/snapshots`;
  const snapsRes = await call(snapsUrl, { headers: { 'xi-api-key': apiKey } }, fetchImpl);
  const snaps = await snapsRes.json();
  const list = (snaps.snapshots ?? snaps).slice()
    .sort((a, b) => (a.created_at_unix ?? 0) - (b.created_at_unix ?? 0));
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

// Pure: flatten a Studio chapter's content nodes into a speaker-labeled
// transcript, merging consecutive turns by the same speaker.
export function transcriptFromChapter(chapter, hostVoiceId, guestVoiceId) {
  const blocks = chapter?.content?.blocks ?? [];
  const out = [];
  for (const b of blocks) {
    for (const n of (b.nodes ?? [])) {
      if (n.type !== 'tts_node' || !n.text) continue;
      const text = n.text.trim();
      if (!text) continue;
      const speaker = n.voice_id === guestVoiceId ? 'Guest' : 'Host';
      const last = out[out.length - 1];
      if (last && last.speaker === speaker) last.text += ' ' + text;
      else out.push({ speaker, text });
    }
  }
  return out;
}

// Best-effort speaker-labeled transcript for a finished podcast project.
// Never throws — returns [] if the project/chapter shape isn't retrievable.
export async function fetchPodcastTranscript({ apiKey, projectId, hostVoiceId, guestVoiceId }, fetchImpl) {
  try {
    const chRes = await call(`${BASE}/v1/studio/projects/${projectId}/chapters`,
      { headers: { 'xi-api-key': apiKey } }, fetchImpl);
    const chJson = await chRes.json();
    const chapters = chJson.chapters ?? chJson;
    const chapterId = chapters?.[0]?.chapter_id ?? chapters?.[0]?.id;
    if (!chapterId) return [];
    const chapterRes = await call(`${BASE}/v1/studio/projects/${projectId}/chapters/${chapterId}`,
      { headers: { 'xi-api-key': apiKey } }, fetchImpl);
    const chapter = await chapterRes.json();
    return transcriptFromChapter(chapter.chapter ?? chapter, hostVoiceId, guestVoiceId);
  } catch {
    return [];
  }
}
