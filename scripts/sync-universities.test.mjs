import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { syncUniversities, validateUniversitiesPayload } from "./sync-universities.mjs";

const NOW = "2026-11-09T12:00:00.000Z";

function validPayload() {
  return {
    generatedAt: "2026-11-08T12:00:00.000Z",
    cities: [{ id: "city-1", name: "Maringá", uf: "PR", isActive: true }],
    institutions: [{
      id: "ies-1",
      slug: "ies-exemplo",
      name: "IES Exemplo",
      website: "https://ies.example.test",
      city: { id: "city-1", name: "Maringá", uf: "PR" },
      ambassador: { githubHandle: "ana", name: "Ana", avatarUrl: "avatar", validUntil: null },
    }],
    events: [{
      id: "event-1",
      slug: "evento-ies",
      title: "Evento IES",
      startAt: "2026-11-10T18:00:00.000Z",
      status: "published",
      location: "Maringá",
      institutionId: "ies-1",
    }],
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function temporaryOutput(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "codaqui-universities-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputFile = path.join(directory, "index.json");
  await writeFile(outputFile, JSON.stringify(validPayload(), null, 2), "utf8");
  return outputFile;
}

test("writes the complete public collection atomically", async (t) => {
  const outputFile = await temporaryOutput(t);
  const updatedPayload = validPayload();
  updatedPayload.events[0].title = "Evento IES atualizado";
  const result = await syncUniversities({
    outputFile,
    now: () => new Date(NOW),
    fetchImpl: async () => jsonResponse(updatedPayload),
  });

  assert.equal(result.generatedAt, NOW);
  assert.equal((await readdir(path.dirname(outputFile))).length, 1);
  assert.deepEqual(JSON.parse(await readFile(outputFile, "utf8")).institutions, validPayload().institutions);
});

test("preserves the previous snapshot on HTTP error", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await readFile(outputFile, "utf8");
  await assert.rejects(syncUniversities({ outputFile, fetchImpl: async () => jsonResponse({}, 503) }));
  assert.equal(await readFile(outputFile, "utf8"), previous);
});

test("rejects private application fields without replacing the snapshot", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await readFile(outputFile, "utf8");
  const payload = validPayload();
  payload.institutions[0].applicationNotes = "motivação privada";
  await assert.rejects(syncUniversities({ outputFile, fetchImpl: async () => jsonResponse(payload) }), TypeError);
  assert.equal(await readFile(outputFile, "utf8"), previous);
});

test("validates the complete payload before writing", () => {
  assert.throws(() => validateUniversitiesPayload({ cities: [], institutions: [], events: [], applications: [] }), TypeError);
  assert.deepEqual(validateUniversitiesPayload(validPayload()), validPayload());
});
