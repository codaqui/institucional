import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { syncAnnouncements } from "./sync-announcements.mjs";

const NOW = "2026-11-11T12:00:00.000Z";

function validAnnouncement(overrides = {}) {
  return {
    id: "announcement-1",
    text: "Estamos corrigindo funções do portal.",
    severity: "warning",
    linkUrl: "https://github.com/codaqui/institucional/issues",
    linkLabel: "Reportar bug",
    startsAt: "2026-11-11T10:00:00.000Z",
    endsAt: "2026-11-12T10:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function temporaryOutput(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "codaqui-announcements-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return path.join(directory, "index.json");
}

async function writePrevious(outputFile, announcements = [validAnnouncement()]) {
  const previous = `${JSON.stringify({ generatedAt: "2026-11-10T12:00:00.000Z", announcements }, null, 2)}\n`;
  await writeFile(outputFile, previous, "utf8");
  return previous;
}

test("writes a complete public snapshot without temporary files", async (t) => {
  const outputFile = await temporaryOutput(t);
  const announcement = validAnnouncement();
  const result = await syncAnnouncements({
    outputFile,
    now: () => new Date(NOW),
    fetchImpl: async () => jsonResponse([announcement]),
  });

  assert.deepEqual(result, { generatedAt: NOW, announcements: [announcement] });
  assert.deepEqual(JSON.parse(await readFile(outputFile, "utf8")), result);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("preserves the previous snapshot on HTTP and malformed JSON errors", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await writePrevious(outputFile);

  await assert.rejects(syncAnnouncements({
    outputFile,
    fetchImpl: async () => jsonResponse({ message: "unavailable" }, 503),
  }), /503/);
  await assert.rejects(syncAnnouncements({
    outputFile,
    fetchImpl: async () => new Response('[{"id":', { status: 200 }),
  }));

  assert.equal(await readFile(outputFile, "utf8"), previous);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("rejects an invalid payload and private or unsafe data without replacing the snapshot", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await writePrevious(outputFile);
  const invalidValues = [
    null,
    { announcements: [] },
    [validAnnouncement({ id: undefined })],
    [validAnnouncement({ text: "<b>XSS</b>" })],
    [validAnnouncement({ severity: "critical" })],
    [validAnnouncement({ linkUrl: "javascript:alert(1)" })],
    [validAnnouncement({ linkLabel: undefined })],
    [validAnnouncement({ startsAt: "invalid" })],
    [validAnnouncement({ endsAt: "2026-11-10T10:00:00.000Z" })],
    [validAnnouncement({ createdById: "private-author" })],
  ];

  for (const payload of invalidValues) {
    await assert.rejects(syncAnnouncements({
      outputFile,
      fetchImpl: async () => jsonResponse(payload),
    }), TypeError);
    assert.equal(await readFile(outputFile, "utf8"), previous);
  }
});

test("restores the previous snapshot and removes the temporary file when rename fails", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await writePrevious(outputFile);
  const nextAnnouncement = validAnnouncement({ id: "announcement-2", text: "Novo aviso" });

  await assert.rejects(syncAnnouncements({
    outputFile,
    fetchImpl: async () => jsonResponse([nextAnnouncement]),
    renameImpl: async () => { throw new Error("rename failed"); },
  }), /rename failed/);

  assert.equal(await readFile(outputFile, "utf8"), previous);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("preserves an unchanged snapshot byte for byte", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await writePrevious(outputFile);
  const result = await syncAnnouncements({
    outputFile,
    fetchImpl: async () => jsonResponse([validAnnouncement()]),
  });

  assert.deepEqual(result, JSON.parse(previous));
  assert.equal(await readFile(outputFile, "utf8"), previous);
});
