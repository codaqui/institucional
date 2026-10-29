/**
 * Testes da ApiDocsIsland — documentação da API (/desenvolvedores/api).
 * Cobre: fetch do spec em <api>/docs-json (padrão resolveApiUrl das ilhas),
 * estados (loading skeleton → ready / error Alert), as opções do Swagger UI
 * (deepLinking, persistAuthorization) e o retry via "Tentar novamente".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApiDocsIsland from "../ApiDocsIsland";
import { renderWithMui } from "../../../test/render-mui";

const swaggerUiMock = vi.hoisted(() => vi.fn());

vi.mock("../../../lib/api-url", () => ({
  resolveApiUrl: () => "https://api.test",
}));

// O bundle real do swagger-ui (~1,7MB) nunca entra no teste — o mock simula
// a montagem imperativa no container apontado por `dom_id`.
vi.mock("swagger-ui-dist/swagger-ui-es-bundle.js", () => ({
  default: (opts: { dom_id: string; spec: unknown }) => {
    swaggerUiMock(opts);
    document
      .querySelector(opts.dom_id)
      ?.setAttribute("data-swagger-loaded", "true");
  },
}));

let fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ApiDocsIsland", () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    swaggerUiMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mostra skeleton acessível enquanto o spec não resolve", () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // nunca resolve

    renderWithMui(<ApiDocsIsland />);

    expect(
      screen.getByLabelText(/Carregando documentação da API/),
    ).toBeInTheDocument();
    expect(swaggerUiMock).not.toHaveBeenCalled();
  });

  it("carrega o spec de /docs-json e monta o Swagger UI com as opções certas", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ openapi: "3.0.0", info: { title: "Codaqui API" } }),
    );

    renderWithMui(<ApiDocsIsland />);

    const container = await screen.findByTestId("api-docs-container");
    await waitFor(() =>
      expect(container).toHaveAttribute("data-swagger-loaded", "true"),
    );

    expect(fetchMock).toHaveBeenCalledWith("https://api.test/docs-json");
    expect(swaggerUiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dom_id: "#cq-api-docs",
        deepLinking: true,
        persistAuthorization: true,
        spec: expect.objectContaining({ openapi: "3.0.0" }),
      }),
    );
    // após o ready o skeleton some
    expect(
      screen.queryByLabelText(/Carregando documentação da API/),
    ).not.toBeInTheDocument();
  });

  it("exibe alerta com link para o OpenAPI JSON quando o spec falha (HTTP 5xx)", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 503));

    renderWithMui(<ApiDocsIsland />);

    expect(
      await screen.findByText(/Documentação indisponível no momento/),
    ).toBeInTheDocument();
    const directLink = screen.getByRole("link", { name: /OpenAPI JSON direto/i });
    expect(directLink).toHaveAttribute("href", "https://api.test/docs-json");
    expect(directLink).toHaveAttribute("target", "_blank");
    expect(directLink).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(swaggerUiMock).not.toHaveBeenCalled();
  });

  it("exibe alerta quando o fetch rejeita (falha de rede)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    renderWithMui(<ApiDocsIsland />);

    expect(
      await screen.findByText(/Documentação indisponível no momento/),
    ).toBeInTheDocument();
  });

  it("botão Tentar novamente refaz o fetch e monta o Swagger UI", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    renderWithMui(<ApiDocsIsland />);
    expect(
      await screen.findByText(/Documentação indisponível no momento/),
    ).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(jsonResponse({ openapi: "3.0.0" }));
    await userEvent.click(
      screen.getByRole("button", { name: /Tentar novamente/i }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByTestId("api-docs-container")).toHaveAttribute(
        "data-swagger-loaded",
        "true",
      ),
    );
  });
});
