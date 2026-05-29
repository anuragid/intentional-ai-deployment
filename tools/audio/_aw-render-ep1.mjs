import { writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { concatMp3, probeDurationSeconds } from './lib/encode.js';

const KEY = process.env.ELEVENLABS_API_KEY;
const HOST = process.env.ELEVENLABS_PODCAST_HOST_VOICE_ID;   // Host A
const GUEST = process.env.ELEVENLABS_PODCAST_GUEST_VOICE_ID; // Host B
const OUT = '/tmp/aw-ep1';
mkdirSync(OUT, { recursive: true });
const VOICE = { A: HOST, B: GUEST };

// Two EXTERNAL hosts discussing the authors' work — third person throughout.
const turns = [
  { s: 'A', t: "There's a new five-part series I've been sitting with. It's called \"We Are Choosing By Not Choosing,\" by Anijo Mathew and Anurag Duddu, out of an independent study at the Institute of Design. And honestly, the title almost works against it." },
  { s: 'B', t: "[thoughtful] Right, it sounds like an anti-AI manifesto, and it really isn't. That's the first thing the authors go out of their way to establish. They interviewed seven practitioners for it, people at McKinsey, Microsoft AI, Carnegie Mellon, Steelcase, and not one of them is against AI." },
  { s: 'A', t: "Every one of them uses these tools daily. So Mathew and Duddu aren't arguing the adopt-or-not question, they think that debate is over. The value is real, a chatbot resolving something in seconds, a draft before the coffee's done." },
  { s: 'B', t: "So the question they actually pose is quieter. Are organizations choosing their path? Or just following the one with the least resistance in front of them?" },
  { s: 'A', t: "That's the principle the piece turns on. They call it friction reduction. You reach for whatever removes the obstacle right in front of you, and each of those choices is rational on its own." },
  { s: 'B', t: "And the authors are careful not to strawman that. If you can turn hours of synthesis into minutes, of course you do. Their point is the asymmetry, the reward is immediate, but the clarity about what you were trying to achieve comes slowly, if at all. They quote Ewan Duncan at McKinsey: tools are tools; you need a clear aspiration first, and then you insert AI." },
  { s: 'A', t: "There's a line they pull from Kelly Franznick at Blink, companies take the low-hanging fruit, most savings, least risk. Customer service first, then whatever looks replaceable. [pause] And they note the line for what's replaceable never holds still." },
  { s: 'B', t: "Donna Flynn at Steelcase calls it a constantly moving target. So \"irreducibly human,\" in their telling, isn't a fixed category. It's a series of shifting bets." },
  { s: 'A', t: "For me the heart of the piece is what nobody measures. They borrow an image from Kathleen Brandenburg, using these tools is like the gym. Proxy the work over and over and the muscle atrophies. She says it's harder for her to write a Monday note now than it's ever been." },
  { s: 'B', t: "[softly] And the authors scale that past the individual. Think about who absorbs new graduates, the entry-level roles, the cohorts that train and spin off. Larry Keeley describes it as ripples in a pond, design firms, teachers, research spinoffs from one small group, none of which happens once a small team can do what used to take hundreds." },
  { s: 'A', t: "\"Nobody's hiring their students all of a sudden.\" Mathew and Duddu frame it as a collective action problem, if everyone optimizes individually, who builds the next generation? Nobody decides not to. It just quietly stops getting built." },
  { s: 'B', t: "Then there's the structural question they raise. Flynn asks it bluntly: how does the SEC hold a machine accountable? How do shareholders, if a company stops being profitable?" },
  { s: 'A', t: "And they tell this almost-funny story, a seventeen-hundred-word job description that sailed through, nobody applying any healthy skepticism. Which is the paradox the authors keep circling, evaluating AI output takes expertise, but the frictionless path removes the very practice that builds it." },
  { s: 'B', t: "Ken Holstein gives them the sharpest version of the blind spot. In child welfare, the model knows all the administrative data, but the human knows why there was even a phone call in the first place. That gap is real." },
  { s: 'A', t: "They don't resolve it neatly, though." },
  { s: 'B', t: "No. But they reach for Mark Weiser, beautiful seams, against the seamless ideal. And Liz Danzico tells them her responsible-AI team's advice was literally to put friction back in, so people stay aware of the AI at each step." },
  { s: 'A', t: "That's the reframe. Intentional friction creates awareness, awareness enables judgment, and judgment beats blind speed. The question stops being what can we automate and becomes what should we." },
  { s: 'B', t: "[pause] And they end on a fork. Both paths lead somewhere, only one leads where you actually chose. They're not prescribing, they're asking what each piece of friction is protecting before you smooth it away." },
  { s: 'A', t: "It's Part One of five. The rest each take up a thread, abstraction, what AI can't see, calibrated seams, pace. But that's the one to sit with." },
];

// Chunk turns into Text-to-Dialogue calls <= 1900 chars each.
const chunks = [];
let cur = [], len = 0;
for (const turn of turns) {
  if (cur.length && len + turn.t.length > 1900) { chunks.push(cur); cur = []; len = 0; }
  cur.push(turn); len += turn.t.length;
}
if (cur.length) chunks.push(cur);
console.log(`script: ${turns.reduce((n, x) => n + x.t.length, 0)} chars, ${chunks.length} dialogue calls`);

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'xi-api-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

const voiceParts = [];
for (let i = 0; i < chunks.length; i++) {
  const inputs = chunks[i].map(x => ({ text: x.t, voice_id: VOICE[x.s] }));
  console.log(`[dialogue ${i}] ${inputs.length} turns...`);
  voiceParts.push(await post('https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128', { inputs, model_id: 'eleven_v3', settings: { stability: 0.5 } }));
}
const voice = await concatMp3(voiceParts, { bitrate: '192k' });
writeFileSync(`${OUT}/voice.mp3`, voice);
const D = await probeDurationSeconds(voice);
console.log(`voice.mp3 ${voice.length} bytes, ${D.toFixed(1)}s`);

console.log('[music] bed + outro...');
writeFileSync(`${OUT}/bed.mp3`, await post('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
  prompt: 'Calm, contemplative instrumental for a reflective podcast intro. Warm, atmospheric, spacious — like quiet awe while stargazing. Slow-evolving sustained pads, soft felt-piano with single notes ringing into reverb. Gentle major-key with a touch of unresolved suspension, never triumphant. No drums, no percussion, no beat, no hook. Pulseless, ~60 BPM feel, long sustain, wide space for a voice on top.',
  music_length_ms: 18000, force_instrumental: true, model_id: 'music_v1',
}));
writeFileSync(`${OUT}/outro.mp3`, await post('https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128', {
  prompt: 'Outro resolution: same warm felt-piano and soft analog pad palette, pulseless. Begins quietly, opens into space, a gentle harmonic resolution — one suspension settling to a calm restful chord, a low piano note ringing out and decaying into long reverb. No drums, no hook, no climax — a soft exhale leaving an open question.',
  music_length_ms: 16000, force_instrumental: true, model_id: 'music_v1',
}));
console.log('[sfx] breath...');
writeFileSync(`${OUT}/breath.mp3`, await post('https://api.elevenlabs.io/v1/sound-generation', {
  text: 'a single very soft low atmospheric breath of air with a long gentle reverb tail, organic, no metallic or digital edge, almost subliminal, like a quiet exhale',
  duration_seconds: 2.5, prompt_influence: 0.3, model_id: 'eleven_text_to_sound_v2',
}));

const outroDelay = Math.max(0, Math.round(D * 1000) - 2000);
const filter = [
  '[0:a]adelay=3000|3000[v]',
  '[1:a]atrim=0:9,volume=0.5,afade=t=in:st=0:d=1.5,afade=t=out:st=6:d=3[intro]',
  `[2:a]atrim=0:14,volume=0.55,afade=t=in:st=0:d=3,afade=t=out:st=9:d=5,adelay=${outroDelay}|${outroDelay}[outro]`,
  '[3:a]volume=0.4,adelay=8000|8000[breath]',
  '[v][intro][outro][breath]amix=inputs=4:duration=longest:normalize=0[mx]',
  '[mx]loudnorm=I=-16:TP=-1.5:LRA=11[out]',
].join(';');
console.log('[mix] ffmpeg...');
await new Promise((resolve, reject) => {
  const ff = spawn('ffmpeg', ['-y', '-i', `${OUT}/voice.mp3`, '-i', `${OUT}/bed.mp3`, '-i', `${OUT}/outro.mp3`, '-i', `${OUT}/breath.mp3`,
    '-filter_complex', filter, '-map', '[out]', '-c:a', 'libmp3lame', '-b:a', '192k', `${OUT}/episode.mp3`]);
  const err = [];
  ff.stderr.on('data', d => err.push(d));
  ff.on('close', c => c === 0 ? resolve() : reject(new Error(Buffer.concat(err).toString().split('\n').slice(-3).join('\n'))));
});
console.log(`DONE -> ${OUT}/episode.mp3`);
