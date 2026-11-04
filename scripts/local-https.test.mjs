import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const hasPodman = spawnSync('podman', ['--version'], { stdio: 'ignore' }).status === 0;

test('setup-https aligns application and Stripe forwarding URLs', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'codaqui-https-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bin = join(directory, 'bin');
  await mkdir(bin);
  const mkcert = join(bin, 'mkcert');
  await writeFile(
    mkcert,
    '#!/bin/bash\nif [[ "$1" == "-key-file" ]]; then : > "$2"; : > "$4"; fi\n',
  );
  await chmod(mkcert, 0o755);
  const envFile = join(directory, '.env');
  await writeFile(
    envFile,
    [
      'HTTPS=false',
      'BACKEND_URL=http://localhost:3001',
      'FRONTEND_URL=http://localhost:3000',
      'PUBLIC_API_URL=http://localhost:3001',
      'STRIPE_FORWARD_URL=http://backend:3000/stripe/webhook',
      '',
    ].join('\n'),
  );

  const result = spawnSync(
    'make',
    ['-f', join(root, 'Makefile'), 'setup-https', `ENV_FILE=${envFile}`],
    {
      cwd: directory,
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const env = await readFile(envFile, 'utf8');
  for (const expected of [
    'HTTPS=true',
    'BACKEND_URL=https://localhost:3001',
    'FRONTEND_URL=https://localhost:3000',
    'PUBLIC_API_URL=https://localhost:3001',
    'STRIPE_FORWARD_URL=https://backend:3000/stripe/webhook',
  ]) {
    assert.match(env, new RegExp(`^${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'));
  }
});

test('compose renders Stripe forwarding in HTTP and HTTPS modes', { skip: !hasPodman }, () => {
  for (const forwardUrl of [
    'http://backend:3000/stripe/webhook',
    'https://backend:3000/stripe/webhook',
  ]) {
    const result = spawnSync('podman', ['compose', '-f', 'compose.yaml', 'config'], {
      cwd: root,
      env: {
        ...process.env,
        DB_PASSWORD: 'test-password',
        STRIPE_FORWARD_URL: forwardUrl,
      },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(
      result.stdout.includes(forwardUrl),
      `Compose did not render ${forwardUrl} in the Stripe CLI command`,
    );
  }
});
