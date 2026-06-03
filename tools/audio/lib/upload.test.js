import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadArtifacts, buildManifest } from './upload.js';

function mockBucket(store) {
  return {
    file(path) {
      return {
        async save(buf, opts) { store.push({ path, size: buf.length, opts }); },
      };
    },
  };
}

test('buildManifest lists available modes with durations', () => {
  const m = buildManifest('sample', { narration: { duration: 612.4 }, podcast: { duration: 480 } });
  assert.deepEqual(m.slug, 'sample');
  assert.deepEqual(Object.keys(m.modes).sort(), ['narration', 'podcast']);
  assert.equal(m.modes.narration.audio, 'audio/sample/narration.mp3');
  assert.equal(m.modes.narration.timings, 'audio/sample/narration.json');
});

test('uploadArtifacts writes files under audio/<slug>/ with cache headers', async () => {
  const store = [];
  await uploadArtifacts(mockBucket(store), 'sample', [
    { name: 'narration.mp3', buffer: Buffer.from('mp3'), contentType: 'audio/mpeg' },
    { name: 'narration.json', buffer: Buffer.from('{}'), contentType: 'application/json' },
  ]);
  assert.deepEqual(store.map(s => s.path), ['audio/sample/narration.mp3', 'audio/sample/narration.json']);
  // mp3 is cached hard (immutable); the mutable JSON entry points revalidate.
  assert.match(store[0].opts.metadata.cacheControl, /immutable/);
  assert.match(store[1].opts.metadata.cacheControl, /must-revalidate/);
  assert.doesNotMatch(store[1].opts.metadata.cacheControl, /immutable/);
});
