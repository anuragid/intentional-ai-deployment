// The audio is large and content-stable for a given build, so cache it hard.
// The manifest + timings JSON are the small, mutable entry points the player
// reads first — keep them revalidating so a future re-deploy actually reaches
// returning visitors instead of being pinned for a year.
const CACHE_IMMUTABLE = 'public, max-age=31536000, immutable';
const CACHE_REVALIDATE = 'public, max-age=300, must-revalidate';

function cacheControlFor(name) {
  return name.endsWith('.mp3') ? CACHE_IMMUTABLE : CACHE_REVALIDATE;
}

export function buildManifest(slug, modes) {
  const out = { slug, modes: {} };
  for (const [mode, info] of Object.entries(modes)) {
    out.modes[mode] = {
      audio: `audio/${slug}/${mode}.mp3`,
      timings: `audio/${slug}/${mode}.json`,
      duration: info.duration,
    };
  }
  return out;
}

export async function uploadArtifacts(bucket, slug, files) {
  for (const f of files) {
    await bucket.file(`audio/${slug}/${f.name}`).save(f.buffer, {
      contentType: f.contentType,
      metadata: { cacheControl: cacheControlFor(f.name) },
      resumable: false,
    });
  }
}
