import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CompanyDonationSection from "../index";
import { buildAuthState, mockUseAuth } from "../../../test-utils/auth";
import { jsonResponse } from "../../../test-utils/http";

jest.mock("../../../hooks/useAuth");
jest.mock("@stripe/stripe-js", () => ({
  loadStripe: jest.fn(() => Promise.resolve(null)),
}));
jest.mock("@stripe/react-stripe-js", () => ({
  EmbeddedCheckoutProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="embedded-provider">{children}</div>
  ),
  EmbeddedCheckout: () => <div data-testid="embedded-checkout" />,
}));

const companyUser = { sub: "u-1", handle: "mentoriacodaqui", name: "Mentoria Codaqui" } as const;

describe("CompanyDonationSection", () => {
  it("envia o valor customizado atualizado no checkout empresarial", async () => {
    const authFetch = jest.fn(async (url: string, options?: RequestInit) => {
      if (url === "/companies/me") {
        return jsonResponse({
          id: "company-1",
          name: "Mentoria Codaqui",
          cnpj: "44593429000105",
          status: "active",
        });
      }
      if (url === "/stripe/checkout-session/company" && options?.method === "POST") {
        return jsonResponse({ clientSecret: "cs_test_123" });
      }
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      user: companyUser as any,
      authFetch: authFetch as any,
    }));

    render(<CompanyDonationSection onBack={jest.fn()} />);

    await screen.findByRole("button", { name: /Ir para pagamento/i });
    fireEvent.click(screen.getByRole("button", { name: /Personalizado/i }));
    fireEvent.change(screen.getByLabelText(/Valor personalizado/i), {
      target: { value: "500,00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ir para pagamento/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        "/stripe/checkout-session/company",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const checkoutCall = authFetch.mock.calls.find(
      ([url]) => url === "/stripe/checkout-session/company",
    );
    const body = JSON.parse((checkoutCall?.[1] as RequestInit).body as string) as {
      companyId: string;
      subscriptionAmountCents: number;
    };
    expect(body.companyId).toBe("company-1");
    expect(body.subscriptionAmountCents).toBe(50_000);
  });

  it("bloqueia custom abaixo de R$ 200 com mensagem de validação", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url === "/companies/me") {
        return jsonResponse({
          id: "company-1",
          name: "Mentoria Codaqui",
          cnpj: "44593429000105",
          status: "active",
        });
      }
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      user: companyUser as any,
      authFetch: authFetch as any,
    }));

    render(<CompanyDonationSection onBack={jest.fn()} />);

    await screen.findByRole("button", { name: /Ir para pagamento/i });
    fireEvent.click(screen.getByRole("button", { name: /Personalizado/i }));
    fireEvent.change(screen.getByLabelText(/Valor personalizado/i), {
      target: { value: "100,00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ir para pagamento/i }));

    expect(await screen.findByText(/valor mínimo é R\$ 200,00\/mês/i)).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalledWith(
      "/stripe/checkout-session/company",
      expect.anything(),
    );
  });

  it("usa o plano padrão de R$ 200 quando não há customização", async () => {
    const authFetch = jest.fn(async (url: string, options?: RequestInit) => {
      if (url === "/companies/me") {
        return jsonResponse({
          id: "company-1",
          name: "Mentoria Codaqui",
          cnpj: "44593429000105",
          status: "active",
        });
      }
      if (url === "/stripe/checkout-session/company" && options?.method === "POST") {
        return jsonResponse({ clientSecret: "cs_test_123" });
      }
      return jsonResponse(null, { ok: false, status: 404 });
    });

    mockUseAuth.mockReturnValue(buildAuthState({
      user: companyUser as any,
      authFetch: authFetch as any,
    }));

    render(<CompanyDonationSection onBack={jest.fn()} />);

    await screen.findByRole("button", { name: /Ir para pagamento/i });
    fireEvent.click(screen.getByRole("button", { name: /Ir para pagamento/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        "/stripe/checkout-session/company",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const checkoutCall = authFetch.mock.calls.find(
      ([url]) => url === "/stripe/checkout-session/company",
    );
    const body = JSON.parse((checkoutCall?.[1] as RequestInit).body as string) as {
      subscriptionAmountCents: number;
    };
    expect(body.subscriptionAmountCents).toBe(20_000);
  });
});
