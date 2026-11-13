import type { C4pReport } from "../components/islands/admin/c4p/c4p-admin-types";

export interface C4pReportModelTable {
  heading: string;
  columns: string[];
  rows: string[][];
}

export interface C4pReportModel {
  title: string;
  callName: string;
  callSlug: string;
  finalizedAt: string | null;
  generatedAt: string;
  criteriaLines: string[];
  tables: C4pReportModelTable[];
}

function format2(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

function format1(value: number | undefined): string {
  return value === undefined ? "—" : value.toFixed(1);
}

export function buildC4pReportModel(report: C4pReport): C4pReportModel {
  const selected = new Set(report.selectedTalkIds);
  const criteriaKeys = report.criteria.map((criterion) => criterion.key);

  const selectedRows = report.ranking
    .filter((row) => selected.has(row.talkId))
    .map((row) => [
      String(row.position ?? "—"),
      row.title,
      row.speakerName,
      row.track ?? "—",
      row.level ?? "—",
      format2(row.avgTotal),
      String(row.votesCount),
    ]);

  const criteriaRows = report.ranking.map((row) => [
    String(row.position ?? "—"),
    row.title,
    ...criteriaKeys.map((key) => format1(row.avgCriteria[key])),
  ]);

  const fullRows = report.ranking.map((row) => [
    String(row.position ?? "—"),
    row.title,
    row.speakerName,
    row.track ?? "—",
    row.level ?? "—",
    format2(row.avgTotal),
    String(row.votesCount),
    selected.has(row.talkId) ? "Sim" : "—",
  ]);

  const votesRows = report.votes.map((vote) => {
    const talk = report.ranking.find((row) => row.talkId === vote.talkId);
    return [
      talk?.title ?? vote.talkId,
      vote.evaluatorName,
      ...criteriaKeys.map((key) =>
        vote.scores[key] === undefined ? "—" : String(vote.scores[key]),
      ),
      vote.comment ?? "",
    ];
  });

  return {
    title: "Relatório de Seleção de Palestras",
    callName: report.call.name,
    callSlug: report.call.slug,
    finalizedAt: report.call.finalizedAt,
    generatedAt: new Date().toISOString(),
    criteriaLines: report.criteria.map(
      (criterion, index) =>
        `${index + 1}. ${criterion.label} (peso ${criterion.weight})`,
    ),
    tables: [
      {
        heading: "Palestras selecionadas",
        columns: [
          "#",
          "Título",
          "Palestrante",
          "Trilha",
          "Nível",
          "Média",
          "Votos",
        ],
        rows: selectedRows,
      },
      {
        heading: "Médias por critério",
        columns: ["#", "Título", ...criteriaKeys],
        rows: criteriaRows,
      },
      {
        heading: "Ranking completo",
        columns: [
          "#",
          "Título",
          "Palestrante",
          "Trilha",
          "Nível",
          "Média",
          "Votos",
          "Selecionada",
        ],
        rows: fullRows,
      },
      {
        heading: "Votação completa (avaliador × critério)",
        columns: ["Título", "Avaliador(a)", ...criteriaKeys, "Comentário"],
        rows: votesRows,
      },
    ],
  };
}

export async function downloadC4pReportPdf(
  model: C4pReportModel,
): Promise<void> {
  const [{ default: JsPdf }, { autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new JsPdf({ unit: "mm", format: "a4" });

  doc.setFontSize(18);
  doc.text(model.title, 14, 18);
  doc.setFontSize(12);
  doc.text(model.callName, 14, 26);
  doc.setFontSize(10);
  const finalized = model.finalizedAt
    ? new Date(model.finalizedAt).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })
    : "não finalizada";
  doc.text(
    `Finalizada em ${finalized} · Relatório gerado em ${new Date(model.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    14,
    32,
  );

  let y = 40;
  for (const line of model.criteriaLines) {
    doc.text(line, 14, y);
    y += 5;
  }
  y += 4;

  for (const table of model.tables) {
    doc.setFontSize(13);
    doc.text(table.heading, 14, y);
    autoTable(doc, {
      startY: y + 2,
      head: [table.columns],
      body: table.rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [55, 131, 105] },
    });
    const lastY = (
      doc as unknown as { lastAutoTable?: { finalY: number } }
    ).lastAutoTable?.finalY;
    y = (lastY ?? y) + 12;
  }

  doc.save(`relatorio-c4p-${model.callSlug}.pdf`);
}
