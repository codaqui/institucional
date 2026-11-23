/**
 * Testes da CommunityTransparencyIsland (Fase 0.5) — port community-scoped da
 * parte dinâmica de CommunityTransparenciaPage (useCommunityBalance +
 * TransactionTable). Cobre: saldo renderizado em BRL com a conta do slug,
 * estado sem conta (info), estado de erro (warning) e o contrato da tabela.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([tisocialBalance])));

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
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([])));

    renderWithMui(<CommunityTransparencyIsland slug="tisocial" />);

    expect(
      await screen.findByText(/Nenhuma conta encontrada para esta comunidade/),
    ).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tx-table")).not.toBeInTheDocument();
  });

  it("exibe alerta de warning quando o ledger falha", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({}, 503)));

    renderWithMui(<CommunityTransparencyIsland slug="tisocial" />);

    expect(
      await screen.findByText(/Não foi possível carregar o saldo no momento/),
    ).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente saldo" })).toBeInTheDocument();
  });
});

const activityProjection = {
  community: { slug: "tisocial", name: "T.I. Social" },
  responsible: {
    id: "member-1",
    name: "Maria Responsável",
    githubHandle: "maria",
    avatarUrl: null,
  },
  year: null,
  availableYears: [2025, 2026],
  metrics: { events: 2, participations: 30, certificates: 10, eventHours: 4.5 },
  upcomingActivities: [{ key: "next", title: "Próximo encontro", kind: "managed", startAt: "2026-12-01T12:00:00.000Z" }],
  recentActivities: [{ key: "past", title: "Encontro anterior", kind: "external", startAt: "2026-01-01T12:00:00.000Z" }],
};

function mockCommunityRequests(transparencyResponse: () => Response, balanceResponse: () => Response = () => jsonResponse([tisocialBalance])) {
  fetchMock.mockImplementation((url: string) => Promise.resolve(
    url.includes("/ledger/community-balances") ? balanceResponse() : transparencyResponse(),
  ));
}

describe("CommunityTransparencyIsland activities", () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    tableSpy.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows real activity metrics and responsible people before finances", async () => {
    mockCommunityRequests(() => jsonResponse(activityProjection));
    renderWithMui(<CommunityTransparencyIsland slug="tisocial" />);

    expect(await screen.findByText("Próximo encontro")).toBeInTheDocument();
    expect(screen.getByText("horas de voluntariado em eventos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Maria Responsável/ })).toBeInTheDocument();
    expect(screen.getByText("Encontro anterior")).toBeInTheDocument();
    expect(await screen.findByText("R$ 1.234,56")).toBeInTheDocument();
  });

  it("requests a selected year and renders an explicit empty state", async () => {
    const empty = { ...activityProjection, year: 2026, metrics: { events: 0, participations: 0, certificates: 0, eventHours: 0 }, upcomingActivities: [], recentActivities: [] };
    mockCommunityRequests(() => jsonResponse(empty));
    const user = userEvent.setup();
    renderWithMui(<CommunityTransparencyIsland slug="tisocial" />);

    expect(await screen.findByText(/Nenhuma atividade registrada/)).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Período" }));
    await user.click(await screen.findByRole("option", { name: "2026" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/communities/public/tisocial/transparency?year=2026",
      { signal: expect.any(AbortSignal) },
    ));
  });

  it("retries activities without unmounting financial transactions", async () => {
    let attempts = 0;
    mockCommunityRequests(() => {
      attempts += 1;
      return attempts === 1 ? jsonResponse({}, 503) : jsonResponse(activityProjection);
    });
    const user = userEvent.setup();
    renderWithMui(<CommunityTransparencyIsland slug="tisocial" />);

    expect(await screen.findByText(/Não foi possível carregar as atividades/)).toBeInTheDocument();
    expect(await screen.findByTestId("tx-table")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar novamente atividades" }));
    expect(await screen.findByText("Próximo encontro")).toBeInTheDocument();
    expect(screen.getByTestId("tx-table")).toBeInTheDocument();
  });

  it("keeps activities visible when finance fails", async () => {
    mockCommunityRequests(() => jsonResponse(activityProjection), () => jsonResponse({}, 503));
    renderWithMui(<CommunityTransparencyIsland slug="tisocial" />);

    expect(await screen.findByText("Próximo encontro")).toBeInTheDocument();
    expect(await screen.findByText(/Não foi possível carregar o saldo/)).toBeInTheDocument();
  });

  it("preserves a legitimate zero balance returned by the API", async () => {
    mockCommunityRequests(
      () => jsonResponse(activityProjection),
      () => jsonResponse([{ ...tisocialBalance, balance: 0 }]),
    );
    renderWithMui(<CommunityTransparencyIsland slug="tisocial" />);

    expect(await screen.findByText("R$ 0,00")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("retries balance without unmounting valid activities", async () => {
    let balanceAttempts = 0;
    mockCommunityRequests(
      () => jsonResponse(activityProjection),
      () => {
        balanceAttempts += 1;
        return balanceAttempts === 1 ? jsonResponse({}, 503) : jsonResponse([tisocialBalance]);
      },
    );
    const user = userEvent.setup();
    renderWithMui(<CommunityTransparencyIsland slug="tisocial" />);

    expect(await screen.findByText("Próximo encontro")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar novamente saldo" }));

    expect(await screen.findByText("R$ 1.234,56")).toBeInTheDocument();
    expect(screen.getByText("Próximo encontro")).toBeInTheDocument();
    expect(screen.getByTestId("tx-table")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/ledger/community-balances"))).toHaveLength(2);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/communities/public/"))).toHaveLength(1);
  });
});
