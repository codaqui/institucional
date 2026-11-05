import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(
  new URL('../.github/workflows/deploy-astro.yml', import.meta.url),
  'utf8',
);
const compose = readFileSync(new URL('../compose.yaml', import.meta.url), 'utf8');

test('production Astro builds receive the public Turnstile site key', () => {
  const buildStep = workflow
    .split('- name: Build (${{ matrix.project }})')[1]
    ?.split('- name: Gate de URLs canônicas do tenant')[0];

  assert.ok(buildStep, 'build step must exist');
  assert.ok(
    buildStep.includes('PUBLIC_TURNSTILE_SITE_KEY: ${{ vars.TURNSTILE_SITE_KEY || vars.PUBLIC_TURNSTILE_SITE_KEY }}'),
    'guest claims cannot render a production widget without the public site key',
  );
  assert.ok(
    !buildStep.includes('PUBLIC_TURNSTILE_SITE_KEY: ${{ secrets.'),
    'the public site key must come from repository variables, not secrets',
  );
});

test('local Compose maps the SPIN site key with the public alias as fallback', () => {
  assert.ok(
    compose.includes('PUBLIC_TURNSTILE_SITE_KEY: ${PUBLIC_TURNSTILE_SITE_KEY:-${TURNSTILE_SITE_KEY:-}}'),
    'the frontend must receive TURNSTILE_SITE_KEY from the local environment',
  );
  assert.ok(compose.includes('TURNSTILE_SECRET=${TURNSTILE_SECRET:-${TURNSTILE_SECRET_KEY:-}}'));
  assert.ok(compose.includes('TURNSTILE_HOSTNAMES=${TURNSTILE_HOSTNAMES:-${TURNSTILE_ALLOWED_HOSTNAMES:-}}'));
});
