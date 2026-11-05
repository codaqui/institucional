import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";
import AssembliesAdminApp from "./AssembliesAdminApp";

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  roles: ["admin"] as string[],
  ready: true,
  isLoggedIn: true,
}));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: mocks.ready,
    isLoggedIn: mocks.isLoggedIn,
    isAdmin: mocks.roles.includes("admin"),
    user: {
      sub: "member-1",
      githubId: "gh-1",
      handle: "manager",
      name: "Gestão",
      avatarUrl: "",
      roles: mocks.roles,
    },
    authFetch: mocks.authFetch,
  }),
}));

const validDiscussionUrl =
  "https://github.com/codaqui/institucional/discussions/42";

const assembly = {
  id: "a9e2ac1f-0a70-4f1f-a4aa-c9756b2f7901",
  type: "ordinaria",
  number: 7,
  slug: "ordinaria-7",
  title: "Assembleia de planejamento",
  scheduledAt: "2026-11-20T21:30:00.000Z",
  heldAt: null,
  status: "scheduled",
  agendaSummary: "Planejamento dos próximos encontros.",
  discussionUrl: validDiscussionUrl,
  ataPdfUrl: null,
  notaryRegistry: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
};

function manageResponse(overrides: Record<string, unknown> = {}) {
  return jsonResponse({
    data: [assembly],
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

async function fillRequiredCreateFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Título/), "Assembleia ordinária de novembro");
  await user.type(screen.getByLabelText(/Data e hora agendada/), "2026-11-20T18:30");
  await user.type(screen.getByLabelText(/Resumo da pauta/), "Aprovação do planejamento.");
  await user.type(screen.getByLabelText(/URL da Discussion/), validDiscussionUrl);
}

describe("AssembliesAdminApp", () => {
  beforeEach(() => {
    mocks.roles = ["admin"];
    mocks.ready = true;
    mocks.isLoggedIn = true;
    mocks.authFetch.mockReset();
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/assemblies?") && !init?.method) {
        return manageResponse();
      }
      if (path === "/assemblies" && init?.method === "POST") {
        return jsonResponse(assembly, { status: 201 });
      }
      if (path === `/assemblies/${assembly.id}` && init?.method === "PATCH") {
        return jsonResponse(assembly);
      }
      return jsonResponse({ message: `Rota inesperada: ${path}` }, { status: 500 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads the management list with standard pagination and filters", async () => {
    const user = userEvent.setup();
    renderWithMui(<AssembliesAdminApp />);

    expect(await screen.findByText("Assembleia de planejamento")).toBeInTheDocument();
    expect(lastCall("/assemblies?page=1&limit=50")).toBeDefined();
    expect(screen.getByText("Mostrando 1–1 de 1")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Filtrar por status"));
    await user.click(screen.getByRole("option", { name: "Canceladas" }));
    await waitFor(() => {
      expect(lastCall("/assemblies?page=1&limit=50&status=canceled")).toBeDefined();
    });
  });

  it("uses the shared pagination controls", async () => {
    const user = userEvent.setup();
    mocks.authFetch.mockImplementation(async (path: string) => {
      if (path.startsWith("/assemblies?")) {
        return manageResponse({ total: 51, totalPages: 2 });
      }
      return jsonResponse({});
    });
    renderWithMui(<AssembliesAdminApp />);
    await screen.findByText("Assembleia de planejamento");

    await user.click(screen.getByRole("button", { name: "Ir para a página 2 de 2" }));

    await waitFor(() => {
      expect(lastCall("/assemblies?page=2&limit=50")).toBeDefined();
    });
  });

  it("creates an assembly with the exact Discussion URL", async () => {
    const user = userEvent.setup();
    renderWithMui(<AssembliesAdminApp />);
    await user.click(await screen.findByRole("button", { name: /nova assembleia/i }));
    await fillRequiredCreateFields(user);
    await user.click(screen.getByRole("button", { name: /salvar assembleia/i }));

    await waitFor(() => expect(lastCall("/assemblies", "POST")).toBeDefined());
    const postBody = JSON.parse(String(lastCall("/assemblies", "POST")?.[1]?.body));
    expect(postBody.discussionUrl).toBe(validDiscussionUrl);
    expect(postBody).toMatchObject({
      type: "ordinaria",
      title: "Assembleia ordinária de novembro",
      scheduledAt: new Date("2026-11-20T18:30").toISOString(),
      agendaSummary: "Aprovação do planejamento.",
      ataPdfUrl: null,
      notaryRegistry: null,
    });
  });

  it("lets a director manage assemblies without exposing or sending notary data", async () => {
    mocks.roles = ["membro", "diretor"];
    const user = userEvent.setup();
    renderWithMui(<AssembliesAdminApp />);
    await user.click(await screen.findByRole("button", { name: /nova assembleia/i }));

    expect(screen.queryByLabelText(/URL do PDF da ata/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Livro do cartório/)).not.toBeInTheDocument();
    await fillRequiredCreateFields(user);
    await user.click(screen.getByRole("button", { name: /salvar assembleia/i }));

    await waitFor(() => expect(lastCall("/assemblies", "POST")).toBeDefined());
    const payload = JSON.parse(String(lastCall("/assemblies", "POST")?.[1]?.body));
    expect(payload).not.toHaveProperty("ataPdfUrl");
    expect(payload).not.toHaveProperty("notaryRegistry");
  });

  it("lets an admin edit PDF and complete notary registry data", async () => {
    const user = userEvent.setup();
    renderWithMui(<AssembliesAdminApp />);
    await user.click(await screen.findByRole("button", { name: /editar assembleia/i }));

    await user.type(
      screen.getByLabelText(/URL do PDF da ata/),
      "https://drive.google.com/file/d/ata-7/view",
    );
    await user.type(screen.getByLabelText(/Livro do cartório/), "Livro B-12");
    await user.type(screen.getByLabelText(/Página do cartório/), "145");
    await user.type(screen.getByLabelText(/Data de registro/), "2026-11-21");
    await user.click(screen.getByRole("button", { name: /salvar assembleia/i }));

    await waitFor(() =>
      expect(lastCall(`/assemblies/${assembly.id}`, "PATCH")).toBeDefined(),
    );
    const payload = JSON.parse(
      String(lastCall(`/assemblies/${assembly.id}`, "PATCH")?.[1]?.body),
    );
    expect(payload).toMatchObject({
      ataPdfUrl: "https://drive.google.com/file/d/ata-7/view",
      notaryRegistry: {
        book: "Livro B-12",
        page: "145",
        registeredAt: "2026-11-21T00:00:00.000Z",
      },
    });
    expect(payload).not.toHaveProperty("discussionUrl");
    expect(payload).not.toHaveProperty("type");
  });

  it("shows validation only after interaction or submit and rejects another Discussion URL", async () => {
    const user = userEvent.setup();
    renderWithMui(<AssembliesAdminApp />);
    await user.click(await screen.findByRole("button", { name: /nova assembleia/i }));

    expect(screen.queryByText("Informe o título da assembleia.")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/Título/));
    await user.tab();
    expect(screen.getByText("Informe o título da assembleia.")).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Título/), "Assembleia de teste");
    await user.type(screen.getByLabelText(/Data e hora agendada/), "2026-11-20T18:30");
    await user.type(screen.getByLabelText(/Resumo da pauta/), "Pauta de teste.");
    await user.type(
      screen.getByLabelText(/URL da Discussion/),
      "https://github.com/codaqui/outro-repo/discussions/42",
    );
    await user.click(screen.getByRole("button", { name: /salvar assembleia/i }));

    expect(screen.getByText(/use a URL exata de uma Discussion/i)).toBeInTheDocument();
    expect(lastCall("/assemblies", "POST")).toBeUndefined();
  });

  it("marks a scheduled assembly as held with heldAt", async () => {
    const user = userEvent.setup();
    renderWithMui(<AssembliesAdminApp />);
    await user.click(await screen.findByRole("button", { name: /realizar assembleia/i }));

    await user.clear(screen.getByLabelText(/Data e hora da realização/));
    await user.type(screen.getByLabelText(/Data e hora da realização/), "2026-11-20T19:00");
    await user.click(screen.getByRole("button", { name: /confirmar realização/i }));

    await waitFor(() =>
      expect(lastCall(`/assemblies/${assembly.id}`, "PATCH")).toBeDefined(),
    );
    const payload = JSON.parse(
      String(lastCall(`/assemblies/${assembly.id}`, "PATCH")?.[1]?.body),
    );
    expect(payload).toMatchObject({
      status: "held",
      heldAt: new Date("2026-11-20T19:00").toISOString(),
    });
  });

  it("cancels through an accessible MUI confirmation dialog", async () => {
    const user = userEvent.setup();
    renderWithMui(<AssembliesAdminApp />);
    await user.click(await screen.findByRole("button", { name: /cancelar assembleia/i }));

    expect(screen.getByRole("dialog", { name: /cancelar assembleia/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirmar cancelamento/i }));

    await waitFor(() =>
      expect(lastCall(`/assemblies/${assembly.id}`, "PATCH")).toBeDefined(),
    );
    expect(
      JSON.parse(String(lastCall(`/assemblies/${assembly.id}`, "PATCH")?.[1]?.body)),
    ).toEqual({ status: "canceled" });
  });

  it("closes dialogs with Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderWithMui(<AssembliesAdminApp />);
    const trigger = await screen.findByRole("button", { name: /nova assembleia/i });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: /nova assembleia/i })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("announces API errors without closing the form", async () => {
    const user = userEvent.setup();
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/assemblies?") && !init?.method) return manageResponse();
      if (path === "/assemblies" && init?.method === "POST") {
        return jsonResponse({ message: "Discussion já vinculada." }, { status: 400 });
      }
      return jsonResponse({});
    });
    renderWithMui(<AssembliesAdminApp />);
    await user.click(await screen.findByRole("button", { name: /nova assembleia/i }));
    await fillRequiredCreateFields(user);
    await user.click(screen.getByRole("button", { name: /salvar assembleia/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Discussion já vinculada.");
    expect(screen.getByRole("dialog", { name: /nova assembleia/i })).toBeInTheDocument();
  });

  it("redirects incompatible roles without calling the management API", async () => {
    const replace = vi.fn();
    vi.stubGlobal("location", { replace });
    mocks.roles = ["membro"];
    renderWithMui(<AssembliesAdminApp />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(mocks.authFetch).not.toHaveBeenCalled();
  });
});
