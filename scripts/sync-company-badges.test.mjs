import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { renderCompanyBadge, syncCompanyBadges } from "./sync-company-badges.mjs";

const company = {
  id: "d0b899a1-50b4-4f4f-a153-f0b07aa12ad3",
  name: "Empresa <Aliada>",
  tradeName: null,
  tier: "aliada",
  sealValidUntil: "2027-11-10T00:00:00.000Z",
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "codaqui-company-badges-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test("renders accessible escaped company SVG", () => {
  const svg = renderCompanyBadge(company);
  assert.match(svg, /Empresa Aliada Codaqui/);
  assert.match(svg, /Empresa &lt;Aliada&gt;/);
  assert.match(svg, /aria-labelledby="badge-title badge-description"/);
});

test("writes and removes company badges atomically", async (t) => {
  const outputDir = await temporaryDirectory(t);
  await writeFile(path.join(outputDir, "obsolete.svg"), "old");
  const result = await syncCompanyBadges({ outputDir, fetchImpl: async () => jsonResponse([company]) });

  assert.equal(result.written, 1);
  assert.equal(result.removed, 1);
  assert.match(await readFile(path.join(outputDir, `${company.id}.svg`), "utf8"), /Empresa Aliada Codaqui/);
  assert.deepEqual(await readdir(outputDir), [`${company.id}.svg`]);
});

test("preserves previous badges on HTTP error", async (t) => {
  const outputDir = await temporaryDirectory(t);
  const previous = path.join(outputDir, `${company.id}.svg`);
  await writeFile(previous, "previous");
  const before = await readFile(previous, "utf8");

  await assert.rejects(syncCompanyBadges({ outputDir, fetchImpl: async () => jsonResponse({}, 500) }));
  assert.equal(await readFile(previous, "utf8"), before);
});

test("rejects the whole payload before writing", async (t) => {
  const outputDir = await temporaryDirectory(t);
  const previous = path.join(outputDir, `${company.id}.svg`);
  await writeFile(previous, "previous");
  const before = await readFile(previous, "utf8");

  await assert.rejects(syncCompanyBadges({
    outputDir,
    fetchImpl: async () => jsonResponse([{ ...company, responsibleMemberId: "private" }]),
  }), TypeError);
  assert.equal(await readFile(previous, "utf8"), before);
});

test("restores previous badges when rename fails", async (t) => {
  const outputDir = await temporaryDirectory(t);
  const previous = path.join(outputDir, `${company.id}.svg`);
  await writeFile(previous, "previous");
  const before = await readFile(previous, "utf8");
  const renameImpl = async () => { throw new Error("rename failed"); };

  await assert.rejects(syncCompanyBadges({ outputDir, fetchImpl: async () => jsonResponse([company]), renameImpl }));
  assert.equal(await readFile(previous, "utf8"), before);
});
