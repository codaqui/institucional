import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { syncAssemblies } from "./sync-assemblies.mjs";
import * as assemblySyncModule from "./sync-assemblies.mjs";

const NOW = "2026-11-05T12:00:00.000Z";

function validAssembly(overrides = {}) {
  return {
    id: "d0b899a1-50b4-4f4f-a153-f0b07aa12ad3",
    type: "oficial",
    number: 2,
    slug: "oficial-2",
    title: "Assembleia Geral Ordinária",
    scheduledAt: "2026-11-20T18:00:00.000Z",
    heldAt: null,
    status: "scheduled",
    agendaSummary: "Prestação de contas e planejamento.",
    discussionUrl: "https://github.com/codaqui/institucional/discussions/123",
    ataPdfUrl: null,
    notaryRegistry: null,
    createdAt: "2026-11-05T10:00:00.000Z",
    updatedAt: "2026-11-05T10:00:00.000Z",
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
  const directory = await mkdtemp(path.join(tmpdir(), "codaqui-assemblies-"));
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

async function writePreviousSnapshot(outputFile, assemblies = [validAssembly()]) {
  const previous = `${JSON.stringify({ generatedAt: "2026-11-04T12:00:00.000Z", assemblies }, null, 2)}\n`;
  await writeFile(outputFile, previous, "utf8");
  return previous;
}

test("writes the complete collection to the snapshot with no temporary files", async (t) => {
  const outputFile = await temporaryOutput(t);
  const assembly = validAssembly({
    heldAt: "2026-11-20T20:00:00.000Z",
    status: "held",
    ataPdfUrl: "https://drive.google.com/file/d/synthetic/view",
    notaryRegistry: {
      book: "Livro sintético",
      page: "42",
      registeredAt: "2026-11-21T12:00:00.000Z",
    },
  });
  const apiUrl = await apiServer(t, (request, response) => {
    assert.equal(request.url, "/assemblies/public");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify([assembly]));
  });

  const result = await syncAssemblies({
    apiUrl: `${apiUrl}/`,
    outputFile,
    now: () => new Date(NOW),
  });

  assert.deepEqual(result, { generatedAt: NOW, assemblies: [assembly] });
  assert.deepEqual(JSON.parse(await readFile(outputFile, "utf8")), result);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("preserves the previous snapshot when the API cannot be reached", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await writePreviousSnapshot(outputFile);

  await assert.rejects(syncAssemblies({ apiUrl: "http://127.0.0.1:1", outputFile }));

  assert.equal(await readFile(outputFile, "utf8"), previous);
  assert.equal(JSON.parse(await readFile(outputFile, "utf8")).assemblies.length, 1);
});

test("preserves the previous snapshot when the API returns an HTTP error", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await writePreviousSnapshot(outputFile);

  await assert.rejects(
    syncAssemblies({ outputFile, fetchImpl: async () => jsonResponse({ message: "unavailable" }, 503) }),
    /503/,
  );

  assert.equal(await readFile(outputFile, "utf8"), previous);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("rejects a non-array response without replacing the previous snapshot", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await writePreviousSnapshot(outputFile);

  await assert.rejects(
    syncAssemblies({ outputFile, fetchImpl: async () => jsonResponse({ assemblies: [] }) }),
    TypeError,
  );

  assert.equal(await readFile(outputFile, "utf8"), previous);
});

test("rejects malformed JSON without replacing the previous snapshot", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await writePreviousSnapshot(outputFile);

  await assert.rejects(syncAssemblies({
    outputFile,
    fetchImpl: async () => new Response('[{"id":', { status: 200 }),
  }));

  assert.equal(await readFile(outputFile, "utf8"), previous);
});

test("validates every field of every assembly before replacing the snapshot", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await writePreviousSnapshot(outputFile);
  const invalidAssemblies = [
    null,
    [],
    validAssembly({ id: undefined }),
    validAssembly({ type: "extraordinaria" }),
    validAssembly({ number: 0 }),
    validAssembly({ number: 1.5 }),
    validAssembly({ slug: "oficial-3" }),
    validAssembly({ title: undefined }),
    validAssembly({ scheduledAt: "not-a-date" }),
    validAssembly({ heldAt: "not-a-date" }),
    validAssembly({ status: "unknown" }),
    validAssembly({ agendaSummary: undefined }),
    validAssembly({ discussionUrl: undefined }),
    validAssembly({ discussionUrl: "javascript:alert(1)" }),
    validAssembly({ discussionUrl: "http://github.com/codaqui/institucional/discussions/123" }),
    validAssembly({ discussionUrl: "https://github.com.evil.example/codaqui/institucional/discussions/123" }),
    validAssembly({ discussionUrl: "https://github.com/codaqui/outro/discussions/123" }),
    validAssembly({ ataPdfUrl: 42 }),
    validAssembly({ ataPdfUrl: "javascript:alert(1)" }),
    validAssembly({ ataPdfUrl: "http://drive.google.com/ata.pdf" }),
    validAssembly({ ataPdfUrl: "https://evil.example/ata.pdf" }),
    validAssembly({ ataPdfUrl: "https://drive.google.com.evil.example/ata.pdf" }),
    validAssembly({ notaryRegistry: { book: "Livro", page: "42" } }),
    validAssembly({ notaryRegistry: { book: "Livro", page: "42", registeredAt: "invalid" } }),
    validAssembly({ createdAt: undefined }),
    validAssembly({ updatedAt: "invalid" }),
    validAssembly({ createdById: "must-not-be-public" }),
  ];

  for (const invalidAssembly of invalidAssemblies) {
    await assert.rejects(
      syncAssemblies({
        outputFile,
        fetchImpl: async () => jsonResponse([validAssembly(), invalidAssembly]),
      }),
      TypeError,
      `payload aceito indevidamente: ${JSON.stringify(invalidAssembly)}`,
    );
    assert.equal(await readFile(outputFile, "utf8"), previous);
  }
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("rejects a held assembly without heldAt and preserves the previous snapshot", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await writePreviousSnapshot(outputFile);
  const invalidAssembly = validAssembly({
    type: "ordinaria",
    number: 1,
    slug: "ordinaria-1",
    status: "held",
    heldAt: null,
  });

  await assert.rejects(
    syncAssemblies({ outputFile, fetchImpl: async () => jsonResponse([invalidAssembly]) }),
    /heldAt é obrigatório/,
  );

  assert.equal(await readFile(outputFile, "utf8"), previous);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("rejects heldAt before scheduledAt and preserves the previous snapshot", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await writePreviousSnapshot(outputFile);
  const invalidAssembly = validAssembly({
    type: "ordinaria",
    number: 1,
    slug: "ordinaria-1",
    status: "held",
    heldAt: "2026-11-20T17:59:59.000Z",
  });

  await assert.rejects(
    syncAssemblies({ outputFile, fetchImpl: async () => jsonResponse([invalidAssembly]) }),
    /heldAt não pode ser anterior a scheduledAt/,
  );

  assert.equal(await readFile(outputFile, "utf8"), previous);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("rejects a held official assembly without complete PDF and notary registry", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await writePreviousSnapshot(outputFile);
  const invalidAssembly = validAssembly({
    status: "held",
    heldAt: "2026-11-20T20:00:00.000Z",
    ataPdfUrl: null,
    notaryRegistry: null,
  });

  await assert.rejects(
    syncAssemblies({ outputFile, fetchImpl: async () => jsonResponse([invalidAssembly]) }),
    /oficial realizada exige PDF e cartório completo/,
  );

  assert.equal(await readFile(outputFile, "utf8"), previous);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("cleans the temporary file and preserves the previous snapshot when rename fails", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await writePreviousSnapshot(outputFile);

  await assert.rejects(
    syncAssemblies({
      outputFile,
      now: () => new Date(NOW),
      fetchImpl: async () => jsonResponse([validAssembly({ title: "Nova pauta" })]),
      renameImpl: async () => {
        throw new Error("simulated rename failure");
      },
    }),
    /simulated rename failure/,
  );

  assert.equal(await readFile(outputFile, "utf8"), previous);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("preserves an unchanged snapshot byte for byte", async (t) => {
  const outputFile = await temporaryOutput(t);
  const assembly = validAssembly();
  const previous = await writePreviousSnapshot(outputFile, [assembly]);

  const result = await syncAssemblies({
    outputFile,
    now: () => new Date(NOW),
    fetchImpl: async () => jsonResponse([assembly]),
  });

  assert.equal(result.generatedAt, "2026-11-04T12:00:00.000Z");
  assert.equal(await readFile(outputFile, "utf8"), previous);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("sanitizes control characters without losing the error cause or safe text", () => {
  const sanitize = assemblySyncModule.sanitizeErrorForLog;
  assert.equal(typeof sanitize, "function");

  const error = new Error("Falha de rede\n\u001b[31mFORGED\tregistro\r\ncontinuação");
  assert.equal(
    sanitize(error),
    "Falha de rede\\n\\x1b[31mFORGED\\tregistro\\r\\ncontinuação",
  );
  assert.equal(sanitize("pauta válida"), "pauta válida");
});
