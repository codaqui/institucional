import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const baseDir = join(__dirname, "../comunidades/devparana/src/data");

const ambassadors = JSON.parse(
  readFileSync(join(baseDir, "ambassadors.json"), "utf8"),
);
const naestrada = JSON.parse(
  readFileSync(join(baseDir, "naestrada.json"), "utf8"),
);

describe("ambassadors.json", () => {
  it("tem 6 regiões", () => {
    assert.equal(ambassadors.regions.length, 6);
  });

  it("cada região tem id, name e cities", () => {
    for (const region of ambassadors.regions) {
      assert.ok(region.id, "region.id is required");
      assert.ok(region.name, "region.name is required");
      assert.ok(
        Array.isArray(region.cities) && region.cities.length > 0,
        "region.cities must be a non-empty array",
      );
    }
  });

  it("norte e sudoeste possuem embaixadores", () => {
    const norte = ambassadors.regions.find((r) => r.id === "norte");
    const sudoeste = ambassadors.regions.find((r) => r.id === "sudoeste");
    assert.ok(norte?.ambassador);
    assert.ok(sudoeste?.ambassador);
    assert.ok(norte.ambassador.email);
    assert.ok(sudoeste.ambassador.email);
  });
});

describe("naestrada.json", () => {
  it("tem edição 2026", () => {
    assert.equal(naestrada.edition.year, 2026);
    assert.equal(naestrada.edition.status, "upcoming");
  });

  it("tem 15 cidades", () => {
    assert.equal(naestrada.edition.cities.length, 15);
  });

  it("tem 3 cotas de patrocínio", () => {
    assert.equal(naestrada.edition.sponsorshipTiers.length, 3);
    assert.deepEqual(
      naestrada.edition.sponsorshipTiers.map((t) => t.name),
      ["Bronze", "Prata", "Ouro"],
    );
  });
});
