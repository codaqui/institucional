import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";
import DirectoratesAdminApp from "./DirectoratesAdminApp";

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  refreshDesignations: vi.fn(),
}));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    isAdmin: true,
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
    data: [],
    loading: false,
    error: "",
    refresh: mocks.refreshDesignations,
  }),
}));

const directorate = {
  id: "a9e2ac1f-0a70-4f1f-a4aa-c9756b2f7901",
  slug: "tecnologia",
  name: "Diretoria de Tecnologia",
  description: "Infraestrutura e projetos",
  isActive: true,
  createdAt: "2026-10-30T12:00:00.000Z",
  updatedAt: "2026-10-30T12:00:00.000Z",
};

function manageResponse(overrides: Record<string, unknown> = {}) {
  return jsonResponse({
    data: [directorate],
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

describe("DirectoratesAdminApp", () => {
  beforeEach(() => {
    mocks.authFetch.mockReset();
    mocks.refreshDesignations.mockReset().mockResolvedValue(undefined);
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/directorates/manage") && !init?.method) {
        return manageResponse();
      }
      if (path === "/directorates" && init?.method === "POST") {
        return jsonResponse(directorate, { status: 201 });
      }
      if (path.startsWith("/directorates/") && init?.method === "PATCH") {
        return jsonResponse({ ...directorate, isActive: false });
      }
      if (path === "/designations" && init?.method === "POST") {
        return jsonResponse({ id: "designation-1" }, { status: 201 });
      }
      return jsonResponse({ message: `Rota inesperada: ${path}` }, { status: 500 });
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the management list with the standard page size", async () => {
    renderWithMui(<DirectoratesAdminApp />);

    expect(await screen.findByText("Diretoria de Tecnologia")).toBeInTheDocument();
    expect(lastCall("/directorates/manage?page=1&limit=50")).toBeDefined();
    expect(screen.getByText("Mostrando 1–1 de 1")).toBeInTheDocument();
  });

  it("searches on the server and resets to the first page", async () => {
    const user = userEvent.setup();
    renderWithMui(<DirectoratesAdminApp />);
    await screen.findByText("Diretoria de Tecnologia");

    await user.type(screen.getByLabelText("Buscar diretorias"), "tecnologia");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => {
      expect(
        lastCall("/directorates/manage?page=1&limit=50&search=tecnologia"),
      ).toBeDefined();
    });
  });

  it("uses the shared pagination controls", async () => {
    const user = userEvent.setup();
    mocks.authFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/directorates/manage")) {
        return manageResponse({ total: 51, totalPages: 2 });
      }
      return jsonResponse({});
    });
    renderWithMui(<DirectoratesAdminApp />);
    await screen.findByText("Diretoria de Tecnologia");

    await user.click(screen.getByRole("button", { name: "Ir para a página 2 de 2" }));

    await waitFor(() => {
      expect(lastCall("/directorates/manage?page=2&limit=50")).toBeDefined();
    });
  });

  it("shows accessible validation only after interaction or submit", async () => {
    const user = userEvent.setup();
    renderWithMui(<DirectoratesAdminApp />);
    await user.click(await screen.findByRole("button", { name: "Nova diretoria" }));

    expect(screen.queryByText("Informe o nome da diretoria.")).not.toBeInTheDocument();
    const name = screen.getByLabelText(/Nome da diretoria/);
    await user.click(name);
    await user.tab();
    expect(screen.getByText("Informe o nome da diretoria.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Criar diretoria" }));
    expect(screen.getByText("Informe um slug para a diretoria.")).toBeInTheDocument();
    expect(mocks.authFetch).not.toHaveBeenCalledWith(
      "/directorates",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("confirms creation and refreshes designations", async () => {
    const user = userEvent.setup();
    renderWithMui(<DirectoratesAdminApp />);
    await user.click(await screen.findByRole("button", { name: "Nova diretoria" }));

    await user.type(screen.getByLabelText(/Nome da diretoria/), "Diretoria de Comunicação");
    await user.type(screen.getByLabelText(/Slug/), "comunicacao");
    await user.type(screen.getByLabelText(/Descrição/), "Comunicação da Associação");
    await user.click(screen.getByRole("button", { name: "Criar diretoria" }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(mocks.refreshDesignations).toHaveBeenCalled();
    });
    const call = lastCall("/directorates", "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      name: "Diretoria de Comunicação",
      slug: "comunicacao",
      description: "Comunicação da Associação",
    });
  });

  it("confirms activation changes and surfaces API errors in an Alert", async () => {
    const user = userEvent.setup();
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/directorates/manage") && !init?.method) {
        return manageResponse();
      }
      if (init?.method === "PATCH") {
        return jsonResponse({ message: "Não foi possível desativar." }, { status: 409 });
      }
      return jsonResponse({});
    });
    renderWithMui(<DirectoratesAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Desativar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível desativar.");
    expect(window.confirm).toHaveBeenCalled();
    expect(mocks.refreshDesignations).not.toHaveBeenCalled();
  });

  it("grants a director through /designations and refreshes the hook", async () => {
    const user = userEvent.setup();
    renderWithMui(<DirectoratesAdminApp />);
    await user.click(await screen.findByRole("button", { name: "Conceder diretor" }));

    await user.type(
      screen.getByLabelText(/ID do membro/),
      "f5f7a67c-b0b1-487f-b45d-f189e1dc65cf",
    );
    await user.click(screen.getByRole("button", { name: "Conceder designation" }));

    await waitFor(() => {
      expect(mocks.refreshDesignations).toHaveBeenCalled();
    });
    const call = lastCall("/designations", "POST");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      memberId: "f5f7a67c-b0b1-487f-b45d-f189e1dc65cf",
      targetType: "directorate",
      targetId: directorate.id,
      designation: "director",
    });
    expect(window.confirm).toHaveBeenCalled();
  });
});
