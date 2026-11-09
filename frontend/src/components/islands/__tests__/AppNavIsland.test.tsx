import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppNavIsland from "../AppNavIsland";
import { renderWithMui } from "../../../test/render-mui";
import type { AuthUser } from "../../../lib/auth-client";
import type { MyDesignation } from "../../../lib/use-designations";

const designationsState = vi.hoisted(() => ({
  data: [] as MyDesignation[],
}));

vi.mock("../../../lib/use-designations", () => ({
  formatDesignationLabel: (designation: MyDesignation) =>
    `${designation.designation} @ ${designation.targetKey ?? designation.targetId ?? designation.targetType}`,
  useMyDesignations: () => ({
    data: designationsState.data,
    loading: false,
    error: "",
    refresh: vi.fn(),
  }),
}));

// Estado mutável compartilhado com a fábrica do mock — cada teste ajusta
// os campos que precisa no beforeEach/corpo.
const authState = vi.hoisted(() => ({
  user: null as AuthUser | null,
  ready: false,
  isLoggedIn: false,
  isAdmin: false,
  isEventOrganizer: false,
  logout: vi.fn(),
}));

vi.mock("../../../lib/use-auth", () => ({
  useAuth: () => ({
    user: authState.user,
    ready: authState.ready,
    isLoggedIn: authState.isLoggedIn,
    isAdmin: authState.isAdmin,
    isEventOrganizer: authState.isEventOrganizer,
    login: vi.fn(),
    logout: authState.logout,
  }),
}));

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    sub: "sub-1",
    githubId: "github-1",
    handle: "octocat",
    name: "Monalisa Octocat",
    avatarUrl: "https://avatars.githubusercontent.com/octocat",
    roles: ["membro"],
    ...overrides,
  };
}

function mockLoggedIn(user: AuthUser, isAdmin = false) {
  authState.user = user;
  authState.ready = true;
  authState.isLoggedIn = true;
  authState.isAdmin = isAdmin;
  authState.isEventOrganizer = user.roles.includes("event_organizer");
}

function stubLocation() {
  const replace = vi.fn();
  vi.stubGlobal("location", { replace });
  return replace;
}

describe("AppNavIsland", () => {
  beforeEach(() => {
    authState.user = null;
    authState.ready = false;
    authState.isLoggedIn = false;
    authState.isAdmin = false;
    authState.isEventOrganizer = false;
    designationsState.data = [];
    vi.clearAllMocks();
  });

  it("mostra skeleton acessível enquanto auth não está pronto", () => {
    authState.ready = false;
    renderWithMui(<AppNavIsland currentPath="/admin/eventos" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sair/i }),
    ).not.toBeInTheDocument();
  });

  it("redireciona para / quando pronto e deslogado", async () => {
    const replace = stubLocation();
    try {
      authState.ready = true;
      authState.isLoggedIn = false;
      renderWithMui(<AppNavIsland currentPath="/admin/eventos" />);

      await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("não redireciona enquanto auth não está pronto", () => {
    const replace = stubLocation();
    try {
      authState.ready = false;
      authState.isLoggedIn = false;
      renderWithMui(<AppNavIsland currentPath="/admin" />);

      expect(replace).not.toHaveBeenCalled();
      expect(screen.getByRole("status")).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("exibe identidade, chips de papel e item ativo por prefixo de rota", () => {
    mockLoggedIn(
      makeUser({ roles: ["membro", "admin", "event_organizer"] }),
      true,
    );
    designationsState.data = [
      { id: "d1", targetType: "community", targetId: null, targetKey: "devparana", designation: "responsible" },
    ];
    renderWithMui(<AppNavIsland currentPath="/admin/eventos" />);

    expect(screen.getByText("Monalisa Octocat")).toBeInTheDocument();
    expect(screen.getByText("@octocat")).toBeInTheDocument();
    expect(screen.getByAltText("Avatar de Monalisa Octocat")).toHaveAttribute(
      "src",
      "https://avatars.githubusercontent.com/octocat",
    );
    // papéis mapeados viram chips; o papel padrão "membro" não vira chip
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Organizador")).toBeInTheDocument();
    expect(screen.queryByText("Membro")).not.toBeInTheDocument();
    expect(screen.getByText("responsible @ devparana")).toBeInTheDocument();

    const visaoGeral = screen.getByRole("link", { name: /visão geral/i });
    expect(visaoGeral).toHaveAttribute("href", "/admin/eventos");
    expect(visaoGeral).toHaveAttribute("aria-current", "page");
    // o hub /admin NÃO é ativado por prefixo quando um filho está ativo
    expect(
      screen.getByRole("link", { name: /^membros$/i }),
    ).not.toHaveAttribute("aria-current");

    // admin enxerga os itens restritos
    expect(screen.getByRole("link", { name: /e-mails/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /virtualcoins/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Diretorias" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configurações" })).toBeInTheDocument();
  });

  it("ativa item por prefixo de rota (check-in)", () => {
    mockLoggedIn(makeUser({ roles: ["membro", "event_checker"] }));
    renderWithMui(<AppNavIsland currentPath="/admin/eventos-checkin" />);

    expect(
      screen.getByRole("link", { name: /check-in/i }),
    ).toHaveAttribute("aria-current", "page");
    // event_checker não enxerga os demais itens do grupo Eventos
    expect(
      screen.queryByRole("link", { name: /visão geral/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /overrides & externos/i }),
    ).not.toBeInTheDocument();
  });

  it("filtra itens da gestão por papel (finance-analyzer, não admin)", () => {
    mockLoggedIn(makeUser({ roles: ["membro", "finance-analyzer"] }));
    renderWithMui(<AppNavIsland currentPath="/admin/reembolsos" />);

    expect(screen.getByText("Financeiro")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /reembolsos/i }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.queryByRole("link", { name: /^membros$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /e-mails/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Pessoas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Horas" })).toHaveAttribute(
      "href",
      "/admin/horas",
    );
    // sem itens de eventos visíveis, o subgrupo some por completo
    expect(screen.queryByText("Eventos")).not.toBeInTheDocument();
  });

  it("membro sem papéis especiais vê apenas o grupo Conta", () => {
    mockLoggedIn(makeUser({ roles: ["membro"] }));
    renderWithMui(<AppNavIsland currentPath="/membro" />);

    expect(screen.queryByText("Gestão")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Horas" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^início$/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /editar perfil/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Minhas horas" })).toHaveAttribute(
      "href",
      "/membro/horas",
    );
  });

  it("ativa 'Editar perfil' em /membro/editar sem ativar o hub /membro", () => {
    mockLoggedIn(makeUser({ roles: ["membro"] }));
    renderWithMui(<AppNavIsland currentPath="/membro/editar" />);

    expect(
      screen.getByRole("link", { name: /editar perfil/i }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: /^início$/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("shows Minha comunidade only with a responsible designation", async () => {
    designationsState.data = [
      {
        id: "designation-1",
        targetType: "community",
        targetId: "community-1",
        targetKey: null,
        designation: "responsible",
      },
    ];
    mockLoggedIn(makeUser());
    renderWithMui(<AppNavIsland currentPath="/membro" />);

    expect(
      await screen.findByRole("link", { name: "Minha comunidade" }),
    ).toHaveAttribute("href", "/admin/comunidades");
  });

  it("shows Diretorias to a director without exposing community or settings admin actions", () => {
    designationsState.data = [
      {
        id: "designation-1",
        targetType: "directorate",
        targetId: "directorate-1",
        targetKey: null,
        designation: "director",
      },
    ];
    mockLoggedIn(makeUser());
    renderWithMui(<AppNavIsland currentPath="/membro" />);

    expect(screen.getByRole("link", { name: "Diretorias" })).toHaveAttribute(
      "href",
      "/admin/diretorias",
    );
    expect(screen.getByRole("link", { name: "Entidades" })).toHaveAttribute("href", "/admin/entidades");
    expect(screen.getByRole("link", { name: "Projetos de extensão" })).toHaveAttribute("href", "/admin/projetos");
    expect(screen.queryByText("Minha comunidade")).not.toBeInTheDocument();
    expect(screen.queryByText("Configurações")).not.toBeInTheDocument();
  });

  it("shows Assembleias in Governança to directors and admins only", () => {
    mockLoggedIn(makeUser({ roles: ["membro", "diretor"] }));
    const { unmount } = renderWithMui(
      <AppNavIsland currentPath="/admin/assembleias" />,
    );

    expect(screen.getByText("Governança")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Assembleias" })).toHaveAttribute(
      "href",
      "/admin/assembleias",
    );
    expect(screen.getByRole("link", { name: "Assembleias" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("link", { name: "Configurações" })).not.toBeInTheDocument();

    unmount();
    mockLoggedIn(makeUser({ roles: ["membro"] }));
    renderWithMui(<AppNavIsland currentPath="/membro" />);
    expect(screen.queryByRole("link", { name: "Assembleias" })).not.toBeInTheDocument();
  });

  it("agrupa itens por sistema de valor e filtra a navegação por texto", () => {
    mockLoggedIn(makeUser({ roles: ["membro", "admin"] }), true);
    renderWithMui(<AppNavIsland currentPath="/admin" />);

    expect(screen.getByText("Financeiro (R$)")).toBeInTheDocument();
    expect(screen.getByText("Governança")).toBeInTheDocument();
    expect(screen.getByText("Comunicação")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar no painel"), {
      target: { value: "fornec" },
    });

    expect(screen.getByRole("link", { name: "Fornecedores" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Reembolsos" })).not.toBeInTheDocument();
  });

  it("expõe expanded nos submenus e fecha um grupo sem remover os demais", async () => {
    mockLoggedIn(makeUser({ roles: ["membro", "admin"] }), true);
    renderWithMui(<AppNavIsland currentPath="/admin" />);

    const financeiro = screen.getByRole("button", { name: "Financeiro (R$)" });
    expect(financeiro).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(financeiro);

    expect(financeiro).toHaveAttribute("aria-expanded", "false");
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "Fornecedores" })).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Governança")).toBeVisible();
  });

  it("shows Universitário to program managers and IES ambassadors", () => {
    designationsState.data = [
      { id: "manager-1", targetType: "program", targetId: null, targetKey: "universitario", designation: "manager" },
      { id: "ambassador-1", targetType: "ies", targetId: "ies-1", targetKey: null, designation: "ambassador" },
    ];
    mockLoggedIn(makeUser());
    renderWithMui(<AppNavIsland currentPath="/admin/universitario" />);

    expect(screen.getByRole("link", { name: "Universitário" })).toHaveAttribute("href", "/admin/universitario");
    expect(screen.getByRole("link", { name: "Universitário" })).toHaveAttribute("aria-current", "page");
  });

  it("dispara o logout do useAuth ao clicar em Sair (startLogout no fluxo real)", async () => {
    mockLoggedIn(makeUser({ roles: ["membro", "admin"] }), true);
    renderWithMui(<AppNavIsland currentPath="/admin" />);

    await userEvent.click(screen.getByRole("button", { name: /sair/i }));
    expect(authState.logout).toHaveBeenCalledTimes(1);
  });
});
