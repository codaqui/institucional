import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanyOneTimeDonationIsland from "../CompanyOneTimeDonationIsland";
import { renderWithMui } from "../../../test/render-mui";

let authFetch = vi.fn();
let loggedIn = true;
const company = {
  id: "company-1",
  name: "Empresa X",
  cnpj: "12345678000199",
  status: "pending",
  logoUrl: null,
  websiteUrl: null,
};

vi.mock("../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: { name: "Responsável", handle: "responsavel", avatarUrl: "" },
    ready: true,
    isLoggedIn: loggedIn,
    login: vi.fn(),
    authFetch,
  }),
}));

vi.mock("../StripeCheckoutDialog", () => ({
  default: ({ clientSecret, onComplete }: { clientSecret: string | null; onComplete: () => void }) => (
    clientSecret ? <button onClick={onComplete}>Concluir pagamento {clientSecret}</button> : null
  ),
}));

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("CompanyOneTimeDonationIsland", () => {
  beforeEach(() => {
    loggedIn = true;
    window.history.replaceState({}, "", "/participe/apoiar?modo=empresa&apoio=unica");
    authFetch = vi.fn((path: string) => {
      if (path === "/companies/me") return Promise.resolve(response(company));
      if (path === "/stripe/checkout-session/company/one-time") {
        return Promise.resolve(response({ clientSecret: "cs_company_once" }));
      }
      return Promise.resolve(response({}, 404));
    });
  });

  it("submits company, community and amount, then completes checkout", async () => {
    const user = userEvent.setup();
    renderWithMui(<CompanyOneTimeDonationIsland />);

    expect(await screen.findByText(/já cadastrada/)).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Destino da doação" }));
    await user.click(await screen.findByRole("option", { name: "DevParaná" }));
    const amount = screen.getByRole("textbox", { name: "Valor da doação (R$)" });
    await user.clear(amount);
    await user.type(amount, "30,00");
    await user.click(screen.getByRole("button", { name: /Doar R\$\s*30,00/ }));

    const checkout = await screen.findByRole("button", { name: /Concluir pagamento cs_company_once/ });
    expect(authFetch).toHaveBeenCalledWith("/stripe/checkout-session/company/one-time", {
      method: "POST",
      body: JSON.stringify({
        companyId: "company-1",
        amount: 3000,
        communityId: "devparana",
        uiMode: "embedded_page",
        returnPath: "/participe/apoiar?modo=empresa&apoio=unica",
      }),
    });
    await user.click(checkout);
    expect(await screen.findByText(/Doação confirmada/)).toBeInTheDocument();
  });

  it("accepts an amount above R$ 1.000 up to the backend limit", async () => {
    const user = userEvent.setup();
    renderWithMui(<CompanyOneTimeDonationIsland />);

    expect(await screen.findByText(/já cadastrada/)).toBeInTheDocument();
    const amount = screen.getByRole("textbox", { name: "Valor da doação (R$)" });
    await user.clear(amount);
    await user.type(amount, "5000,00");
    await user.click(screen.getByRole("button", { name: /Doar R\$\s*5\.000,00/ }));

    expect(authFetch).toHaveBeenCalledWith("/stripe/checkout-session/company/one-time", expect.objectContaining({
      body: expect.stringContaining('"amount":500000'),
    }));
  });

  it("shows field errors only after submit without calling checkout", async () => {
    authFetch = vi.fn((path: string) => {
      if (path === "/companies/me") return Promise.resolve(response(null));
      return Promise.resolve(response({}, 404));
    });
    const user = userEvent.setup();
    renderWithMui(<CompanyOneTimeDonationIsland />);

    await user.click(await screen.findByRole("button", { name: /Doar R\$\s*25,00/ }));

    expect(await screen.findByText("CNPJ deve ter 14 dígitos.")).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalledWith("/companies", expect.anything());
    expect(authFetch).not.toHaveBeenCalledWith("/stripe/checkout-session/company/one-time", expect.anything());
  });

  it("confirms a successful hosted checkout return", async () => {
    window.history.replaceState({}, "", "/participe/apoiar?modo=empresa&apoio=unica&status=success");
    renderWithMui(<CompanyOneTimeDonationIsland />);

    expect(await screen.findByText(/Doação confirmada/)).toBeInTheDocument();
  });

  it("requires login and explains the cancelled checkout", async () => {
    loggedIn = false;
    window.history.replaceState({}, "", "/participe/apoiar?modo=empresa&apoio=unica&status=cancelled");
    renderWithMui(<CompanyOneTimeDonationIsland />);

    expect(await screen.findByText(/Você precisa estar logado/)).toBeInTheDocument();
    expect(screen.getByText(/pagamento foi cancelado/)).toBeInTheDocument();
  });
});
