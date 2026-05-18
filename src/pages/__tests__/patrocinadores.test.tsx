import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PatrocinadoresPage from "../patrocinadores";

jest.mock("../../components/PageHero", () => ({
  __esModule: true,
  default: ({ title }: { title: string }) => <div data-testid="page-hero">{title}</div>,
}));

type MockResponse = Pick<Response, "ok" | "json">;

function jsonResponse(data: unknown, ok = true): MockResponse {
  return {
    ok,
    json: async () => data,
  };
}

const sponsors = [
  {
    id: "s-1",
    name: "Empresa A",
    logoUrl: null,
    websiteUrl: "https://empresa-a.dev",
    status: "active",
    totalSupportedReais: 500,
    supportCount: 2,
    monthsSupporting: 3,
  },
  {
    id: "s-2",
    name: "Empresa B",
    logoUrl: null,
    websiteUrl: null,
    status: "active",
    totalSupportedReais: 700,
    supportCount: 1,
    monthsSupporting: 1,
  },
];

describe("/patrocinadores", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock | undefined)?.mockReset?.();
  });

  it("renderiza patrocinadores com somatórios e cards", async () => {
    (global.fetch as any) = jest.fn((url: string) => {
      if (url.includes("/companies/sponsors?page=1&limit=12")) {
        return Promise.resolve(
          jsonResponse({
            items: sponsors,
            total: 24,
            page: 1,
            limit: 12,
          }),
        );
      }
      return Promise.resolve(jsonResponse({ items: [], total: 0, page: 1, limit: 12 }));
    });

    render(<PatrocinadoresPage />);

    expect(await screen.findByText("Empresa A")).toBeInTheDocument();
    expect(screen.getByText("Empresa B")).toBeInTheDocument();
    expect(screen.getByText(/1\.200,00/)).toBeInTheDocument();
    expect(screen.getByText(/Apoios confirmados/i)).toBeInTheDocument();
    expect(screen.getByText(/Meses apoiando \(página atual\)/i)).toBeInTheDocument();
    expect(screen.getByText(/500,00/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Visitar site/i })).toHaveAttribute(
      "href",
      "https://empresa-a.dev",
    );
  });

  it("faz nova requisição ao trocar a paginação", async () => {
    (global.fetch as any) = jest.fn((url: string) => {
      if (url.includes("/companies/sponsors?page=1&limit=12")) {
        return Promise.resolve(jsonResponse({ items: sponsors, total: 24, page: 1, limit: 12 }));
      }
      if (url.includes("/companies/sponsors?page=2&limit=12")) {
        return Promise.resolve(jsonResponse({ items: [], total: 24, page: 2, limit: 12 }));
      }
      return Promise.resolve(jsonResponse({ items: [], total: 0, page: 1, limit: 12 }));
    });

    render(<PatrocinadoresPage />);

    await screen.findByText("Empresa A");
    fireEvent.click(screen.getByRole("button", { name: /go to page 2/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/companies/sponsors?page=2&limit=12"),
      );
    });
  });

  it("mostra estado vazio quando não há patrocinadores", async () => {
    (global.fetch as any) = jest.fn(() =>
      Promise.resolve(jsonResponse({ items: [], total: 0, page: 1, limit: 12 })),
    );

    render(<PatrocinadoresPage />);

    expect(await screen.findByText(/Nenhum patrocinador ativo no momento/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Quero apoiar como empresa/i })).toHaveAttribute(
      "href",
      "/participe/apoiar",
    );
  });
});
