import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { syncCommunities } from "./sync-communities.mjs";

async function temporaryOutput(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "codaqui-communities-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return path.join(directory, "index.json");
}

async function apiServer(t, handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

test("preserves the previous snapshot when the API fails", async (t) => {
  const outputFile = await temporaryOutput(t);
  await writeFile(outputFile, '{"communities":[{"slug":"previous"}]}');

  await assert.rejects(
    syncCommunities({ apiUrl: "http://127.0.0.1:1", outputFile }),
  );
  assert.match(await readFile(outputFile, "utf8"), /previous/);
});

test("preserves the previous snapshot when the API returns an error", async (t) => {
  const outputFile = await temporaryOutput(t);
  await writeFile(outputFile, '{"communities":[{"slug":"previous"}]}');
  const apiUrl = await apiServer(t, (_request, response) => {
    response.writeHead(503, { "Content-Type": "application/json" });
    response.end('{"message":"unavailable"}');
  });

  await assert.rejects(syncCommunities({ apiUrl, outputFile }), /503/);
  assert.match(await readFile(outputFile, "utf8"), /previous/);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("rejects a non-array API payload with TypeError", async (t) => {
  const outputFile = await temporaryOutput(t);
  const apiUrl = await apiServer(t, (_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('{"communities":[]}');
  });

  await assert.rejects(syncCommunities({ apiUrl, outputFile }), TypeError);
});

test("writes only active communities through an atomic rename", async (t) => {
  const outputFile = await temporaryOutput(t);
  const active = {
    id: "active-community",
    slug: "active-community",
    name: "Comunidade ativa",
    status: "active",
    level: "integrada",
  };
  const apiUrl = await apiServer(t, (request, response) => {
    assert.equal(request.url, "/communities/public");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify([
        active,
        { ...active, id: "proposed", slug: "proposed", status: "proposed" },
        { ...active, id: "exited", slug: "exited", status: "exited" },
      ]),
    );
  });

  const result = await syncCommunities({
    apiUrl,
    outputFile,
    now: () => new Date("2026-11-02T12:00:00.000Z"),
  });

  assert.deepEqual(result.communities, [active]);
  const snapshot = JSON.parse(await readFile(outputFile, "utf8"));
  assert.equal(snapshot.generatedAt, "2026-11-02T12:00:00.000Z");
  assert.deepEqual(snapshot.communities, [active]);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("preserves the previous snapshot byte for byte when communities are unchanged", async (t) => {
  const outputFile = await temporaryOutput(t);
  const active = {
    id: "active-community",
    slug: "active-community",
    name: "Comunidade ativa",
    status: "active",
    level: "integrada",
  };
  const previous = `{\n  "generatedAt": "2026-11-01T10:00:00.000Z",\n  "communities": ${JSON.stringify([active], null, 2)}\n}\n`;
  await writeFile(outputFile, previous, "utf8");
  const apiUrl = await apiServer(t, (_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify([active]));
  });

  const result = await syncCommunities({
    apiUrl,
    outputFile,
    now: () => new Date("2026-11-02T12:00:00.000Z"),
  });

  assert.equal(await readFile(outputFile, "utf8"), previous);
  assert.equal(result.generatedAt, "2026-11-01T10:00:00.000Z");
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});
