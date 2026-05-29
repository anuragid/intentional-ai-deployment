const BASE = 'https://api.elevenlabs.io';

// Forced Alignment: align an audio file against a plain (tag-free) transcript.
// Returns { characters[], words:[{text,start,end,loss}], loss }. Model-agnostic;
// one call handles a full 10-15 min file. `audio` is a Buffer of the encoded MP3
// (or PCM-derived MP3); `transcript` is the CLEAN blocks joined by JOIN_SEPARATOR.
export async function forcedAlign({ apiKey, audio, transcript, contentType = 'audio/mpeg' }, fetchImpl) {
  const f = fetchImpl || fetch;
  const form = new FormData();
  form.append('file', new Blob([audio], { type: contentType }), 'narration.mp3');
  form.append('text', transcript);                 // NO tags — must match clean
  const res = await f(`${BASE}/v1/forced-alignment`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },             // let FormData set content-type+boundary
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text?.().catch(() => '') ?? '';
    throw new Error(`ElevenLabs forced-alignment ${res.status}: ${detail}`);
  }
  return await res.json();
}
