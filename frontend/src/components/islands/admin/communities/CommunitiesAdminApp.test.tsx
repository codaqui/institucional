import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";
import CommunitiesAdminApp from "./CommunitiesAdminApp";

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  refreshDesignations: vi.fn(),
  isAdmin: true,
  designations: [] as Array<Record<string, unknown>>,
}));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    isAdmin: mocks.isAdmin,
    user: {
      sub: "admin-1",
      githubId: "gh-1",
      handle: "admin",
      name: "Admin",
      avatarUrl: "",
      roles: ["admin"],
    },
    authFetch: mocks.authFetch,
  }),
}));

vi.mock("../../../../lib/use-designations", () => ({
  useMyDesignations: () => ({
    data: mocks.designations,
    loading: false,
    error: "",
    refresh: mocks.refreshDesignations,
  }),
}));

const community = {
  id: "a9e2ac1f-0a70-4f1f-a4aa-c9756b2f7901",
  slug: "devparana",
  name: "DevParaná",
  description: "Comunidade de pessoas desenvolvedoras.",
  emoji: "👥",
  logoUrl: "/img/devparana.svg",
  location: "Maringá, PR",
  founded: 2015,
  links: [],
  socialProfiles: [],
  tags: [],
  level: "parceira",
  status: "active",
  sealStatus: "none",
  sealGrantedAt: null,
  sealGrantedById: null,
  sealValidUntil: null,
  sealNotes: null,
  siteEnabled: true,
  siteDomain: "devparana.org",
  createdAt: "2026-10-30T12:00:00.000Z",
  updatedAt: "2026-10-30T12:00:00.000Z",
};

function manageResponse(overrides: Record<string, unknown> = {}, communityOverrides: Record<string, unknown> = {}) {
  return jsonResponse({
    data: [{ ...community, ...communityOverrides }],
    total: 1,
    page: 1,
    totalPages: 1,
    limit: 50,
    ...overrides,
  });
}

function lastCall(path: string, method = "GET") {
  return mocks.authFetch.mock.calls.findLast(
    ([url, init]) => url === path && (init?.method ?? "GET") === method,
  );
}

describe("CommunitiesAdminApp", () => {
  beforeEach(() => {
    mocks.isAdmin = true;
    mocks.designations = [];
    mocks.authFetch.mockReset();
    mocks.refreshDesignations.mockReset().mockResolvedValue(undefined);
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/communities/manage") && !init?.method) {
        return manageResponse();
      }
      return jsonResponse(community, { status: init?.method === "POST" ? 201 : 200 });
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the management list with the standard pagination", async () => {
    renderWithMui(<CommunitiesAdminApp />);

    expect(await screen.findByText("DevParaná")).toBeInTheDocument();
    expect(lastCall("/communities/manage?page=1&limit=50")).toBeDefined();
    expect(screen.getByText("Mostrando 1–1 de 1")).toBeInTheDocument();
  });

  it("renders pt-BR chips for community status and seal states", async () => {
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/communities/manage") && !init?.method) {
        return jsonResponse({
          data: [
            { ...community, id: "c1", slug: "alpha", name: "Alpha", status: "proposed", sealStatus: "applied" },
            { ...community, id: "c2", slug: "beta", name: "Beta", status: "active", sealStatus: "sealed", sealValidUntil: "2099-01-01T00:00:00.000Z" },
            { ...community, id: "c3", slug: "gamma", name: "Gamma", status: "suspended", sealStatus: "sealed", sealValidUntil: "2020-01-01T00:00:00.000Z" },
            { ...community, id: "c4", slug: "delta", name: "Delta", status: "exited", sealStatus: "none" },
          ],
          total: 4,
          page: 1,
          totalPages: 1,
          limit: 50,
        });
      }
      return jsonResponse(community);
    });
    renderWithMui(<CommunitiesAdminApp />);

    expect(await screen.findByText("Proposta")).toBeInTheDocument();
    expect(screen.getByText("Ativa")).toBeInTheDocument();
    expect(screen.getByText("Suspensa")).toBeInTheDocument();
    expect(screen.getByText("Saída")).toBeInTheDocument();

    expect(screen.getByText("Selo solicitado")).toBeInTheDocument();
    expect(screen.getAllByText("Selo vigente").length).toBeGreaterThan(0);
    expect(screen.getByText("Selo vencido")).toBeInTheDocument();

    expect(screen.queryByText("proposed")).not.toBeInTheDocument();
    expect(screen.queryByText("suspended")).not.toBeInTheDocument();
    expect(screen.queryByText("applied")).not.toBeInTheDocument();
    expect(screen.queryByText("sealed")).not.toBeInTheDocument();
    expect(screen.queryByText("none")).not.toBeInTheDocument();
  });

  it("groups admin-only row actions under a Mais ações menu", async () => {
    const user = userEvent.setup();
    renderWithMui(<CommunitiesAdminApp />);

    expect(await screen.findByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Solicitar selo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conceder selo" })).toBeInTheDocument();

    expect(screen.queryByRole("menuitem", { name: "Tornar integrada" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Atribuir responsável" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Excluir" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mais ações" }));

    expect(await screen.findByRole("menuitem", { name: "Tornar integrada" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Atribuir responsável" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Excluir" })).toBeInTheDocument();
  });

  it("retries the list load with a new request after failure", async () => {
    let manageCalls = 0;
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/communities/manage") && !init?.method) {
        manageCalls += 1;
        if (manageCalls === 1) {
          return jsonResponse({ message: "indisponível" }, { status: 500 });
        }
        return manageResponse();
      }
      return jsonResponse(community);
    });
    const user = userEvent.setup();
    renderWithMui(<CommunitiesAdminApp />);

    const retry = await screen.findByRole("button", { name: "Tentar novamente" });
    expect(screen.getByText(/Erro ao carregar dados/)).toBeInTheDocument();

    await user.click(retry);

    expect(await screen.findByText("DevParaná")).toBeInTheDocument();
    expect(manageCalls).toBe(2);
    expect(lastCall("/communities/manage?page=1&limit=50")).toBeDefined();
  });

  it("lets a responsible edit profile data without exposing admin actions", async () => {
    mocks.isAdmin = false;
    mocks.designations = [{
      id: "designation-1",
      targetType: "community",
      targetId: community.id,
      targetKey: null,
      designation: "responsible",
    }];
    const user = userEvent.setup();
    renderWithMui(<CommunitiesAdminApp />);

    const editButton = await screen.findByRole("button", { name: "Editar" });
    expect(screen.getByRole("button", { name: "Solicitar selo" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mais ações" })).not.toBeInTheDocument();
    await user.click(editButton);
    expect(screen.getByLabelText(/Slug/)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Nova comunidade" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Conceder selo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Atribuir responsável" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Nome da comunidade/));
    await user.type(screen.getByLabelText(/Nome da comunidade/), "DevPR");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(lastCall(`/communities/${community.id}`, "PATCH")).toBeDefined());
    const payload = JSON.parse(String(lastCall(`/communities/${community.id}`, "PATCH")?.[1]?.body));
    expect(payload).toMatchObject({ name: "DevPR" });
    expect(payload).not.toHaveProperty("slug");
    expect(payload).not.toHaveProperty("level");
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("siteEnabled");
    expect(payload).not.toHaveProperty("siteDomain");
  });

  it("redirects a non-admin without a responsible designation", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });
    try {
      mocks.isAdmin = false;
      renderWithMui(<CommunitiesAdminApp />);

      await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
      expect(mocks.authFetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("creates a community with validated required fields", async () => {
    const user = userEvent.setup();
    renderWithMui(<CommunitiesAdminApp />);
    await user.click(await screen.findByRole("button", { name: "Nova comunidade" }));

    await user.click(screen.getByRole("button", { name: "Criar comunidade" }));
    expect(screen.getByText("Informe o nome da comunidade.")).toBeInTheDocument();
    expect(screen.getByText("Informe um slug para a comunidade.")).toBeInTheDocument();
    expect(lastCall("/communities", "POST")).toBeUndefined();

    await user.type(screen.getByLabelText(/Nome da comunidade/), "Comunidade Teste");
    await user.type(screen.getByLabelText(/Slug/), "comunidade-teste");
    await user.type(screen.getByLabelText(/Descrição/), "Descrição da comunidade");
    await user.click(screen.getByRole("button", { name: "Criar comunidade" }));

    await waitFor(() => expect(lastCall("/communities", "POST")).toBeDefined());
    const call = lastCall("/communities", "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      name: "Comunidade Teste",
      slug: "comunidade-teste",
      description: "Descrição da comunidade",
      level: "parceira",
      status: "active",
      siteEnabled: false,
    });
    expect(window.confirm).toHaveBeenCalled();
  });

  it("changes a partner community to integrated through PATCH", async () => {
    const user = userEvent.setup();
    renderWithMui(<CommunitiesAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Mais ações" }));
    await user.click(await screen.findByRole("menuitem", { name: "Tornar integrada" }));

    await waitFor(() =>
      expect(lastCall(`/communities/${community.id}`, "PATCH")).toBeDefined(),
    );
    const call = lastCall(`/communities/${community.id}`, "PATCH");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ level: "integrada" });
    expect(window.confirm).toHaveBeenCalled();
  });

  it("uses logical exit instead of a hard delete", async () => {
    const user = userEvent.setup();
    renderWithMui(<CommunitiesAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Mais ações" }));
    await user.click(await screen.findByRole("menuitem", { name: "Excluir" }));

    const call = lastCall(`/communities/${community.id}`, "PATCH");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ status: "exited" });
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Excluir"));
  });

  it("requests a seal for the community", async () => {
    const user = userEvent.setup();
    renderWithMui(<CommunitiesAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Solicitar selo" }));

    await waitFor(() =>
      expect(lastCall(`/communities/${community.id}/seal/request`, "POST")).toBeDefined(),
    );
    expect(window.confirm).toHaveBeenCalled();
  });

  it("grants a seal with manual review notes and validity", async () => {
    const user = userEvent.setup();
    renderWithMui(<CommunitiesAdminApp />);
    await user.click(await screen.findByRole("button", { name: "Conceder selo" }));

    await user.type(screen.getByLabelText(/Notas da avaliação/), "Governança revisada.");
    await user.type(screen.getByLabelText(/Validade/), "2027-11-02");
    await user.click(screen.getByRole("button", { name: "Confirmar concessão" }));

    await waitFor(() =>
      expect(lastCall(`/communities/${community.id}/seal`, "POST")).toBeDefined(),
    );
    const call = lastCall(`/communities/${community.id}/seal`, "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      notes: "Governança revisada.",
      validUntil: "2027-11-02",
    });
  });

  it("assigns a responsible member through designations", async () => {
    const user = userEvent.setup();
    renderWithMui(<CommunitiesAdminApp />);
    await user.click(await screen.findByRole("button", { name: "Mais ações" }));
    await user.click(await screen.findByRole("menuitem", { name: "Atribuir responsável" }));

    await user.type(
      screen.getByLabelText(/ID do membro/),
      "f5f7a67c-b0b1-487f-b45d-f189e1dc65cf",
    );
    await user.click(screen.getByRole("button", { name: "Confirmar responsável" }));

    await waitFor(() => expect(mocks.refreshDesignations).toHaveBeenCalled());
    const call = lastCall("/designations", "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      memberId: "f5f7a67c-b0b1-487f-b45d-f189e1dc65cf",
      targetType: "community",
      targetId: community.id,
      designation: "responsible",
    });
  });

  it("clears optional fields explicitly with null when editing", async () => {
    const user = userEvent.setup();
    renderWithMui(<CommunitiesAdminApp />);
    await user.click(await screen.findByRole("button", { name: "Editar" }));

    expect(screen.getByLabelText(/Localização/)).toHaveValue("Maringá, PR");
    expect(screen.getByLabelText(/Ano de fundação/)).toHaveValue(2015);
    expect(screen.getByLabelText(/Domínio do site/)).toHaveValue("devparana.org");
    await user.clear(screen.getByLabelText(/Localização/));
    await user.clear(screen.getByLabelText(/Ano de fundação/));
    await user.clear(screen.getByLabelText(/Domínio do site/));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(lastCall(`/communities/${community.id}`, "PATCH")).toBeDefined(),
    );
    const call = lastCall(`/communities/${community.id}`, "PATCH");
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({
      location: null,
      founded: null,
      siteDomain: null,
    });
  });

  it.each([
    { sealStatus: "applied", sealValidUntil: null, label: "Solicitação pendente" },
    { sealStatus: "sealed", sealValidUntil: "2099-01-01T00:00:00.000Z", label: "Selo vigente" },
  ])("disables seal request for $label", async ({ sealStatus, sealValidUntil, label }) => {
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/communities/manage") && !init?.method) {
        return manageResponse({}, { sealStatus, sealValidUntil });
      }
      return jsonResponse(community);
    });
    renderWithMui(<CommunitiesAdminApp />);

    expect(await screen.findByRole("button", { name: label })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Solicitar selo" })).not.toBeInTheDocument();
  });

  it("allows renewing an expired seal", async () => {
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/communities/manage") && !init?.method) {
        return manageResponse({}, { sealStatus: "sealed", sealValidUntil: "2020-01-01T00:00:00.000Z" });
      }
      return jsonResponse(community, { status: init?.method === "POST" ? 201 : 200 });
    });
    const user = userEvent.setup();
    renderWithMui(<CommunitiesAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Solicitar selo" }));

    await waitFor(() => expect(lastCall(`/communities/${community.id}/seal/request`, "POST")).toBeDefined());
  });

  it("surfaces API errors in an accessible alert", async () => {
    const user = userEvent.setup();
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/communities/manage") && !init?.method) {
        return manageResponse();
      }
      return jsonResponse({ message: "Responsável ativo obrigatório." }, { status: 400 });
    });
    renderWithMui(<CommunitiesAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Solicitar selo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Responsável ativo obrigatório.",
    );
  });
});
