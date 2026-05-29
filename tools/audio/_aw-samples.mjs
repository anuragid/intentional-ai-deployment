import { writeFileSync, mkdirSync } from 'node:fs';
const KEY = process.env.ELEVENLABS_API_KEY;
const OUT = '/tmp/aw-samples';
mkdirSync(OUT, { recursive: true });

async function save(name, url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { console.error(`${name} FAILED`, res.status, await res.text()); return; }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(`${OUT}/${name}`, buf);
  console.log(`${name}: ${buf.length} bytes`);
}

// Ambient instrumental bed (calm, contemplative, no drums) ~60s.
await save('bed.mp3', 'https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
  prompt: 'Calm, contemplative ambient bed for a thoughtful podcast about technology and human work. Soft sustained piano and warm synth pads, very minimal, slow, reflective, unobtrusive, no drums, no percussion, no melody hooks — just a quiet atmospheric wash that sits under spoken voices.',
  music_length_ms: 60000,
  force_instrumental: true,
  model_id: 'music_v1',
});

// Subtle transition chime (~2s).
await save('chime.mp3', 'https://api.elevenlabs.io/v1/sound-generation', {
  text: 'a soft, warm, gentle shimmer chime — subtle and contemplative, a single gentle bell-like swell that fades, no harshness',
  duration_seconds: 2.5,
  prompt_influence: 0.4,
  model_id: 'eleven_text_to_sound_v2',
});
