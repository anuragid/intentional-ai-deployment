import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pcmDurationSeconds } from './pcm.js';

test('pcmDurationSeconds: 1 second of 44.1kHz S16LE mono', () => {
  // 44100 samples * 2 bytes/sample = 88200 bytes == 1.0s
  assert.equal(pcmDurationSeconds(88200), 1);
});

test('pcmDurationSeconds: half second', () => {
  assert.equal(pcmDurationSeconds(44100), 0.5);
});

test('pcmDurationSeconds: empty buffer is 0', () => {
  assert.equal(pcmDurationSeconds(0), 0);
});

test('pcmDurationSeconds: honors custom sample rate / width', () => {
  // 16000 Hz, 2 bytes: 32000 bytes == 1s
  assert.equal(pcmDurationSeconds(32000, 16000, 2), 1);
});
