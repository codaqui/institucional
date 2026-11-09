import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";
import EntitiesAdminApp from "./EntitiesAdminApp";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn(), isAdmin: true }));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    isAdmin: mocks.isAdmin,
    user: {
      sub: "director-1", githubId: "gh-1", handle: "director", name: "Diretor",
      avatarUrl: "", roles: mocks.isAdmin ? ["admin"] : ["diretor"],
    },
    authFetch: mocks.authFetch,
  }),
}));

const entity = {
  id: "2a4a38de-eacf-49f1-a67f-a8162ec0f631",
  slug: "codaqui",
  name: "Associação Codaqui",
  type: "ong",
  cnpj: "44.593.429/0001-05",
  website: "https://codaqui.dev",
  contactEmail: "contato@codaqui.dev",
  isActive: true,
  registeredById: "director-1",
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
};

const partnership = {
  id: "ba47a4cd-e1c2-45d4-a8af-4f0079c52682",
  entityId: entity.id,
  kind: "termo",
  startedAt: "2026-01-10",
  endsAt: null,
  status: "active",
  notes: "Parceria sintética",
  createdAt: "2026-01-10T12:00:00.000Z",
  updatedAt: "2026-01-10T12:00:00.000Z",
};

function call(path: string, method = "GET") {
  return mocks.authFetch.mock.calls.findLast(
    ([url, init]) => url === path && (init?.method ?? "GET") === method,
  );
}

describe("EntitiesAdminApp", () => {
  beforeEach(() => {
    mocks.isAdmin = true;
    mocks.authFetch.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/entities?")) {
        return jsonResponse({ data: [entity], total: 1, page: 1, totalPages: 1, limit: 50 });
      }
      if (path === `/entities/${entity.id}/partnerships` && !init?.method) {
        return jsonResponse([partnership]);
      }
      return jsonResponse(init?.method === "POST" ? entity : partnership, { status: init?.method === "POST" ? 201 : 200 });
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("creates an entity with its required classification", async () => {
    const user = userEvent.setup();
    renderWithMui(<EntitiesAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Nova entidade" }));
    await user.type(screen.getByLabelText(/Nome/), "Entidade sintética");
    await user.click(screen.getByRole("button", { name: "Salvar entidade" }));

    await waitFor(() => expect(call("/entities", "POST")).toBeDefined());
    expect(JSON.parse(String(call("/entities", "POST")?.[1]?.body))).toMatchObject({
      name: "Entidade sintética",
      type: "ong",
      isActive: true,
    });
  });

  it("creates and ends a partnership through the entity dialog", async () => {
    const user = userEvent.setup();
    renderWithMui(<EntitiesAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Parcerias" }));
    expect(await screen.findByText("Parceria sintética")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Data de início/), "2026-02-01");
    await user.type(screen.getByLabelText("Observações"), "Novo termo sintético");
    await user.click(screen.getByRole("button", { name: "Salvar parceria" }));

    await waitFor(() => expect(call(`/entities/${entity.id}/partnerships`, "POST")).toBeDefined());
    expect(JSON.parse(String(call(`/entities/${entity.id}/partnerships`, "POST")?.[1]?.body))).toMatchObject({
      kind: "termo",
      startedAt: "2026-02-01",
      notes: "Novo termo sintético",
    });

    await user.click(screen.getByRole("button", { name: "Encerrar" }));
    await waitFor(() => expect(call(`/partnerships/${partnership.id}`, "PATCH")).toBeDefined());
    expect(JSON.parse(String(call(`/partnerships/${partnership.id}`, "PATCH")?.[1]?.body))).toEqual({ status: "ended" });
  });

  it("surfaces authorization failures returned by the API", async () => {
    mocks.authFetch.mockResolvedValue(jsonResponse({ message: "Diretor ativo obrigatório." }, { status: 403 }));
    renderWithMui(<EntitiesAdminApp />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Diretor ativo obrigatório.");
  });
});
