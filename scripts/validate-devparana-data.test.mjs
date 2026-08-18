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

describe("team.json", () => {
  const team = JSON.parse(readFileSync(join(baseDir, "team.json"), "utf8"));

  it("tem pelo menos 1 membro", () => {
    assert.ok(Array.isArray(team.members) && team.members.length > 0);
  });

  it("cada membro tem name, role e avatar", () => {
    for (const member of team.members) {
      assert.ok(member.name, "member.name is required");
      assert.ok(member.role, "member.role is required");
      assert.ok(member.avatar, "member.avatar is required");
    }
  });
});
