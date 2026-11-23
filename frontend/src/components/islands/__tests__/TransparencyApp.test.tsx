import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TransparencyApp from "../TransparencyApp";
import { renderWithMui } from "../../../test/render-mui";
import type { CommunityBalance, TransparencyStats } from "../../../lib/transaction";

let fetchMock = vi.fn();

vi.mock("../../../lib/api-url", () => ({
  resolveApiUrl: () => "https://api.test",
}));

vi.mock("../TransactionTable", () => ({
  default: () => <div data-testid="transaction-table" />,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const balances: CommunityBalance[] = [
  { id: "acc-devparana", projectKey: "devparana", name: "DevParaná", balance: 0 },
];

function stats(overrides: Partial<TransparencyStats> = {}): TransparencyStats {
  return {
    totalReceived: 0,
    totalExpenses: 0,
    totalTransactions: 0,
    totalEventTickets: 0,
    totalEventTicketRevenue: 0,
    uniqueDonors: 0,
    recentDonors: [],
    communityStats: [],
    ...overrides,
  };
}

function mockRequests({
  balanceResponse = () => jsonResponse(balances),
  statsResponse = () => jsonResponse(stats()),
}: {
  balanceResponse?: () => Response;
  statsResponse?: () => Response;
} = {}) {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/ledger/community-balances")) return Promise.resolve(balanceResponse());
    if (url.endsWith("/ledger/transparency-stats")) return Promise.resolve(statsResponse());
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

describe("TransparencyApp financial states", () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows unknown values instead of zero when both sources fail", async () => {
    mockRequests({
      balanceResponse: () => jsonResponse({}, 503),
      statsResponse: () => jsonResponse({}, 503),
    });

    renderWithMui(<TransparencyApp />);

    expect(await screen.findAllByText("—")).toHaveLength(5);
    expect(screen.queryByText("R$ 0,00")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente saldos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar novamente estatísticas" })).toBeInTheDocument();
    expect(screen.queryAllByRole("heading", { level: 4 })).toHaveLength(0);
  });

  it("preserves legitimate zero values returned by the API", async () => {
    mockRequests();

    renderWithMui(<TransparencyApp />);

    expect((await screen.findAllByText("R$ 0,00")).length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("retries only statistics without unmounting balance transactions", async () => {
    let statsAttempts = 0;
    mockRequests({
      statsResponse: () => {
        statsAttempts += 1;
        return statsAttempts === 1
          ? jsonResponse({}, 503)
          : jsonResponse(stats({ totalReceived: 1234.56 }));
      },
    });
    const user = userEvent.setup();

    renderWithMui(<TransparencyApp />);

    expect(await screen.findByTestId("transaction-table")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Tentar novamente estatísticas" }));

    expect(await screen.findByText(/R\$\s*1\.234,56/)).toBeInTheDocument();
    expect(screen.getByTestId("transaction-table")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/ledger/community-balances"))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/ledger/transparency-stats"))).toHaveLength(2);
  });
});
