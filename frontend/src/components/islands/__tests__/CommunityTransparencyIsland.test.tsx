/**
 * Testes da CommunityTransparencyIsland (Fase 0.5) — port community-scoped da
 * parte dinâmica de CommunityTransparenciaPage (useCommunityBalance +
 * TransactionTable). Cobre: saldo renderizado em BRL com a conta do slug,
 * estado sem conta (info), estado de erro (warning) e o contrato da tabela.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import CommunityTransparencyIsland from "../CommunityTransparencyIsland";
import { renderWithMui } from "../../../test/render-mui";
import type { CommunityBalance } from "../../../lib/transaction";

let fetchMock = vi.fn();
const tableSpy = vi.fn();

vi.mock("../../../lib/api-url", () => ({
  resolveApiUrl: () => "https://api.test",
}));

vi.mock("../TransactionTable", () => ({
  default: (props: { accountId: string; accountName: string; apiUrl: string }) => {
    tableSpy(props);
    return <div data-testid="tx-table" />;
  },
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const tisocialBalance: CommunityBalance = {
  id: "acc-tisocial",
  projectKey: "tisocial",
  name: "T.I. Social",
  balance: 1234.56,
};

describe("CommunityTransparencyIsland", () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    tableSpy.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza o saldo da comunidade e monta a tabela com a conta certa", async () => {
    fetchMock.mockResolvedValue(jsonResponse([tisocialBalance]));

    renderWithMui(<CommunityTransparencyIsland slug="tisocial" />);

    expect(await screen.findByText("R$ 1.234,56")).toBeInTheDocument();
    expect(screen.getByText("(tisocial)")).toBeInTheDocument();
    expect(screen.getByTestId("tx-table")).toBeInTheDocument();
    expect(tableSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: "acc-tisocial",
        accountName: "T.I. Social",
        apiUrl: "https://api.test",
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/ledger/community-balances",
    );
  });

  it("exibe aviso informativo quando a comunidade não tem conta", async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));

    renderWithMui(<CommunityTransparencyIsland slug="tisocial" />);

    expect(
      await screen.findByText(/Nenhuma conta encontrada para esta comunidade/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("tx-table")).not.toBeInTheDocument();
  });

  it("exibe alerta de warning quando o ledger falha", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 503));

    renderWithMui(<CommunityTransparencyIsland slug="tisocial" />);

    expect(
      await screen.findByText(/Não foi possível carregar o saldo no momento/),
    ).toBeInTheDocument();
  });
});
