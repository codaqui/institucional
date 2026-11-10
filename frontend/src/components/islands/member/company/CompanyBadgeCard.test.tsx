import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithMui } from "../../../../test/render-mui";
import CompanyBadgeCard from "./CompanyBadgeCard";

const company = {
  id: "company-1",
  name: "Empresa Teste",
  cnpj: "11222333000181",
  status: "active",
  responsibleMemberId: "member-1",
  tier: "aliada" as const,
  sealValidUntil: "2027-11-10T00:00:00.000Z",
  sealActive: true,
};

describe("CompanyBadgeCard", () => {
  it("shows the active badge and embed snippets", () => {
    renderWithMui(<CompanyBadgeCard company={company} />);

    expect(screen.getByRole("img", { name: "Selo Empresa Aliada Codaqui" })).toHaveAttribute("src", "/badges/empresas/company-1.svg");
    expect(screen.getByDisplayValue(/!\[Selo Empresa Aliada Codaqui\]/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/<img src=/)).toBeInTheDocument();
  });

  it("shows renewal guidance instead of an invalid badge", () => {
    renderWithMui(<CompanyBadgeCard company={{ ...company, sealActive: false }} />);

    expect(screen.getByText(/renovação pendente/i)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("describes the Amiga badge while the support is active", () => {
    renderWithMui(<CompanyBadgeCard company={{ ...company, tier: "amiga", sealValidUntil: null }} />);

    expect(screen.getByRole("img", { name: "Selo Empresa Amiga Codaqui" })).toBeInTheDocument();
    expect(screen.getByText(/apoio ativo/i)).toBeInTheDocument();
  });
});
