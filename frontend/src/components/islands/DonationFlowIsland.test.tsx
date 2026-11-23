import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithMui } from "../../test/render-mui";
import { jsonResponse, useFetchMock } from "../../test/http-mock";
import DonationFlowIsland from "./DonationFlowIsland";

const { authFetchMock } = vi.hoisted(() => ({ authFetchMock: vi.fn() }));
vi.mock("../../lib/use-auth", () => ({
  useAuth: () => ({
    user: {
      sub: "member-1",
      githubId: "1",
      handle: "donor",
      name: "Donor",
      avatarUrl: "",
      roles: ["membro"],
    },
    ready: true,
    isLoggedIn: true,
    authFetch: authFetchMock,
    login: vi.fn(),
  }),
}));

const fetchMock = useFetchMock();

function renderFlow() {
  fetchMock.current.mockResolvedValue(jsonResponse([]));
  authFetchMock.mockReset();
  authFetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
  renderWithMui(<DonationFlowIsland lockedTargetId="tesouro-geral" hideWallets />);
  return userEvent.setup();
}

function customInput() {
  return screen.getByRole("textbox", { name: /^outro valor$/i });
}

function donateButton() {
  return screen.getByRole("button", { name: /apoiar com/i });
}

describe("DonationFlowIsland valor livre", () => {
  it("mantém o estado neutro e o botão habilitado ao focar sem digitar", async () => {
    const user = renderFlow();

    await user.click(customInput());

    expect(customInput()).toHaveValue("");
    expect(customInput()).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/mínimo de r\$ 1,00 e máximo de r\$ 1\.000,00/i)).toBeInTheDocument();
    expect(donateButton()).toBeEnabled();
  });

  it("envia o valor digitado em centavos", async () => {
    const user = renderFlow();

    await user.type(customInput(), "15,50");
    expect(donateButton()).toHaveTextContent("R$ 15,50");
    await user.click(donateButton());

    expect(authFetchMock).toHaveBeenCalledTimes(1);
    const [path, init] = authFetchMock.mock.calls[0];
    expect(path).toBe("/stripe/checkout-session");
    expect(JSON.parse(init.body)).toMatchObject({
      amount: 1550,
      communityId: "tesouro-geral",
      recurring: { interval: "month" },
    });
  });

  it("bloqueia valor abaixo de R$ 1,00", async () => {
    const user = renderFlow();

    await user.type(customInput(), "0,99");

    expect(await screen.findByText(/o valor mínimo é r\$\s1,00/i)).toBeInTheDocument();
    expect(donateButton()).toBeDisabled();
    expect(authFetchMock).not.toHaveBeenCalled();
  });

  it("bloqueia valor acima de R$ 1.000,00", async () => {
    const user = renderFlow();

    await user.type(customInput(), "1000,01");

    expect(await screen.findByText(/o valor máximo é r\$\s1\.000,00/i)).toBeInTheDocument();
    expect(donateButton()).toBeDisabled();
  });

  it("aceita os limites e volta para o preset ao clicar nele", async () => {
    const user = renderFlow();

    await user.type(customInput(), "1000");
    expect(donateButton()).toBeEnabled();
    expect(donateButton()).toHaveTextContent("R$ 1.000,00");

    await user.clear(customInput());
    await user.type(customInput(), "1");
    expect(donateButton()).toBeEnabled();
    expect(donateButton()).toHaveTextContent("R$ 1,00");

    await user.click(screen.getByRole("button", { name: "R$ 50" }));
    expect(customInput()).toHaveValue("");
    expect(donateButton()).toHaveTextContent("R$ 50");
    expect(donateButton()).toBeEnabled();
  });
});
