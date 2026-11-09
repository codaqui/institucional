import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadProjectsIndex, projectPath } from "./projects-extension";

function writeSnapshot(projects: unknown[]): string {
  const directory = mkdtempSync(join(tmpdir(), "projects-extension-"));
  const publicDir = join(directory, "public", "projects");
  mkdirSync(publicDir, { recursive: true });
  const filePath = join(publicDir, "index.json");
  writeFileSync(filePath, JSON.stringify({ generatedAt: "2026-11-09", projects }));
  return filePath;
}

function validProject() {
  return {
    id: "project-1", kind: "projeto", name: "Ação de extensão", slug: "acao-extensao",
    summary: "Resumo", status: "active", startsAt: null, endsAt: null,
    registrationStartsAt: null, registrationEndsAt: null, odsPrimary: 4,
    odsSecondary: [], targetCommunity: "Comunidade", totalHours: 1,
    schedule: [{ numero: 1, descricao: "Encontro", carga: 1 }], maxParticipants: 5,
    entity: { slug: "codaqui", name: "Associação Codaqui" }, mentor: null,
  };
}

describe("projects-extension", () => {
  it("builds the public project path", () => {
    expect(projectPath(validProject())).toBe("/projetos/acao-extensao");
  });

  it("rejects snapshots with private fields", () => {
    const filePath = writeSnapshot([{ ...validProject(), internalNotes: "secret" }]);
    expect(loadProjectsIndex(filePath).projects).toEqual([]);
  });

  it("loads valid public projects", () => {
    const filePath = writeSnapshot([validProject()]);
    const result = loadProjectsIndex(filePath);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]).not.toHaveProperty("createdById");
  });
});
