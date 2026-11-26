import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  formatProjectPeriod,
  groupProjectsByCategory,
  loadProjectsIndex,
  projectHref,
  projectPath,
  resolveProjectsSnapshotPath,
} from "./projects-extension";
import type { PublicProject } from "./projects-extension";

function writeSnapshot(projects: unknown[]): string {
  const directory = mkdtempSync(join(tmpdir(), "projects-extension-"));
  const publicDir = join(directory, "public", "projects");
  mkdirSync(publicDir, { recursive: true });
  const filePath = join(publicDir, "index.json");
  writeFileSync(filePath, JSON.stringify({ generatedAt: "2026-11-09", projects }));
  return filePath;
}

function validProject(): PublicProject {
  return {
    id: "project-1", kind: "projeto", category: "extension", canonicalUrl: null, name: "Ação de extensão", slug: "acao-extensao",
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

  it("finds the public snapshot when the module is bundled outside the source tree", () => {
    const filePath = writeSnapshot([validProject()]);
    const cwd = dirname(dirname(dirname(filePath)));
    const moduleUrl = pathToFileURL(join(cwd, "dist", ".prerender", "chunks", "projects.mjs")).href;

    expect(resolveProjectsSnapshotPath(moduleUrl, cwd)).toBe(filePath);
  });

  it("formats project periods without exposing null or raw ISO dates", () => {
    expect(formatProjectPeriod(null, null)).toBe("A definir");
    expect(formatProjectPeriod("2026-01-10", null)).toBe("a partir de 10/01/2026");
    expect(formatProjectPeriod(null, "2026-02-20")).toBe("até 20/02/2026");
    expect(formatProjectPeriod("2026-01-10", "2026-02-20")).toBe("10/01/2026 a 20/02/2026");
  });

  it("uses the canonical URL before the internal detail", () => {
    expect(projectHref({
      ...validProject(),
      canonicalUrl: "https://tisocial.org.br/blog/campanha",
    })).toBe("https://tisocial.org.br/blog/campanha");
    expect(projectHref({ ...validProject(), canonicalUrl: null })).toBe("/projetos/acao-extensao");
  });

  it("groups projects in the approved category order", () => {
    const groups = groupProjectsByCategory([
      { ...validProject(), category: "open_source" },
      { ...validProject(), category: "program" },
      { ...validProject(), category: "campaign" },
      { ...validProject(), category: "extension" },
    ]);

    expect(groups.map((group) => group.category)).toEqual([
      "program",
      "extension",
      "campaign",
      "open_source",
    ]);
  });

  it("accepts finished campaigns in the public snapshot", () => {
    const filePath = writeSnapshot([{
      ...validProject(),
      category: "campaign",
      status: "finished",
      canonicalUrl: "https://tisocial.org.br/blog/campanha",
    }]);
    expect(loadProjectsIndex(filePath).projects[0]?.status).toBe("finished");
  });
});
