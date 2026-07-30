import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { validateFile, validateOrganizersData, validateOverrideData, validateEventsIndexData, validateInternalSnapshotData, validateOverridesIndexData } from "./validate-overrides.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repoRoot, "scripts", "validate-overrides.mjs");

const validPath = "static/events/meetup/devparana/226163759.override.json";
const validOverride = {
  eventId: "226163759",
  sourceKey: "meetup:devparana",
  extendData: {
    imageUrl: "https://example.com/banner.png",
    summary: "Resumo corrigido pelo organizador.",
    location: "SEBRAE Maringa",
    tags: ["meetup", "devparana", "presencial"],
    featured: true,
  },
  ownerId: "uuid-do-membro",
  ownerHandle: "sehandle",
  updatedAt: "2026-04-29T23:00:00-03:00",
  reason: "Corrigindo titulo e adicionando banner",
};

test("override valido passa", () => {
  assert.deepEqual(validateOverrideData(validOverride, validPath), []);
});

test("campo proibido em extendData falha", () => {
  const data = structuredClone(validOverride);
  data.extendData.startAt = "2026-05-01T10:00:00-03:00";
  const errors = validateOverrideData(data, validPath);
  assert.ok(errors.some((e) => e.includes("extendData.startAt")), `esperava erro de campo proibido: ${errors}`);
});

test("summary com mais de 500 caracteres falha", () => {
  const data = structuredClone(validOverride);
  data.extendData.summary = "x".repeat(501);
  const errors = validateOverrideData(data, validPath);
  assert.ok(errors.some((e) => e.includes("summary")), `esperava erro de limite de summary: ${errors}`);
});

test("path fora do padrao falha", async () => {
  const errors = await validateFile("src/pages/eventos.override.json", repoRoot);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /fora do padrao/);
});

test("eventId divergente do nome do arquivo falha", () => {
  const data = { ...validOverride, eventId: "outro-id" };
  const errors = validateOverrideData(data, validPath);
  assert.ok(errors.some((e) => e.includes("eventId")), `esperava erro de coerencia de eventId: ${errors}`);
});

test("sourceKey divergente do path falha", () => {
  const data = { ...validOverride, sourceKey: "discord:codaqui" };
  const errors = validateOverrideData(data, validPath);
  assert.ok(errors.some((e) => e.includes("sourceKey")), `esperava erro de coerencia de sourceKey: ${errors}`);
});

test("arquivo deletado (path valido, inexistente em disco) passa", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [scriptPath, "static/events/meetup/devparana/000000000-deletado.override.json"],
    { cwd: repoRoot }
  );
  assert.match(stdout, /valido/);
});

// ── organizers.json ─────────────────────────────────────────────────────────

const organizersPath = "static/events/organizers.json";
const validOrganizers = {
  version: 1,
  ownerships: [
    {
      memberId: "123e4567-e89b-42d3-a456-426614174000",
      githubHandle: "sehandle",
      scope: ["meetup:devparana:*", "discord:codaqui:123456789"],
    },
  ],
};

test("organizers.json valido passa", () => {
  assert.deepEqual(validateOrganizersData(validOrganizers, organizersPath), []);
});

test("organizers.json sem version numerica falha", () => {
  const data = { ...validOrganizers, version: "1" };
  const errors = validateOrganizersData(data, organizersPath);
  assert.ok(errors.some((e) => e.includes("version")), `esperava erro de version: ${errors}`);
});

test("organizers.json com memberId nao-uuid falha", () => {
  const data = structuredClone(validOrganizers);
  data.ownerships[0].memberId = "nao-e-uuid";
  const errors = validateOrganizersData(data, organizersPath);
  assert.ok(errors.some((e) => e.includes("memberId")), `esperava erro de memberId: ${errors}`);
});

test("organizers.json com githubHandle vazio falha", () => {
  const data = structuredClone(validOrganizers);
  data.ownerships[0].githubHandle = "";
  const errors = validateOrganizersData(data, organizersPath);
  assert.ok(errors.some((e) => e.includes("githubHandle")), `esperava erro de githubHandle: ${errors}`);
});

test("organizers.json com scope fora do formato falha", () => {
  const data = structuredClone(validOrganizers);
  data.ownerships[0].scope = ["meetup:devparana"];
  const errors = validateOrganizersData(data, organizersPath);
  assert.ok(errors.some((e) => e.includes("scope")), `esperava erro de scope: ${errors}`);
});

test("validateFile aceita o organizers.json real do repo", async () => {
  const errors = await validateFile(organizersPath, repoRoot);
  assert.deepEqual(errors, []);
});

// ── snapshot internal (force-sync) ──────────────────────────────────────────

const internalEventPath = "static/events/internal/codaqui/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.json";
const internalIndexPath = "static/events/internal/codaqui/index.json";
const eventsIndexPath = "static/events/index.json";

test("snapshot internal por evento valido passa", () => {
  const data = {
    generatedAt: "2026-07-29T00:00:00.000Z",
    source: { source: "internal", sourceId: "codaqui" },
    event: { id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", title: "Evento X" },
  };
  assert.deepEqual(validateInternalSnapshotData(data, internalEventPath), []);
});

test("snapshot internal por evento sem title falha", () => {
  const data = { event: { id: "x" } };
  const errors = validateInternalSnapshotData(data, internalEventPath);
  assert.ok(errors.some((e) => e.includes("event.title")), `esperava erro de title: ${errors}`);
});

test("index da fonte internal valido passa", () => {
  assert.deepEqual(validateInternalSnapshotData({ events: [] }, internalIndexPath), []);
});

test("index da fonte internal sem events falha", () => {
  const errors = validateInternalSnapshotData({ meta: {} }, internalIndexPath);
  assert.ok(errors.some((e) => e.includes("events")), `esperava erro de events: ${errors}`);
});

test("index.json raiz valido passa", () => {
  const data = { generatedAt: "2026-07-29T00:00:00.000Z", sources: [], events: [] };
  assert.deepEqual(validateEventsIndexData(data, eventsIndexPath), []);
});

test("index.json raiz sem events falha", () => {
  const errors = validateEventsIndexData({ generatedAt: "x", sources: [] }, eventsIndexPath);
  assert.ok(errors.some((e) => e.includes("events")), `esperava erro de events: ${errors}`);
});

test("validateFile aceita o index.json real do repo", async () => {
  const errors = await validateFile(eventsIndexPath, repoRoot);
  assert.deepEqual(errors, []);
});

test("validateFile aceita delecao de snapshot internal", async () => {
  const errors = await validateFile("static/events/internal/codaqui/00000000-0000-4000-8000-000000000000.json", repoRoot);
  assert.deepEqual(errors, []);
});

test("path fora do padrao continua falhando (PR misto)", async () => {
  const errors = await validateFile("static/events/meetup/devparana/index.json", repoRoot);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /fora do padrao/);
});

// ── extendData.workloadMinutes (certificados de eventos externos) ──────────

test("workloadMinutes valido passa (int 0..1000)", () => {
  const data = structuredClone(validOverride);
  data.extendData.workloadMinutes = 240;
  assert.deepEqual(validateOverrideData(data, validPath), []);
});

test("workloadMinutes invalido falha (negativo, decimal, acima de 1000)", () => {
  for (const value of [-1, 1.5, 1001, "240"]) {
    const data = structuredClone(validOverride);
    data.extendData.workloadMinutes = value;
    const errors = validateOverrideData(data, validPath);
    assert.ok(
      errors.some((e) => e.includes("workloadMinutes")),
      `esperava erro de workloadMinutes para ${JSON.stringify(value)}: ${errors}`
    );
  }
});

// ── Manifesto overrides-index.json ─────────────────────────────────────────

const overridesIndexPath = "static/events/overrides-index.json";
const validManifest = {
  version: 1,
  updatedAt: "2026-07-29T00:00:00.000Z",
  overrides: {
    "meetup:devparana:226163759": {
      extendData: { summary: "Resumo", workloadMinutes: 120 },
      ownerHandle: "sehandle",
      updatedAt: "2026-07-29T00:00:00.000Z",
    },
  },
};

test("manifesto valido passa", () => {
  assert.deepEqual(validateOverridesIndexData(validManifest, overridesIndexPath), []);
});

test("manifesto sem version numerica falha", () => {
  const errors = validateOverridesIndexData({ overrides: {} }, overridesIndexPath);
  assert.ok(errors.some((e) => e.includes("version")), `esperava erro de version: ${errors}`);
});

test("manifesto sem overrides objeto falha", () => {
  const errors = validateOverridesIndexData({ version: 1, overrides: [] }, overridesIndexPath);
  assert.ok(errors.some((e) => e.includes("overrides")), `esperava erro de overrides: ${errors}`);
});

test("manifesto com chave fora do formato falha", () => {
  const data = structuredClone(validManifest);
  data.overrides = { "meetup:devparana:*": { extendData: {} } };
  const errors = validateOverridesIndexData(data, overridesIndexPath);
  assert.ok(errors.some((e) => e.includes("formato")), `esperava erro de formato de chave: ${errors}`);
});

test("manifesto com campo proibido no extendData falha", () => {
  const data = structuredClone(validManifest);
  data.overrides["meetup:devparana:226163759"].extendData.startAt = "2026-01-01";
  const errors = validateOverridesIndexData(data, overridesIndexPath);
  assert.ok(errors.some((e) => e.includes("extendData.startAt")), `esperava erro de campo proibido: ${errors}`);
});

test("validateFile aceita delecao do manifesto (path valido, inexistente)", async () => {
  const errors = await validateFile(overridesIndexPath, repoRoot);
  assert.deepEqual(errors, []);
});
