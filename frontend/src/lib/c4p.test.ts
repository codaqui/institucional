import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { emptyC4pIndex, loadC4pIndex } from "./c4p";

const tempDirs: string[] = [];

function fixtureFile(content: unknown): string {
  const dir = mkdtempSync(path.join(tmpdir(), "c4p-loader-"));
  tempDirs.push(dir);
  const file = path.join(dir, "index.json");
  writeFileSync(file, JSON.stringify(content), "utf8");
  return file;
}

afterEach(() => {
  while (tempDirs.length > 0) rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

const validCall = {
  slug: "devpr-conf-2026",
  name: "C4P DevPR Conf 2026",
  description: null,
  status: "open",
  submissionOpenAt: null,
  submissionCloseAt: null,
  publicResults: false,
  finalizedAt: null,
  community: null,
  event: null,
  results: null,
};

describe("loadC4pIndex", () => {
  it("parse um snapshot válido completo", () => {
    const file = fixtureFile({
      generatedAt: "2026-11-12T00:00:00.000Z",
      calls: [
        {
          ...validCall,
          community: { slug: "devparana", name: "DevParaná" },
          event: { slug: "devpr-conf-2026", title: "DevPR Conf 2026" },
        },
      ],
    });
    const index = loadC4pIndex(file);
    expect(index.generatedAt).toBe("2026-11-12T00:00:00.000Z");
    expect(index.calls).toHaveLength(1);
    expect(index.calls[0].slug).toBe("devpr-conf-2026");
    expect(index.calls[0].community?.slug).toBe("devparana");
    expect(index.calls[0].event?.title).toBe("DevPR Conf 2026");
    expect(index.calls[0].results).toBeNull();
  });

  it("dropa calls inválidas e mantém as válidas", () => {
    const file = fixtureFile({
      generatedAt: "2026-11-12T00:00:00.000Z",
      calls: [validCall, { name: "Sem slug" }, { ...validCall, slug: "fechada", status: "draft" }],
    });
    const index = loadC4pIndex(file);
    expect(index.calls).toHaveLength(1);
  });

  it("rejeita results com campos privados", () => {
    const file = fixtureFile({
      generatedAt: "2026-11-12T00:00:00.000Z",
      calls: [
        {
          ...validCall,
          status: "closed",
          publicResults: true,
          results: { talks: [{ title: "A", speakerName: "Maria", track: null, level: null, speakerEmail: "x@y.z" }] },
        },
      ],
    });
    expect(loadC4pIndex(file).calls).toHaveLength(0);
  });

  it("retorna o índice vazio quando o arquivo não existe ou é inválido", () => {
    expect(loadC4pIndex(path.join(tmpdir(), "nao-existe-c4p", "index.json"))).toEqual(emptyC4pIndex());
    const file = fixtureFile("não é json");
    expect(loadC4pIndex(file)).toEqual(emptyC4pIndex());
  });
});
