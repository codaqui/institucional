import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, useFetchMock } from "../../../test/http-mock";
import { renderWithMui } from "../../../test/render-mui";
import TransactionTable from "../TransactionTable";

const emptyPage = { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
const fetchMock = useFetchMock();

describe("TransactionTable", () => {
  beforeEach(() => {
    fetchMock.current.mockImplementation(() => Promise.resolve(jsonResponse(emptyPage)));
  });

  it("uses the same type, search, days and date range in listing and server export", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderWithMui(
      <TransactionTable accountId="acc-1" accountName="Dev Paraná" apiUrl="https://api.test" />,
    );
    await waitFor(() => expect(fetchMock.current).toHaveBeenCalledTimes(1));

    const selects = screen.getAllByRole("combobox");
    await user.click(selects[0]);
    await user.click(screen.getByRole("option", { name: "Doações" }));
    await user.click(selects[1]);
    await user.click(screen.getByRole("option", { name: "Últimos 3 meses" }));

    fireEvent.change(screen.getByPlaceholderText("Buscar na descrição…"), {
      target: { value: "octocat" },
    });
    await user.click(screen.getByRole("button", { name: "Buscar" }));
    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-10-31" } });

    await waitFor(() => {
      const url = String(fetchMock.current.mock.lastCall?.[0]);
      expect(url).toContain("type=donation");
      expect(url).toContain("search=octocat");
      expect(url).toContain("days=90");
      expect(url).toContain("from=2026-10-01");
      expect(url).toContain("to=2026-10-31");
    });

    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect(open).toHaveBeenCalledOnce();
    const exportUrl = new URL(String(open.mock.calls[0][0]));
    expect(exportUrl.origin + exportUrl.pathname).toBe(
      "https://api.test/ledger/accounts/acc-1/transactions/export",
    );
    expect(Object.fromEntries(exportUrl.searchParams)).toEqual({
      type: "donation",
      search: "octocat",
      days: "90",
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(exportUrl.searchParams.has("page")).toBe(false);
    expect(exportUrl.searchParams.has("limit")).toBe(false);
    open.mockRestore();
  });

  it("does not request or export an inverted range", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderWithMui(
      <TransactionTable accountId="acc-1" accountName="Dev Paraná" apiUrl="https://api.test" />,
    );
    await waitFor(() => expect(fetchMock.current).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Data inicial"), { target: { value: "2026-10-30" } });
    fireEvent.change(screen.getByLabelText("Data final"), { target: { value: "2026-10-29" } });

    expect(screen.getByRole("alert")).toHaveTextContent("data inicial");
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
    expect(fetchMock.current).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.current.mock.lastCall?.[0])).toContain("from=2026-10-30");
    expect(String(fetchMock.current.mock.lastCall?.[0])).not.toContain("to=");
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });
});
