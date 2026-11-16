import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../frontend/src/components/astro/EventCard.astro', import.meta.url),
  'utf8',
);

test('event summary is clamped to three lines and wraps long content', () => {
  assert.match(source, /class="event-summary mb-4 text-sm text-text-secondary"/);
  assert.match(source, /\.event-summary\s*\{[^}]*-webkit-line-clamp:\s*3/s);
  assert.match(source, /\.event-summary\s*\{[^}]*line-clamp:\s*3/s);
  assert.match(source, /\.event-summary\s*\{[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(source, /\.event-summary\s*\{[^}]*overflow:\s*clip/s);
});
