import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  assemblyPath,
  assemblySlug,
  loadAssembliesIndex,
  type Assembly,
} from "./assemblies";
import * as assemblyData from "./assemblies";

function makeAssembly(overrides: Partial<Assembly> = {}): Assembly {
  return {
    id: "assembly-oficial-2",
    type: "oficial",
    number: 2,
    slug: "oficial-2",
    title: "Segunda Assembleia Oficial",
    scheduledAt: "2026-12-10T19:00:00.000Z",
    heldAt: null,
    status: "scheduled",
    agendaSummary: "Aprovação de contas e planejamento do próximo período.",
    discussionUrl: "https://github.com/codaqui/institucional/discussions/42",
    ataPdfUrl: null,
    notaryRegistry: null,
    createdAt: "2026-11-01T12:00:00.000Z",
    updatedAt: "2026-11-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("assemblyPath", () => {
  it("deriva a URL pública por entidade, tipo e número com fallback legado", () => {
    expect(assemblySlug("oficial", 2)).toBe("oficial-2");
    expect(assemblyPath({ type: "oficial", number: 2 })).toBe("/assembleias/codaqui/oficial-2");
    expect(assemblyPath({ type: "oficial", number: 2, entity: { slug: "outra-entidade", name: "Outra entidade" } }))
      .toBe("/assembleias/outra-entidade/oficial-2");
  });
});

describe("formatAssemblyRegisteredAt", () => {
  it("preserva o dia civil de uma data enviada à meia-noite UTC", () => {
    const format = (assemblyData as unknown as Record<string, (value: string) => string>)
      .formatAssemblyRegisteredAt;
    expect(format).toBeTypeOf("function");
    expect(format("2026-11-21T00:00:00.000Z")).toBe("21 de novembro de 2026");
  });
});

describe("loadAssembliesIndex", () => {
  let directory: string;
  let snapshotPath: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "codaqui-assemblies-"));
    snapshotPath = join(directory, "index.json");
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  function writeSnapshot(value: unknown) {
    writeFileSync(snapshotPath, typeof value === "string" ? value : JSON.stringify(value));
  }

  it("retorna coleção vazia quando o snapshot não existe", () => {
    expect(loadAssembliesIndex(snapshotPath)).toEqual({ generatedAt: null, assemblies: [] });
  });

  it.each(["{json inválido", {}, { generatedAt: "2026-11-05T00:00:00.000Z", assemblies: {} }])(
    "retorna coleção vazia para snapshot ilegível ou com formato inválido: %j",
    (payload) => {
      writeSnapshot(payload);
      expect(loadAssembliesIndex(snapshotPath)).toEqual({ generatedAt: null, assemblies: [] });
    },
  );

  it("ordena por data prevista decrescente e preserva detalhes oficiais e cancelamentos", () => {
    const canceled = makeAssembly({
      id: "assembly-ordinaria-1",
      type: "ordinaria",
      number: 1,
      slug: "ordinaria-1",
      title: "Primeira Assembleia Ordinária",
      scheduledAt: "2026-10-01T19:00:00.000Z",
      status: "canceled",
      discussionUrl: "https://github.com/codaqui/institucional/discussions/41",
    });
    const official = makeAssembly({
      status: "held",
      heldAt: "2026-12-10T21:00:00.000Z",
      ataPdfUrl: "https://drive.google.com/atas/oficial-2.pdf",
      notaryRegistry: {
        book: "Livro 01",
        page: "42",
        registeredAt: "2026-12-15T12:00:00.000Z",
      },
    });
    writeSnapshot({ generatedAt: "2026-11-05T00:00:00.000Z", assemblies: [canceled, official] });

    const index = loadAssembliesIndex(snapshotPath);

    expect(index.generatedAt).toBe("2026-11-05T00:00:00.000Z");
    expect(index.assemblies).toEqual([official, canceled]);
  });

  it.each([
    makeAssembly({ slug: "oficial-999" }),
    makeAssembly({ scheduledAt: "data inválida" }),
    makeAssembly({ discussionUrl: "javascript:alert(1)" }),
    makeAssembly({ discussionUrl: "http://github.com/codaqui/institucional/discussions/42" }),
    makeAssembly({ discussionUrl: "https://github.com.evil.example/codaqui/institucional/discussions/42" }),
    makeAssembly({ discussionUrl: "https://github.com/codaqui/outro/discussions/42" }),
    makeAssembly({ ataPdfUrl: "javascript:alert(1)" }),
    makeAssembly({ ataPdfUrl: "http://drive.google.com/ata.pdf" }),
    makeAssembly({ ataPdfUrl: "https://evil.example/ata.pdf" }),
    makeAssembly({ ataPdfUrl: "https://drive.google.com.evil.example/ata.pdf" }),
    { ...makeAssembly(), createdById: "private-member-id" },
  ])("descarta o snapshot quando um item viola o contrato público", (assembly) => {
    writeSnapshot({ generatedAt: "2026-11-05T00:00:00.000Z", assemblies: [assembly] });

    expect(loadAssembliesIndex(snapshotPath)).toEqual({ generatedAt: null, assemblies: [] });
  });
});
