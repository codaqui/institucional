import { describe, expect, it } from "vitest";
import { slugifyTag } from "./slugify-tag";

// Pares observados: tag no frontmatter de blog/*.md(x) → slug em build/blog/category/<slug>.html
const PAIRS: [string, string][] = [
  ["história", "historia"],
  ["devparaná", "devparana"],
  ["Diversidade e Inclusão", "diversidade-e-inclusao"],
  ["financiamento coletivo", "financiamento-coletivo"],
  ["open source", "open-source"],
  ["mulheres na tech", "mulheres-na-tech"],
  ["quero ajudar", "quero-ajudar"],
  ["python brasil", "python-brasil"],
  ["Institucional", "institucional"],
  ["Curiosidade", "curiosidade"],
  ["programação", "programacao"],
  ["prestacao-de-contas", "prestacao-de-contas"],
  ["truncamentodedados", "truncamentodedados"],
  ["queroajudar", "queroajudar"],
  ["C++", "c"],
  ["c4p", "c-4-p"],
  ["ipv4", "ipv-4"],
];

describe("slugifyTag", () => {
  it.each(PAIRS)("%s → %s", (tag, slug) => {
    expect(slugifyTag(tag)).toBe(slug);
  });
});
