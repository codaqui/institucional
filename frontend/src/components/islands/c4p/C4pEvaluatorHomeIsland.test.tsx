import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import C4pEvaluatorHomeIsland from "./C4pEvaluatorHomeIsland";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse } from "../../../test/http-mock";

const mocks = vi.hoisted(() => {
  const state = { isLoggedIn: true };
  return {
    state,
    authFetch: vi.fn(),
    login: vi.fn(),
  };
});

vi.mock("../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: mocks.state.isLoggedIn,
    isAdmin: false,
    user: mocks.state.isLoggedIn
      ? { sub: "eval-1", handle: "evaluator", roles: ["membro"] }
      : null,
    login: mocks.login,
    authFetch: mocks.authFetch,
  }),
}));

describe("C4pEvaluatorHomeIsland", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.isLoggedIn = true;
  });

  it("deslogado: mostra botão Entrar", () => {
    mocks.state.isLoggedIn = false;
    renderWithMui(<C4pEvaluatorHomeIsland />);
    expect(screen.getByRole("button", { name: /entrar para avaliar/i })).toBeTruthy();
  });

  it("logado: lista convites pendentes e campanhas ativas", async () => {
    mocks.authFetch.mockResolvedValue(
      jsonResponse([
        {
          designationId: "des-1",
          status: "pending",
          call: { id: "call-1", slug: "devpr-conf-2026", name: "C4P DevPR", status: "open" },
        },
        {
          designationId: "des-2",
          status: "active",
          call: { id: "call-2", slug: "outra", name: "Outra chamada", status: "open" },
        },
      ]),
    );
    renderWithMui(<C4pEvaluatorHomeIsland />);
    expect(await screen.findByText("C4P DevPR")).toBeTruthy();
    expect(screen.getByText("Outra chamada")).toBeTruthy();
    expect(screen.getByRole("button", { name: /aceitar convite/i })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /avaliar propostas/i })).toHaveLength(1);
  });

  it("aceitar convite faz POST e atualiza a lista", async () => {
    mocks.authFetch
      .mockResolvedValueOnce(
        jsonResponse([
          {
            designationId: "des-1",
            status: "pending",
            call: { id: "call-1", slug: "devpr-conf-2026", name: "C4P DevPR", status: "open" },
          },
        ]),
      )
      .mockResolvedValueOnce(jsonResponse({ id: "des-1", status: "active" }))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            designationId: "des-1",
            status: "active",
            call: { id: "call-1", slug: "devpr-conf-2026", name: "C4P DevPR", status: "open" },
          },
        ]),
      );
    renderWithMui(<C4pEvaluatorHomeIsland />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /aceitar convite/i }));
    await waitFor(() =>
      expect(mocks.authFetch).toHaveBeenCalledWith(
        "/c4p/evaluator/designations/des-1/accept",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /aceitar convite/i })).toBeNull(),
    );
  });
});
