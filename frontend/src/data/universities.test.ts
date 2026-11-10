import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadUniversitiesIndex } from "./universities";

const payload = {
  generatedAt: "2026-11-09T12:00:00.000Z",
  cities: [{ id: "city-1", name: "Maringá", uf: "PR", isActive: true }],
  institutions: [{
    id: "ies-1",
    slug: "ies-exemplo",
    name: "IES Exemplo",
    website: "https://ies.example.test",
    city: { id: "city-1", name: "Maringá", uf: "PR" },
    ambassador: { githubHandle: "ana", name: "Ana", avatarUrl: "avatar", validUntil: null },
  }],
  events: [],
};

describe("loadUniversitiesIndex", () => {
  it("loads the public snapshot", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "codaqui-universities-"));
    const file = path.join(directory, "index.json");
    await writeFile(file, JSON.stringify(payload), "utf8");

    expect(loadUniversitiesIndex(file)).toEqual(payload);
    await rm(directory, { recursive: true, force: true });
  });

  it("rejects private application notes", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "codaqui-universities-"));
    const file = path.join(directory, "index.json");
    const privatePayload = structuredClone(payload);
    Object.assign(privatePayload.institutions[0], { applicationNotes: "motivação privada" });
    await writeFile(file, JSON.stringify(privatePayload), "utf8");

    expect(loadUniversitiesIndex(file)).toEqual({ generatedAt: null, cities: [], institutions: [], events: [] });
    await rm(directory, { recursive: true, force: true });
  });

  it("returns an empty snapshot when the file is missing", () => {
    expect(loadUniversitiesIndex("/tmp/codaqui-universities-missing.json")).toEqual({
      generatedAt: null,
      cities: [],
      institutions: [],
      events: [],
    });
  });
});
