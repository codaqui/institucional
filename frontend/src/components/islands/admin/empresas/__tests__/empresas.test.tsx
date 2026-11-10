import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import {
  authState,
  jsonResponse,
  mockLoggedIn,
  resetAuthState,
  stubLocation,
} from "../../../../../test/admin-auth-fixtures";
import EmpresasApp from "../EmpresasApp";
import { renderWithMui } from "../../../../../test/render-mui";

const company = {
  id: "c-1",
  name: "Mentoria Codaqui",
  cnpj: "44593429000105",
  logoUrl: null,
  websiteUrl: "https://codaqui.dev",
  status: "active",
  tier: "amiga",
  sealValidUntil: null,
  sealActive: true,
  responsibleMemberId: "owner-1",
  responsibleGithubHandle: "mentoriacodaqui",
  subscriptionAmountCents: 50000,
  sortCoinBalance: 300,
  totalSupportedReais: 1500,
  supportCount: 5,
  monthsSupporting: 4,
  createdAt: "2026-05-18T10:00:00.000Z",
};

describe("/admin/empresas", () => {
  beforeEach(() => {
    resetAuthState();
    authState.authFetch = vi.fn();
    vi.clearAllMocks();
  });

  it("redireciona para home quando não autenticado", async () => {
    const replace = stubLocation();
    try {
      authState.ready = true;
      renderWithMui(<EmpresasApp />);

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith("/");
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("carrega listagem paginada e busca detalhes ao expandir card", async () => {
    authState.authFetch.mockImplementation(async (url: string) => {
      if (url.includes("/companies/admin/list?page=1&limit=10")) {
        return jsonResponse({
          items: [company],
          total: 20,
          page: 1,
          limit: 10,
        });
      }
      if (url.includes(`/companies/${company.id}/members`)) {
        return jsonResponse([{ id: "m-1", memberId: "colab1", addedAt: "2026-05-18T10:00:00.000Z" }]);
      }
      if (url.includes(`/companies/${company.id}/wallet`)) {
        return jsonResponse({ balances: { sort_coin: 300 }, frozenTypes: [] });
      }
      return jsonResponse(null, { status: 404 });
    });
    mockLoggedIn(["admin"]);

    renderWithMui(<EmpresasApp />);

    expect(await screen.findByText("Mentoria Codaqui")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*1\.500 em apoios/i)).toBeInTheDocument();
    expect(screen.getByText(/5 apoios/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ver detalhes/i }));

    expect(await screen.findByText(/Colaboradores \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("@colab1")).toBeInTheDocument();
    expect(screen.getByText("sort_coin")).toBeInTheDocument();
  });

  it("solicita próxima página ao trocar paginação", async () => {
    authState.authFetch.mockImplementation(async (url: string) => {
      if (url.includes("/companies/admin/list?page=1&limit=10")) {
        return jsonResponse({ items: [company], total: 20, page: 1, limit: 10 });
      }
      if (url.includes("/companies/admin/list?page=2&limit=10")) {
        return jsonResponse({ items: [], total: 20, page: 2, limit: 10 });
      }
      return jsonResponse(null, { status: 404 });
    });
    mockLoggedIn(["admin"]);

    renderWithMui(<EmpresasApp />);

    await screen.findByText("Mentoria Codaqui");
    fireEvent.click(screen.getByRole("button", { name: /go to page 2/i }));

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/companies/admin/list?page=2&limit=10"),
      );
    });
  });

  it("atualiza status via PATCH ao trocar o Select", async () => {
    authState.authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/companies/admin/list?page=1&limit=10")) {
        return jsonResponse({ items: [company], total: 1, page: 1, limit: 10 });
      }
      if (url.includes(`/companies/${company.id}/status`) && init?.method === "PATCH") {
        return jsonResponse({ ok: true });
      }
      return jsonResponse(null, { status: 404 });
    });
    mockLoggedIn(["admin"]);

    renderWithMui(<EmpresasApp />);

    await screen.findByText("Mentoria Codaqui");
    fireEvent.mouseDown(screen.getByLabelText("Status de Mentoria Codaqui"));
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(await screen.findByRole("option", { name: /suspensa/i }));

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/companies/${company.id}/status`),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "suspended" }),
        }),
      );
    });
  });

  it("valida Aliada com evidência e permite voltar para Amiga", async () => {
    let currentTier = "amiga";
    authState.authFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/companies/admin/list?page=1&limit=10")) {
        return jsonResponse({ items: [{ ...company, tier: currentTier }], total: 1, page: 1, limit: 10 });
      }
      if (url.includes(`/companies/${company.id}/tier`) && init?.method === "PATCH") {
        currentTier = JSON.parse(String(init.body)).tier;
        return jsonResponse({ ...company, tier: currentTier, sealActive: true });
      }
      return jsonResponse(null, { status: 404 });
    });
    mockLoggedIn(["admin"]);
    renderWithMui(<EmpresasApp />);

    fireEvent.click(await screen.findByRole("button", { name: "Validar como Aliada" }));
    fireEvent.change(screen.getByLabelText(/^Critério/), { target: { value: "workshop" } });
    fireEvent.change(screen.getByLabelText(/^URL da evidência/), { target: { value: "https://drive.google.com/evidence" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar validação" }));

    await waitFor(() => {
      expect(authState.authFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/companies/${company.id}/tier`),
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    const validationCall = authState.authFetch.mock.calls.find(([url]) => url.includes(`/companies/${company.id}/tier`));
    expect(JSON.parse(String(validationCall?.[1]?.body))).toMatchObject({
      tier: "aliada",
      engagementCriterion: "workshop",
      evidenceUrl: "https://drive.google.com/evidence",
    });
    expect(await screen.findByText(/empresa validada como Aliada/i)).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Definir como Amiga" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar mudança" }));
    await waitFor(() => {
      const calls = authState.authFetch.mock.calls.filter(([url]) => url.includes(`/companies/${company.id}/tier`));
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });
    const downgradeCall = authState.authFetch.mock.calls.filter(([url]) => url.includes(`/companies/${company.id}/tier`)).at(-1);
    expect(JSON.parse(String(downgradeCall?.[1]?.body))).toEqual({ tier: "amiga" });
  });
});
