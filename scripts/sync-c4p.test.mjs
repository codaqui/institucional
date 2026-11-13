import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { syncC4p } from "./sync-c4p.mjs";

const NOW = "2026-11-12T12:00:00.000Z";

const FORBIDDEN_KEYS = ["scores", "comment", "speakerEmail", "speakerPhone", "extraNotes", "bio", "linkedin", "photoUrl", "createdById"];

function validCall(overrides = {}) {
  return {
    slug: "devpr-conf-2026",
    name: "C4P DevPR Conf 2026",
    description: "Chamada de trabalhos",
    status: "open",
    submissionOpenAt: null,
    submissionCloseAt: "2026-12-01T00:00:00.000Z",
    publicResults: false,
    finalizedAt: null,
    community: null,
    event: { slug: "devpr-conf-2026", title: "DevPR Conf 2026" },
    results: null,
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
  const directory = await mkdtemp(path.join(tmpdir(), "codaqui-c4p-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return path.join(directory, "index.json");
}

test("writes a complete public snapshot without temporary files", async (t) => {
  const outputFile = await temporaryOutput(t);
  const call = validCall();
  const result = await syncC4p({
    outputFile,
    now: () => new Date(NOW),
    fetchImpl: async () => jsonResponse({ generatedAt: NOW, calls: [call] }),
  });

  assert.deepEqual(result, { generatedAt: NOW, calls: [call] });
  assert.deepEqual(JSON.parse(await readFile(outputFile, "utf8")), result);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("preserves the previous snapshot on HTTP and malformed payload errors", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = `${JSON.stringify({ generatedAt: "2026-11-11T12:00:00.000Z", calls: [validCall()] }, null, 2)}\n`;
  await writeFile(outputFile, previous, "utf8");

  await assert.rejects(syncC4p({
    outputFile,
    fetchImpl: async () => jsonResponse({ calls: "não-é-array" }),
  }));
  assert.equal(await readFile(outputFile, "utf8"), previous);
});

test("rejects drafts and private or unsafe fields without replacing the snapshot", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = `${JSON.stringify({ generatedAt: "2026-11-11T12:00:00.000Z", calls: [] }, null, 2)}\n`;
  await writeFile(outputFile, previous, "utf8");

  await assert.rejects(syncC4p({
    outputFile,
    fetchImpl: async () => jsonResponse({ calls: [validCall({ status: "draft" })] }),
  }));
  for (const key of FORBIDDEN_KEYS) {
    await assert.rejects(syncC4p({
      outputFile,
      fetchImpl: async () => jsonResponse({ calls: [validCall({ [key]: "vazamento" })] }),
    }));
  }
  assert.equal(await readFile(outputFile, "utf8"), previous);
});

test("restores the previous snapshot and removes the temporary file when rename fails", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = `${JSON.stringify({ generatedAt: "2026-11-11T12:00:00.000Z", calls: [] }, null, 2)}\n`;
  await writeFile(outputFile, previous, "utf8");

  await assert.rejects(syncC4p({
    outputFile,
    fetchImpl: async () => jsonResponse({ calls: [validCall()] }),
    renameImpl: async () => {
      throw new Error("rename falhou");
    },
  }));
  assert.equal(await readFile(outputFile, "utf8"), previous);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("preserves an unchanged snapshot byte for byte", async (t) => {
  const outputFile = await temporaryOutput(t);
  const call = validCall();
  const previous = `${JSON.stringify({ generatedAt: "2026-11-11T12:00:00.000Z", calls: [call] }, null, 2)}\n`;
  await writeFile(outputFile, previous, "utf8");

  const result = await syncC4p({
    outputFile,
    now: () => new Date(NOW),
    fetchImpl: async () => jsonResponse({ generatedAt: NOW, calls: [call] }),
  });
  assert.deepEqual(result, JSON.parse(previous));
  assert.equal(await readFile(outputFile, "utf8"), previous);
});

test("results only carry the public whitelist fields", async (t) => {
  const outputFile = await temporaryOutput(t);
  const call = validCall({
    status: "closed",
    publicResults: true,
    finalizedAt: "2026-11-11T00:00:00.000Z",
    results: {
      talks: [
        { title: "Aprovada", speakerName: "Maria", track: null, level: "Iniciante" },
      ],
    },
  });
  const result = await syncC4p({
    outputFile,
    fetchImpl: async () => jsonResponse({ calls: [call] }),
  });
  assert.deepEqual(result.calls[0].results.talks[0], {
    title: "Aprovada",
    speakerName: "Maria",
    track: null,
    level: "Iniciante",
  });
});
