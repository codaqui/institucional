import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const sharedUrl = new URL('../docs/mockups/shared.css', import.meta.url);
const mockupUrls = [
  new URL('../docs/mockups/main-proposta.html', import.meta.url),
  new URL('../docs/mockups/home-jornadas.html', import.meta.url),
];

test('main journey mockups share the base stylesheet instead of duplicating it', () => {
  assert.ok(existsSync(sharedUrl), 'docs/mockups/shared.css must exist');
  const shared = readFileSync(sharedUrl, 'utf8');
  assert.match(shared, /--cq-color-primary-500: #57B593;/);

  for (const url of mockupUrls) {
    const html = readFileSync(url, 'utf8');
    assert.match(html, /<link rel="stylesheet" href="\.\/shared\.css" \/>/);
    assert.doesNotMatch(html, /\/\* Tokens do Design System Codaqui/);
  }
});
