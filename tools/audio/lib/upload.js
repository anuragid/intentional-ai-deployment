const CACHE = 'public, max-age=31536000, immutable';

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
      metadata: { cacheControl: CACHE },
      resumable: false,
    });
  }
}
