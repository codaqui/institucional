import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildC4pReportModel, downloadC4pReportPdf } from "./c4p-pdf";
import type { C4pReport } from "../components/islands/admin/c4p/c4p-admin-types";

const mocks = vi.hoisted(() => ({
  text: vi.fn(),
  line: vi.fn(),
  rect: vi.fn(),
  setFontSize: vi.fn(),
  setTextColor: vi.fn(),
  save: vi.fn(),
  autoTable: vi.fn(),
}));

vi.mock("jspdf", () => ({
  default: class {
    text = mocks.text;
    line = mocks.line;
    rect = mocks.rect;
    setFontSize = mocks.setFontSize;
    setTextColor = mocks.setTextColor;
    save = mocks.save;
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    splitTextToSize = (value: string) => [value];
  },
}));

vi.mock("jspdf-autotable", () => ({
  autoTable: mocks.autoTable,
}));

const report: C4pReport = {
  call: {
    id: "call-1",
    slug: "devpr-conf-2026",
    name: "C4P DevPR Conf 2026",
    description: null,
    finalizedAt: "2026-11-11T00:00:00.000Z",
  },
  criteria: [
    { key: "relevancia", label: "Relevância Prática", weight: 2 },
    { key: "clareza", label: "Clareza do Resumo", weight: 1 },
  ],
  selectedTalkIds: ["t1"],
  ranking: [
    {
      talkId: "t1",
      position: 1,
      title: "Palestra A",
      speakerName: "Maria",
      track: "Frontend",
      level: "Iniciante",
      avgTotal: 7.5,
      votesCount: 2,
      avgCriteria: { relevancia: 8, clareza: 6.5 },
      selected: true,
    },
    {
      talkId: "t2",
      position: 2,
      title: "Palestra B",
      speakerName: "João",
      track: null,
      level: null,
      avgTotal: null,
      votesCount: 0,
      avgCriteria: {},
      selected: false,
    },
  ],
  votes: [
    {
      talkId: "t1",
      evaluatorName: "Ana",
      scores: { relevancia: 8, clareza: 7 },
      comment: "ótima",
      updatedAt: "2026-11-10T00:00:00.000Z",
    },
  ],
};

describe("buildC4pReportModel", () => {
  it("monta seções com médias formatadas (2 casas geral, 1 casa por critério)", () => {
    const model = buildC4pReportModel(report);
    expect(model.title).toBe("Relatório de Seleção de Palestras");
    expect(model.callName).toBe("C4P DevPR Conf 2026");
    expect(model.criteriaLines).toEqual([
      "1. Relevância Prática (peso 2)",
      "2. Clareza do Resumo (peso 1)",
    ]);
    const selected = model.tables.find((t) => t.heading.includes("selecionadas"));
    expect(selected).toBeDefined();
    expect(selected!.rows[0]).toContain("7.50");
    const criteria = model.tables.find((t) => t.heading.includes("critério"));
    expect(criteria!.rows[0]).toContain("8.0");
    expect(criteria!.rows[0]).toContain("6.5");
  });

  it("votação completa inclui avaliador e comentário", () => {
    const model = buildC4pReportModel(report);
    const full = model.tables.find((t) => t.heading.includes("Votação completa"));
    expect(full).toBeDefined();
    const anaRow = full!.rows.find((row) => row.includes("Ana"));
    expect(anaRow).toBeDefined();
    expect(anaRow!.join(" ")).toContain("ótima");
  });

  it("posição sem voto não quebra o ranking", () => {
    const model = buildC4pReportModel(report);
    const ranking = model.tables.find((t) => t.heading.toLowerCase().includes("ranking"));
    expect(ranking).toBeDefined();
    const palestraB = ranking!.rows.find((row) => row.includes("Palestra B"));
    expect(palestraB).toBeDefined();
  });
});

describe("downloadC4pReportPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gera o PDF com autoTable e salva com o nome da campanha", async () => {
    const model = buildC4pReportModel(report);
    await downloadC4pReportPdf(model);
    expect(mocks.autoTable).toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledWith("relatorio-c4p-devpr-conf-2026.pdf");
  });
});
