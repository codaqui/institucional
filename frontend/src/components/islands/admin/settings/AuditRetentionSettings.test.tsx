import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";
import AuditRetentionSettings from "./AuditRetentionSettings";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    isAdmin: true,
    authFetch: mocks.authFetch,
  }),
}));

function lastPutCall() {
  return mocks.authFetch.mock.calls.findLast(
    ([url, init]) => url === "/settings/audit-retention" && init?.method === "PUT",
  );
}

describe("AuditRetentionSettings", () => {
  beforeEach(() => {
    mocks.authFetch.mockReset();
    mocks.authFetch.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return jsonResponse({ retentionDays: 45, source: "setting" });
      }
      return jsonResponse({ retentionDays: 30, source: "env" });
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the effective value and its source", async () => {
    renderWithMui(<AuditRetentionSettings />);

    expect(await screen.findByDisplayValue("30")).toBeInTheDocument();
    expect(screen.getByText("Origem: env")).toBeInTheDocument();
    expect(mocks.authFetch).toHaveBeenCalledWith("/settings/audit-retention");
  });

  it("requires confirmation before saving", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithMui(<AuditRetentionSettings />);
    const input = await screen.findByLabelText(/Retenção operacional/);

    await user.clear(input);
    await user.type(input, "45");
    await user.click(screen.getByRole("button", { name: "Salvar retenção" }));

    expect(window.confirm).toHaveBeenCalled();
    expect(lastPutCall()).toBeUndefined();
  });

  it.each([7, 365])("saves the inclusive boundary %s after confirmation", async (days) => {
    const user = userEvent.setup();
    renderWithMui(<AuditRetentionSettings />);
    const input = await screen.findByLabelText(/Retenção operacional/);

    await user.clear(input);
    await user.type(input, String(days));
    await user.click(screen.getByRole("button", { name: "Salvar retenção" }));

    await waitFor(() => expect(lastPutCall()).toBeDefined());
    expect(JSON.parse(String(lastPutCall()?.[1]?.body))).toEqual({
      retentionDays: days,
    });
  });

  it.each([6, 366])("rejects out-of-range value %s without calling the API", async (days) => {
    const user = userEvent.setup();
    renderWithMui(<AuditRetentionSettings />);
    const input = await screen.findByLabelText(/Retenção operacional/);

    await user.clear(input);
    await user.type(input, String(days));
    await user.click(screen.getByRole("button", { name: "Salvar retenção" }));

    expect(screen.getByText("Informe um número inteiro entre 7 e 365.")).toBeInTheDocument();
    expect(lastPutCall()).toBeUndefined();
  });

  it("surfaces API errors and keeps the form available", async () => {
    const user = userEvent.setup();
    mocks.authFetch.mockImplementation(async (_path: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return jsonResponse({ message: "Retenção inválida." }, { status: 400 });
      }
      return jsonResponse({ retentionDays: 30, source: "env" });
    });
    renderWithMui(<AuditRetentionSettings />);
    const input = await screen.findByLabelText(/Retenção operacional/);

    await user.clear(input);
    await user.type(input, "45");
    await user.click(screen.getByRole("button", { name: "Salvar retenção" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Retenção inválida.");
    expect(input).toBeEnabled();
  });
});
