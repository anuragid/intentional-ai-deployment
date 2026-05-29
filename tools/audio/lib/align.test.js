import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forcedAlign } from './align.js';

function mockFetch(cap, response) {
  return async (url, opts) => {
    cap.url = url; cap.opts = opts;
    return { ok: true, status: 200, json: async () => response };
  };
}

const RESPONSE = {
  characters: [{ text: 'A', start: 0.0, end: 0.1 }],
  words: [{ text: 'AI', start: 0.0, end: 0.3, loss: 0.02 }],
  loss: 0.05,
};

test('forcedAlign posts multipart file + tag-free text to /v1/forced-alignment', async () => {
  const cap = {};
  const transcript = 'AI creates value.\n\nTools are tools.'; // NO tags
  const res = await forcedAlign({
    apiKey: 'k', audio: Buffer.from('ID3audio'), transcript, contentType: 'audio/mpeg',
  }, mockFetch(cap, RESPONSE));

  assert.ok(cap.url.includes('/v1/forced-alignment'));
  assert.equal(cap.opts.headers['xi-api-key'], 'k');
  assert.ok(cap.opts.body instanceof FormData);            // multipart
  assert.equal(cap.opts.body.get('text'), transcript);
  assert.ok(!/\[[^\]]*\]/.test(cap.opts.body.get('text'))); // tag-free
  assert.ok(cap.opts.body.has('file'));
  // never set content-type by hand for FormData (boundary is auto)
  assert.ok(!cap.opts.headers['content-type']);
  assert.deepEqual(res.words[0], { text: 'AI', start: 0.0, end: 0.3, loss: 0.02 });
  assert.equal(res.loss, 0.05);
});

test('forcedAlign surfaces a non-OK response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 400, text: async () => 'bad audio' });
  await assert.rejects(
    forcedAlign({ apiKey: 'k', audio: Buffer.from('x'), transcript: 't' }, fetchImpl),
    /400.*bad audio/,
  );
});
