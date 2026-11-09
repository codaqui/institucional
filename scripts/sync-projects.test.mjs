import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { syncProjects, validateProjectsPayload } from "./sync-projects.mjs";

const NOW = "2026-11-09T12:00:00.000Z";

function validProject(overrides = {}) {
  return {
    id: "d0b899a1-50b4-4f4f-a153-f0b07aa12ad3",
    kind: "projeto",
    name: "Ação de extensão",
    slug: "acao-extensao",
    summary: "Resumo público.",
    status: "active",
    startsAt: "2026-03-10",
    endsAt: "2026-04-10",
    registrationStartsAt: "2026-03-01",
    registrationEndsAt: "2026-03-09",
    odsPrimary: 4,
    odsSecondary: [1],
    targetCommunity: "Comunidade sintética",
    totalHours: 1,
    schedule: [{ numero: 1, descricao: "Encontro", carga: 1 }],
    maxParticipants: 5,
    entity: { slug: "codaqui", name: "Associação Codaqui" },
    mentor: { name: "Mentor Sintético", handle: "mentor" },
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
  const directory = await mkdtemp(path.join(tmpdir(), "codaqui-projects-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputFile = path.join(directory, "index.json");
  const previous = `${JSON.stringify({ generatedAt: "2026-11-08T12:00:00.000Z", projects: [validProject()] }, null, 2)}\n`;
  await writeFile(outputFile, previous, "utf8");
  return outputFile;
}

test("writes the complete public collection atomically", async (t) => {
  const outputFile = await temporaryOutput(t);
  const result = await syncProjects({
    outputFile,
    now: () => new Date(NOW),
    fetchImpl: async () => jsonResponse([validProject({ summary: "Resumo atualizado" })]),
  });

  assert.equal(result.generatedAt, NOW);
  assert.deepEqual(JSON.parse(await readFile(outputFile, "utf8")).projects, [validProject({ summary: "Resumo atualizado" })]);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("preserves the previous snapshot on HTTP error", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await readFile(outputFile, "utf8");

  await assert.rejects(syncProjects({ outputFile, fetchImpl: async () => jsonResponse({}, 503) }));
  assert.equal(await readFile(outputFile, "utf8"), previous);
});

test("rejects private fields without replacing the snapshot", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await readFile(outputFile, "utf8");

  await assert.rejects(syncProjects({
    outputFile,
    fetchImpl: async () => jsonResponse([validProject({ internalNotes: "secret" })]),
  }), TypeError);
  assert.equal(await readFile(outputFile, "utf8"), previous);
});

test("validates the full payload before writing", () => {
  assert.throws(() => validateProjectsPayload([validProject({ totalHours: 2 })]), TypeError);
  assert.throws(() => validateProjectsPayload([validProject({ odsPrimary: 0 })]), TypeError);
  assert.throws(() => validateProjectsPayload([validProject({ entity: null })]), TypeError);
  assert.deepEqual(validateProjectsPayload([validProject()]), [validProject()]);
});

test("preserves an unchanged snapshot byte for byte", async (t) => {
  const outputFile = await temporaryOutput(t);
  const before = await readFile(outputFile, "utf8");
  const result = await syncProjects({ outputFile, fetchImpl: async () => jsonResponse([validProject()]) });

  assert.equal(result.generatedAt, "2026-11-08T12:00:00.000Z");
  assert.equal(await readFile(outputFile, "utf8"), before);
});
