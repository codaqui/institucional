import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";
import SubscriptionConversionPanel from "./SubscriptionConversionPanel";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));
vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({ authFetch: mocks.authFetch }),
}));

const member = {
  id: "member-1",
  name: "Ana",
  githubHandle: "ana",
  avatarUrl: "avatar",
};
const subscription = {
  id: "sub-1",
  amountCents: 20000,
  interval: "month",
  currentPeriodEnd: "2026-12-17T12:00:00.000Z",
};
const company = {
  id: "company-1",
  responsibleMemberId: member.id,
  cnpj: "11222333000181",
  name: "Empresa Existente",
  tradeName: "Existente",
  logoUrl: "https://cdn.example.test/old.png",
  websiteUrl: "https://example.test",
  status: "pending",
};

describe("SubscriptionConversionPanel", () => {
  beforeEach(() => {
    mocks.authFetch
      .mockReset()
      .mockImplementation(async (path: string, init?: RequestInit) => {
        if (path.startsWith("/mentorship/member-options"))
          return jsonResponse([member]);
        if (
          path === "/companies/admin/personal-subscriptions?memberId=member-1"
        )
          return jsonResponse([subscription]);
        if (path === "/companies/admin/list?page=1&limit=100")
          return jsonResponse({ items: [], total: 0 });
        if (
          path === "/companies/admin/subscription-conversions" &&
          init?.method === "POST"
        ) {
          return jsonResponse(
            {
              conversionId: "conversion-1",
              companyId: "company-1",
              subscriptionId: "sub-1",
              status: "converted",
            },
            { status: 201 },
          );
        }
        return jsonResponse({ message: "not found" }, { status: 404 });
      });
  });

  it("creates a pending company and converts the same monthly subscription", async () => {
    const user = userEvent.setup();
    renderWithMui(<SubscriptionConversionPanel />);

    await user.type(screen.getByLabelText("Membro"), "Ana");
    await user.click(await screen.findByRole("option", { name: "Ana (@ana)" }));
    await user.click(
      await screen.findByRole("button", { name: "Usar esta assinatura" }),
    );
    expect(
      await screen.findByText(/Assinatura sub-1 selecionada/),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Nome legal/), "Empresa Sintética");
    await user.type(screen.getByLabelText(/^CNPJ/), "11222333000181");
    await user.type(screen.getByLabelText("Nome fantasia"), "Sintética");
    await user.type(
      screen.getByLabelText("URL do logo"),
      "https://cdn.example.test/logo.png",
    );
    await user.type(screen.getByLabelText("Website"), "https://example.test");
    await user.click(
      screen.getByRole("checkbox", { name: /mesma assinatura/i }),
    );
    await user.click(
      screen.getByRole("button", { name: "Converter assinatura" }),
    );

    await waitFor(() => {
      const call = mocks.authFetch.mock.calls.find(
        ([path]) => path === "/companies/admin/subscription-conversions",
      );
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        memberId: "member-1",
        subscriptionId: "sub-1",
        name: "Empresa Sintética",
        cnpj: "11222333000181",
        tradeName: "Sintética",
        logoUrl: "https://cdn.example.test/logo.png",
        websiteUrl: "https://example.test",
      });
    });
    expect(
      await screen.findByText(/^Assinatura convertida sem nova cobrança/),
    ).toBeInTheDocument();
    expect(
      mocks.authFetch.mock.calls.filter(
        ([path]) => path === "/companies/admin/subscription-conversions",
      ),
    ).toHaveLength(1);
  });

  it("omits empty optional fields when saving the company profile", async () => {
    const minimalCompany = {
      ...company,
      tradeName: "",
      logoUrl: "",
      websiteUrl: "",
    };
    mocks.authFetch.mockImplementation(
      async (path: string, init?: RequestInit) => {
        if (path.startsWith("/mentorship/member-options"))
          return jsonResponse([member]);
        if (
          path === "/companies/admin/personal-subscriptions?memberId=member-1"
        )
          return jsonResponse([subscription]);
        if (path === "/companies/admin/list?page=1&limit=100")
          return jsonResponse({ items: [minimalCompany], total: 1 });
        if (path === "/companies/company-1" && init?.method === "PATCH")
          return jsonResponse(minimalCompany);
        return jsonResponse({ message: "not found" }, { status: 404 });
      },
    );
    const user = userEvent.setup();
    renderWithMui(<SubscriptionConversionPanel />);

    await user.type(screen.getByLabelText("Membro"), "Ana");
    await user.click(await screen.findByRole("option", { name: "Ana (@ana)" }));
    await user.click(
      await screen.findByRole("button", { name: "Usar esta assinatura" }),
    );
    await user.clear(await screen.findByLabelText(/^Nome legal/));
    await user.type(screen.getByLabelText(/^Nome legal/), "Nome mínimo");
    await user.click(
      screen.getByRole("button", { name: "Salvar dados da empresa" }),
    );

    await waitFor(() => {
      const call = mocks.authFetch.mock.calls.find(
        ([path, init]) =>
          path === "/companies/company-1" && init?.method === "PATCH",
      );
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        name: "Nome mínimo",
      });
    });
  });

  it("saves an existing company profile separately before conversion", async () => {
    mocks.authFetch.mockImplementation(
      async (path: string, init?: RequestInit) => {
        if (path.startsWith("/mentorship/member-options"))
          return jsonResponse([member]);
        if (
          path === "/companies/admin/personal-subscriptions?memberId=member-1"
        )
          return jsonResponse([subscription]);
        if (path === "/companies/admin/list?page=1&limit=100")
          return jsonResponse({ items: [company], total: 1 });
        if (path === "/companies/company-1" && init?.method === "PATCH")
          return jsonResponse({ ...company, name: "Nome Atualizado" });
        if (
          path === "/companies/admin/subscription-conversions" &&
          init?.method === "POST"
        ) {
          return jsonResponse({
            conversionId: "conversion-1",
            companyId: company.id,
            subscriptionId: "sub-1",
            status: "already_converted",
          });
        }
        return jsonResponse({ message: "not found" }, { status: 404 });
      },
    );
    const user = userEvent.setup();
    renderWithMui(<SubscriptionConversionPanel />);

    await user.type(screen.getByLabelText("Membro"), "Ana");
    await user.click(await screen.findByRole("option", { name: "Ana (@ana)" }));
    await user.click(
      await screen.findByRole("button", { name: "Usar esta assinatura" }),
    );
    expect(
      await screen.findByText(/Assinatura sub-1 selecionada/),
    ).toBeInTheDocument();
    expect(await screen.findByLabelText(/^Nome legal/)).toHaveValue(
      "Empresa Existente",
    );
    await user.clear(screen.getByLabelText(/^Nome legal/));
    await user.type(screen.getByLabelText(/^Nome legal/), "Nome Atualizado");
    await user.click(
      screen.getByRole("button", { name: "Salvar dados da empresa" }),
    );

    await waitFor(() => {
      const call = mocks.authFetch.mock.calls.find(
        ([path, init]) =>
          path === "/companies/company-1" && init?.method === "PATCH",
      );
      expect(call).toBeDefined();
      expect(JSON.parse(String(call?.[1]?.body))).toEqual({
        name: "Nome Atualizado",
        tradeName: company.tradeName,
        logoUrl: company.logoUrl,
        websiteUrl: company.websiteUrl,
      });
    });
    expect(
      mocks.authFetch.mock.calls.some(
        ([path]) => path === "/companies/admin/subscription-conversions",
      ),
    ).toBe(false);

    await user.click(
      screen.getByRole("checkbox", { name: /mesma assinatura/i }),
    );
    await user.click(
      screen.getByRole("button", { name: "Converter assinatura" }),
    );
    expect(
      await screen.findByText(/já estava convertida/i),
    ).toBeInTheDocument();
  });
});
