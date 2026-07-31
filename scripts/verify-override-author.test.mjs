import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isOverridePath,
  normalizePath,
  readExpectedOwner,
  verifyOverrideAuthor,
} from "./verify-override-author.mjs";

test("normalizePath padroniza separadores", () => {
  assert.equal(normalizePath(".\\static\\events\\a.json"), "static/events/a.json");
  assert.equal(normalizePath("./static/events/a.json"), "static/events/a.json");
});

test("isOverridePath reconhece path de override", () => {
  assert.ok(isOverridePath("static/events/meetup/devparana/123.override.json"));
  assert.equal(isOverridePath("static/events/organizers.json"), false);
  assert.equal(isOverridePath("static/events/internal/codaqui/index.json"), false);
});

test("readExpectedOwner retorna ownerHandle minúsculo", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "voa-"));
  // Simula path canônico relativo para cobrir a regex de override.
  const fakeRelative = "static/events/meetup/devparana/123.override.json";
  const file = path.join(dir, "123.override.json");
  await writeFile(file, JSON.stringify({ ownerHandle: "AnaDev" }));
  const owner = await readExpectedOwner(
    path.join(dir, fakeRelative),
    async () => readFile(file, "utf8"),
    () => true
  );
  assert.equal(owner, "anadev");
});

test("readExpectedOwner retorna null para arquivo inexistente", async () => {
  const owner = await readExpectedOwner("/nao/existe.override.json");
  assert.equal(owner, null);
});

function makeFetchMock(responses) {
  const calls = [];
  const entries = Object.entries(responses).sort((a, b) => b[0].length - a[0].length);
  const fetchImpl = async (url) => {
    calls.push(url);
    const entry = entries.find(([k]) => url.includes(k));
    if (!entry) {
      return { ok: false, status: 404, text: async () => "not found" };
    }
    const { status = 200, body } = entry[1];
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
      json: async () => body,
    };
  };
  return { fetchImpl, calls };
}

test("verifyOverrideAuthor: autor bate, 1 commit, override correto → ok", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "voa-"));
  const overrideFile = path.join(dir, "123.override.json");
  await writeFile(overrideFile, JSON.stringify({ ownerHandle: "anadev" }));

  const { fetchImpl } = makeFetchMock({
    "/pulls/42": { body: { user: { login: "anadev" } } },
    "/pulls/42/files": { body: [{ filename: overrideFile }] },
    "/pulls/42/commits": {
      body: [
        {
          author: { login: "anadev" },
          commit: { author: { name: "Ana Dev" } },
        },
      ],
    },
  });

  const result = await verifyOverrideAuthor({
    prNumber: "42",
    repo: "codaqui/institucional",
    token: "tk",
    fetchImpl,
    readFileImpl: async () => JSON.stringify({ ownerHandle: "anadev" }),
    existsImpl: () => true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.prAuthor, "anadev");
});

test("verifyOverrideAuthor: organizers.json → bloqueado", async () => {
  const { fetchImpl } = makeFetchMock({
    "/pulls/42": { body: { user: { login: "anadev" } } },
    "/pulls/42/files": { body: [{ filename: "static/events/organizers.json" }] },
  });

  const result = await verifyOverrideAuthor({
    prNumber: "42",
    repo: "codaqui/institucional",
    token: "tk",
    fetchImpl,
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /organizers\.json/);
});

test("verifyOverrideAuthor: ownerHandle diverge → bloqueado", async () => {
  const { fetchImpl } = makeFetchMock({
    "/pulls/42": { body: { user: { login: "anadev" } } },
    "/pulls/42/files": { body: [{ filename: "static/events/meetup/devparana/123.override.json" }] },
  });

  const result = await verifyOverrideAuthor({
    prNumber: "42",
    repo: "codaqui/institucional",
    token: "tk",
    fetchImpl,
    readFileImpl: async () => JSON.stringify({ ownerHandle: "outrapessoa" }),
    existsImpl: () => true,
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /outrapessoa/);
});

test("verifyOverrideAuthor: mais de 1 commit → bloqueado", async () => {
  const { fetchImpl } = makeFetchMock({
    "/pulls/42": { body: { user: { login: "anadev" } } },
    "/pulls/42/files": { body: [{ filename: "static/events/meetup/devparana/123.override.json" }] },
    "/pulls/42/commits": {
      body: [
        { author: { login: "anadev" }, commit: { author: { name: "Ana" } } },
        { author: { login: "anadev" }, commit: { author: { name: "Ana" } } },
      ],
    },
  });

  const result = await verifyOverrideAuthor({
    prNumber: "42",
    repo: "codaqui/institucional",
    token: "tk",
    fetchImpl,
    readFileImpl: async () => JSON.stringify({ ownerHandle: "anadev" }),
    existsImpl: () => true,
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /1 commit/);
});

test("verifyOverrideAuthor: autor do commit diverge → bloqueado", async () => {
  const { fetchImpl } = makeFetchMock({
    "/pulls/42": { body: { user: { login: "anadev" } } },
    "/pulls/42/files": { body: [{ filename: "static/events/meetup/devparana/123.override.json" }] },
    "/pulls/42/commits": {
      body: [{ author: { login: "outro" }, commit: { author: { name: "Outro" } } }],
    },
  });

  const result = await verifyOverrideAuthor({
    prNumber: "42",
    repo: "codaqui/institucional",
    token: "tk",
    fetchImpl,
    readFileImpl: async () => JSON.stringify({ ownerHandle: "anadev" }),
    existsImpl: () => true,
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /diverge/);
});
