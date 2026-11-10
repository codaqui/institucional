import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithMui } from "../../test/render-mui";
import { jsonResponse, useFetchMock } from "../../test/http-mock";
import SponsorsIsland from "./SponsorsIsland";

const fetchMock = useFetchMock();

function sponsor(overrides = {}) {
  return {
    id: "company-1",
    name: "Empresa Teste",
    tradeName: null,
    logoUrl: null,
    websiteUrl: null,
    status: "active",
    tier: "amiga",
    sealValidUntil: null,
    sealActive: true,
    totalSupportedReais: 200,
    supportCount: 1,
    monthsSupporting: 1,
    ...overrides,
  };
}

describe("SponsorsIsland", () => {
  it("shows both tiers and keeps an expired Aliada visible with renewal guidance", async () => {
    fetchMock.current.mockResolvedValue(jsonResponse({
      items: [
        sponsor(),
        sponsor({ id: "company-2", name: "Aliada Vigente", tier: "aliada", sealValidUntil: "2027-11-10T00:00:00.000Z" }),
        sponsor({ id: "company-3", name: "Aliada Vencida", tier: "aliada", sealValidUntil: "2025-11-10T00:00:00.000Z", sealActive: false }),
      ],
      total: 3,
      page: 1,
      limit: 12,
    }));
    renderWithMui(<SponsorsIsland />);

    expect(await screen.findByText("Empresa Amiga Codaqui")).toBeInTheDocument();
    expect(screen.getAllByText("Empresa Aliada Codaqui")).toHaveLength(2);
    expect(screen.getByText("Renovação pendente")).toBeInTheDocument();
    expect(screen.getByText("Aliada Vencida")).toBeInTheDocument();
  });
});
