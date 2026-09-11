import React, { act } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CompanyDonationSection from "../index";
import { buildAuthState, mockUseAuth } from "../../../test-utils/auth";
import { jsonResponse } from "../../../test-utils/http";

jest.mock("../../../hooks/useAuth");
jest.mock("@docusaurus/useDocusaurusContext", () => ({
  __esModule: true,
  default: () => ({
    siteConfig: {
      url: "https://codaqui.dev",
      customFields: { stripePublishableKey: "pk_test_123" },
    },
  }),
}));
jest.mock("@stripe/stripe-js", () => ({
  loadStripe: jest.fn(() => Promise.resolve(null)),
}));

let mockEmbeddedCheckoutOptions: { onComplete?: () => void } | undefined;
jest.mock("@stripe/react-stripe-js", () => ({
  EmbeddedCheckoutProvider: ({
    children,
    options,
  }: {
    children: React.ReactNode;
    options?: { onComplete?: () => void };
  }) => {
    mockEmbeddedCheckoutOptions = options;
    return <div data-testid="embedded-provider">{children}</div>;
  },
  EmbeddedCheckout: () => <div data-testid="embedded-checkout" />,
}));

const companyUser = { sub: "u-1", handle: "mentoriacodaqui", name: "Mentoria Codaqui" } as const;
const companyProfile = {
  id: "company-1",
  name: "Mentoria Codaqui",
  cnpj: "44593429000105",
  status: "active",
};
const checkoutPath = "/stripe/checkout-session/company";

function buildCompanyAuthFetch({
  allowCheckout = true,
}: {
  allowCheckout?: boolean;
} = {}) {
  return jest.fn(async (url: string, options?: RequestInit) => {
    if (url === "/companies/me") return jsonResponse(companyProfile);
    if (allowCheckout && url === checkoutPath && options?.method === "POST") {
      return jsonResponse({ clientSecret: "cs_test_123" });
    }
    return jsonResponse(null, { ok: false, status: 404 });
  });
}

function renderWithAuth(authFetch: jest.Mock): void {
  mockUseAuth.mockReturnValue(buildAuthState({
    user: companyUser as any,
    authFetch: authFetch as any,
  }));
  render(<CompanyDonationSection onBack={jest.fn()} />);
}

async function submitCheckout(customValue?: string): Promise<void> {
  const checkoutButtonMatcher = /Apoiar com|Cadastrar empresa e apoiar com/i;
  await screen.findByRole("button", { name: checkoutButtonMatcher });
  if (customValue) {
    fireEvent.click(screen.getByRole("button", { name: /Personalizado/i }));
    fireEvent.change(screen.getByLabelText(/Valor personalizado/i), {
      target: { value: customValue },
    });
  }
  fireEvent.click(screen.getByRole("button", { name: checkoutButtonMatcher }));
}

describe("CompanyDonationSection", () => {
  it("envia o valor customizado atualizado no checkout empresarial", async () => {
    const authFetch = buildCompanyAuthFetch();
    renderWithAuth(authFetch);
    await submitCheckout("500,00");

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        checkoutPath,
        expect.objectContaining({ method: "POST" }),
      );
    });

    const checkoutCall = authFetch.mock.calls.find(
      ([url]) => url === checkoutPath,
    );
    const body = JSON.parse((checkoutCall?.[1] as RequestInit).body as string) as {
      companyId: string;
      subscriptionAmountCents: number;
    };
    expect(body.companyId).toBe("company-1");
    expect(body.subscriptionAmountCents).toBe(50_000);
  });

  it("bloqueia custom abaixo de R$ 200 com mensagem de validação", async () => {
    const authFetch = buildCompanyAuthFetch({ allowCheckout: false });
    renderWithAuth(authFetch);
    await submitCheckout("100,00");

    expect(await screen.findByText(/valor mínimo é R\$ 200,00\/mês/i)).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalledWith(
      checkoutPath,
      expect.anything(),
    );
  });

  it("usa o plano padrão de R$ 200 quando não há customização", async () => {
    const authFetch = buildCompanyAuthFetch();
    renderWithAuth(authFetch);
    await submitCheckout();

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        checkoutPath,
        expect.objectContaining({ method: "POST" }),
      );
    });
    const checkoutCall = authFetch.mock.calls.find(
      ([url]) => url === checkoutPath,
    );
    const body = JSON.parse((checkoutCall?.[1] as RequestInit).body as string) as {
      subscriptionAmountCents: number;
    };
    expect(body.subscriptionAmountCents).toBe(20_000);
  });

  it("exibe aviso de login e inicia o fluxo OAuth quando não autenticado", () => {
    const login = jest.fn();
    mockUseAuth.mockReturnValue(
      buildAuthState({ isLoggedIn: false, user: null, login }),
    );

    render(<CompanyDonationSection onBack={jest.fn()} />);

    expect(
      screen.getByText(/Você precisa estar logado para cadastrar sua empresa/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Entrar com GitHub/i }));
    expect(login).toHaveBeenCalledWith({ returnTo: "/participe/apoiar" });
  });

  it("expande e recolhe o cartão quando não há onBack", async () => {
    const authFetch = buildCompanyAuthFetch();
    mockUseAuth.mockReturnValue(
      buildAuthState({ user: companyUser as any, authFetch: authFetch as any }),
    );

    render(<CompanyDonationSection />);

    expect(screen.getByText(/A partir de R\$/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fechar/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Apoiar como Empresa (CLUB Business)"));

    const closeButton = await screen.findByRole("button", { name: /Fechar/i });
    await screen.findByRole("button", { name: /Apoiar com/i });

    fireEvent.click(closeButton);

    expect(screen.queryByRole("button", { name: /Fechar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/A partir de R\$/)).toBeInTheDocument();
  });

  it("chama onBack ao clicar em Voltar", async () => {
    const onBack = jest.fn();
    const authFetch = buildCompanyAuthFetch();
    mockUseAuth.mockReturnValue(
      buildAuthState({ user: companyUser as any, authFetch: authFetch as any }),
    );

    render(<CompanyDonationSection onBack={onBack} />);

    fireEvent.click(await screen.findByRole("button", { name: /Voltar/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("marca sucesso quando o checkout embedded é concluído", async () => {
    const authFetch = buildCompanyAuthFetch();
    renderWithAuth(authFetch);
    await submitCheckout();

    await screen.findByTestId("embedded-provider");
    expect(mockEmbeddedCheckoutOptions?.onComplete).toBeDefined();

    act(() => {
      mockEmbeddedCheckoutOptions?.onComplete?.();
    });

    expect(
      await screen.findByText(/Pagamento confirmado com sucesso/i),
    ).toBeInTheDocument();
  });
});

const newCompany = {
  id: "company-new",
  name: "Kodak LTDA",
  cnpj: "44593429000105",
  status: "pending",
};

function buildNewCompanyAuthFetch({
  onRegister,
  onCheckout,
}: {
  onRegister?: ReturnType<typeof jsonResponse>;
  onCheckout?: ReturnType<typeof jsonResponse>;
} = {}) {
  return jest.fn(async (url: string, options?: RequestInit) => {
    if (url === "/companies/me") return jsonResponse(null, { ok: false, status: 404 });
    if (url === "/companies" && options?.method === "POST") {
      return onRegister ?? jsonResponse(newCompany);
    }
    if (url === checkoutPath && options?.method === "POST") {
      return onCheckout ?? jsonResponse({ clientSecret: "cs_test_new" });
    }
    return jsonResponse(null, { ok: false, status: 404 });
  });
}

function renderNewCompanyFlow(authFetch: jest.Mock): void {
  mockUseAuth.mockReturnValue(
    buildAuthState({ user: companyUser as any, authFetch: authFetch as any }),
  );
  render(<CompanyDonationSection onBack={jest.fn()} />);
}

async function fillCompanyForm({ cnpj = "44593429000105", name = "Kodak LTDA" } = {}) {
  const cnpjField = await screen.findByLabelText(/CNPJ/i);
  fireEvent.change(cnpjField, { target: { value: cnpj } });
  fireEvent.change(screen.getByLabelText(/Razão social/i), { target: { value: name } });
  return cnpjField;
}

describe("CompanyDonationSection — cadastro de nova empresa", () => {
  it("cadastra a empresa com CNPJ formatado e cria a sessão de checkout", async () => {
    const authFetch = buildNewCompanyAuthFetch();
    renderNewCompanyFlow(authFetch);

    const cnpjField = await fillCompanyForm();
    expect(cnpjField).toHaveValue("44.593.429/0001-05");
    fireEvent.change(screen.getByLabelText(/URL do logotipo/i), {
      target: { value: "https://kodak.com/logo.png" },
    });
    fireEvent.change(screen.getByLabelText(/Site da empresa/i), {
      target: { value: "https://kodak.com" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Cadastrar empresa e apoiar com/i }),
    );

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        "/companies",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const registerCall = authFetch.mock.calls.find(([url]) => url === "/companies");
    expect(JSON.parse((registerCall?.[1] as RequestInit).body as string)).toEqual({
      cnpj: "44593429000105",
      name: "Kodak LTDA",
      logoUrl: "https://kodak.com/logo.png",
      websiteUrl: "https://kodak.com",
    });

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        checkoutPath,
        expect.objectContaining({ method: "POST" }),
      );
    });
    const checkoutCall = authFetch.mock.calls.find(([url]) => url === checkoutPath);
    expect(
      JSON.parse((checkoutCall?.[1] as RequestInit).body as string),
    ).toMatchObject({ companyId: "company-new", subscriptionAmountCents: 20_000 });
  });

  it("rejeita CNPJ com menos de 14 dígitos", async () => {
    const authFetch = buildNewCompanyAuthFetch();
    renderNewCompanyFlow(authFetch);

    await fillCompanyForm({ cnpj: "123" });
    fireEvent.click(
      screen.getByRole("button", { name: /Cadastrar empresa e apoiar com/i }),
    );

    expect(await screen.findByText("CNPJ deve ter 14 dígitos.")).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalledWith("/companies", expect.anything());
  });

  it("exige razão social", async () => {
    const authFetch = buildNewCompanyAuthFetch();
    renderNewCompanyFlow(authFetch);

    await fillCompanyForm({ name: "" });
    fireEvent.click(
      screen.getByRole("button", { name: /Cadastrar empresa e apoiar com/i }),
    );

    expect(await screen.findByText("Razão social é obrigatória.")).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalledWith("/companies", expect.anything());
  });

  it("exibe a mensagem de erro do cadastro", async () => {
    const authFetch = buildNewCompanyAuthFetch({
      onRegister: jsonResponse({ message: "CNPJ já cadastrado" }, { ok: false, status: 409 }),
    });
    renderNewCompanyFlow(authFetch);

    await fillCompanyForm();
    fireEvent.click(
      screen.getByRole("button", { name: /Cadastrar empresa e apoiar com/i }),
    );

    expect(await screen.findByText("CNPJ já cadastrado")).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalledWith(checkoutPath, expect.anything());
  });

  it("exibe erro ao criar a sessão de pagamento", async () => {
    const authFetch = buildNewCompanyAuthFetch({
      onCheckout: jsonResponse({ message: "Stripe indisponível" }, { ok: false, status: 500 }),
    });
    renderNewCompanyFlow(authFetch);

    await fillCompanyForm();
    fireEvent.click(
      screen.getByRole("button", { name: /Cadastrar empresa e apoiar com/i }),
    );

    expect(await screen.findByText("Stripe indisponível")).toBeInTheDocument();
  });

  it("exibe erro de conexão quando a requisição falha", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url === "/companies/me") return jsonResponse(companyProfile);
      throw new Error("network down");
    });
    renderNewCompanyFlow(authFetch);

    await screen.findByRole("button", { name: /Apoiar com/i });
    fireEvent.click(screen.getByRole("button", { name: /Apoiar com/i }));

    expect(
      await screen.findByText("Erro de conexão. Tente novamente."),
    ).toBeInTheDocument();
  });

  it("tolera falha ao buscar empresa existente e renderiza o formulário", async () => {
    const authFetch = jest.fn(async (url: string) => {
      if (url === "/companies/me") throw new Error("network down");
      return jsonResponse(null, { ok: false, status: 404 });
    });
    renderNewCompanyFlow(authFetch);

    expect(await screen.findByLabelText(/Razão social/i)).toBeEnabled();
    expect(screen.getByLabelText(/URL do logotipo/i)).toBeInTheDocument();
  });
});
