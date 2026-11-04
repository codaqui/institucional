import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const scriptPath = new URL('./db-restore-prod.sh', import.meta.url).pathname;

test('DB_NAME and DB_USER from the caller survive loading .env', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'codaqui-restore-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'scripts'));
  await mkdir(join(directory, 'pg_dump'));
  await mkdir(join(directory, 'bin'));
  await copyFile(scriptPath, join(directory, 'scripts/db-restore-prod.sh'));
  await writeFile(join(directory, '.env'), 'DB_USER=codaqui\nDB_NAME=codaqui_db\n');
  await writeFile(join(directory, 'pg_dump/test.dmp'), 'fixture');

  const podmanLog = join(directory, 'podman.log');
  const fakePodman = join(directory, 'bin/podman');
  await writeFile(
    fakePodman,
    '#!/bin/bash\nprintf "%s\\n" "$*" >> "$PODMAN_LOG"\nif [[ "$1" == "ps" ]]; then printf "codaqui_postgres\\n"; fi\n',
  );
  await chmod(fakePodman, 0o755);

  const result = spawnSync('bash', ['scripts/db-restore-prod.sh'], {
    cwd: directory,
    env: {
      ...process.env,
      PATH: `${join(directory, 'bin')}:${process.env.PATH}`,
      PODMAN_LOG: podmanLog,
      DUMP: 'pg_dump/test.dmp',
      DB_USER: 'migration_user',
      DB_NAME: 'codaqui_1a_migration_verify',
    },
    input: '\n',
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const calls = await readFile(podmanLog, 'utf8');
  assert.match(calls, /-U migration_user -d codaqui_1a_migration_verify/);
  assert.doesNotMatch(calls, /-U codaqui -d codaqui_db/);
});
