import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { syncMentors, validateMentorsPayload } from "./sync-mentors.mjs";

const NOW = "2026-11-09T12:00:00.000Z";

function validPayload() {
  return {
    mentors: [{
      id: "d0b899a1-50b4-4f4f-a153-f0b07aa12ad3",
      handle: "ana",
      name: "Ana",
      avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4",
      areas: ["DevOps"],
      focus: "Carreira",
      availability: [{ weekday: 1, startTime: "19:00", endTime: "20:00", timeZone: "America/Sao_Paulo" }],
    }],
    insights: {
      completed: 3,
      activeMentors: 1,
      areas: [{ area: "DevOps", mentors: 1, completed: 3 }],
      noShowRate: 0.25,
    },
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function temporaryOutput(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "codaqui-mentors-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const outputFile = path.join(directory, "index.json");
  await writeFile(outputFile, `${JSON.stringify({ generatedAt: "2026-11-08T12:00:00.000Z", ...validPayload() }, null, 2)}\n`, "utf8");
  return outputFile;
}

test("writes the complete public mentor snapshot atomically", async (t) => {
  const outputFile = await temporaryOutput(t);
  const result = await syncMentors({
    outputFile,
    now: () => new Date(NOW),
    fetchImpl: async () => jsonResponse({
      ...validPayload(),
      mentors: [{ ...validPayload().mentors[0], focus: "Arquitetura" }],
    }),
  });

  assert.equal(result.generatedAt, NOW);
  assert.deepEqual(JSON.parse(await readFile(outputFile, "utf8")).mentors, [{ ...validPayload().mentors[0], focus: "Arquitetura" }]);
  assert.deepEqual(await readdir(path.dirname(outputFile)), ["index.json"]);
});

test("preserves the previous snapshot on HTTP error", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await readFile(outputFile, "utf8");

  await assert.rejects(syncMentors({ outputFile, fetchImpl: async () => jsonResponse({}, 500) }));
  assert.equal(await readFile(outputFile, "utf8"), previous);
});

test("rejects private actor and mentee fields without replacing the snapshot", async (t) => {
  const outputFile = await temporaryOutput(t);
  const previous = await readFile(outputFile, "utf8");
  const payload = validPayload();
  payload.mentors[0].memberId = "private-member";

  await assert.rejects(syncMentors({ outputFile, fetchImpl: async () => jsonResponse(payload) }), TypeError);
  assert.equal(await readFile(outputFile, "utf8"), previous);
});

test("validates the complete payload and aggregate areas", () => {
  assert.throws(() => validateMentorsPayload([]), TypeError);
  const invalid = validPayload();
  invalid.insights.areas[0].completed = -1;
  assert.throws(() => validateMentorsPayload(invalid), TypeError);
  assert.deepEqual(validateMentorsPayload(validPayload()), validPayload());
});

test("preserves an unchanged snapshot byte for byte", async (t) => {
  const outputFile = await temporaryOutput(t);
  const before = await readFile(outputFile, "utf8");
  const result = await syncMentors({ outputFile, fetchImpl: async () => jsonResponse(validPayload()) });

  assert.equal(result.generatedAt, "2026-11-08T12:00:00.000Z");
  assert.equal(await readFile(outputFile, "utf8"), before);
});
