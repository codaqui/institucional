import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CompanyDonationIsland from "../CompanyDonationIsland";
import { renderWithMui } from "../../../test/render-mui";

let authFetch = vi.fn();
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
    isLoggedIn: true,
    login: vi.fn(),
    authFetch,
  }),
}));

vi.mock("../StripeCheckoutDialog", () => ({
  default: ({ clientSecret }: { clientSecret: string | null }) => (
    clientSecret ? <div data-testid="stripe-checkout">{clientSecret}</div> : null
  ),
}));

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("CompanyDonationIsland subscription", () => {
  beforeEach(() => {
    authFetch = vi.fn((path: string) => {
      if (path === "/companies/me") return Promise.resolve(response(company));
      if (path === "/stripe/checkout-session/company") {
        return Promise.resolve(response({ clientSecret: "cs_company_subscription" }));
      }
      return Promise.resolve(response({}, 404));
    });
  });

  it("preserves the monthly checkout for an existing company", async () => {
    const user = userEvent.setup();
    renderWithMui(<CompanyDonationIsland />);

    expect(await screen.findByText(/já cadastrada/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Apoiar com R\$\s*200,00\/mês/ }));

    expect(await screen.findByTestId("stripe-checkout")).toHaveTextContent("cs_company_subscription");
    expect(authFetch).toHaveBeenCalledWith("/stripe/checkout-session/company", {
      method: "POST",
      body: JSON.stringify({ companyId: "company-1", subscriptionAmountCents: 20000 }),
    });
    expect(authFetch).not.toHaveBeenCalledWith("/companies", expect.anything());
  });
});
