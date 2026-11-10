import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";
import type { MyDesignation } from "../../../../lib/use-designations";
import UniversitiesAdminApp from "./UniversitiesAdminApp";

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  isAdmin: false,
  designations: [] as MyDesignation[],
}));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    isAdmin: mocks.isAdmin,
    user: { sub: "member-1", roles: ["membro"] },
    authFetch: mocks.authFetch,
  }),
}));

vi.mock("../../../../lib/use-designations", () => ({
  useMyDesignations: () => ({ data: mocks.designations, loading: false, error: "" }),
}));

const city = { id: "city-1", name: "Maringá", uf: "PR", isActive: true };
const institution = {
  id: "ies-1",
  slug: "ies-exemplo",
  name: "IES Exemplo",
  website: null,
  city: { id: city.id, name: city.name, uf: city.uf },
  ambassador: null,
};
const application = {
  id: "pending-1",
  targetId: institution.id,
  status: "pending",
  applicationNotes: "Quero apoiar o programa.",
  member: { id: "member-2", name: "Ana", githubHandle: "ana", avatarUrl: "" },
};
const managePayload = { generatedAt: "2026-11-09T12:00:00.000Z", cities: [city], institutions: [institution], events: [] };

function mockApi(applications = [application]) {
  mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === "/universities/manage") return jsonResponse(managePayload);
    if (path === "/universities/ambassador-applications") return jsonResponse(applications);
    if (path === "/universities/ambassador-applications/my") return jsonResponse([]);
    if (init?.method === "POST" || init?.method === "PATCH") return jsonResponse({}, { status: 200 });
    return jsonResponse({ message: "Rota não encontrada" }, { status: 404 });
  });
}

function asManager(isAdmin = false) {
  mocks.isAdmin = isAdmin;
  mocks.designations = [{ id: "manager-1", targetType: "program", targetId: null, targetKey: "universitario", designation: "manager" }];
}

describe("UniversitiesAdminApp", () => {
  beforeEach(() => {
    mocks.authFetch.mockReset();
    mocks.isAdmin = false;
    mocks.designations = [];
    mockApi();
  });

  it("allows an admin to confirm an application and removes it from the pending queue", async () => {
    asManager(true);
    const user = userEvent.setup();
    renderWithMui(<UniversitiesAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Confirmar posse de Ana" }));

    expect(mocks.authFetch).toHaveBeenCalledWith(
      "/universities/ambassador-applications/pending-1/confirm",
      expect.objectContaining({ method: "POST", body: JSON.stringify({}) }),
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: "Confirmar posse de Ana" })).not.toBeInTheDocument());
  });

  it("lets a manager reject but not confirm an application", async () => {
    asManager();
    renderWithMui(<UniversitiesAdminApp />);

    expect(await screen.findByRole("button", { name: "Rejeitar candidatura de Ana" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar posse de Ana" })).not.toBeInTheDocument();
    expect(screen.getByText("Quero apoiar o programa.")).toBeInTheDocument();
  });

  it("shows only the ambassador shortcut and own applications without calling manager APIs", async () => {
    mocks.designations = [{ id: "ambassador-1", targetType: "ies", targetId: institution.id, targetKey: null, designation: "ambassador" }];
    mocks.authFetch.mockResolvedValue(jsonResponse([{ ...application, id: "active-1", status: "active", applicationNotes: null }]));
    renderWithMui(<UniversitiesAdminApp />);

    expect(await screen.findByRole("link", { name: "Criar evento na minha IES" })).toHaveAttribute("href", "/admin/eventos?institutionId=ies-1");
    expect(mocks.authFetch).toHaveBeenCalledWith("/universities/ambassador-applications/my");
    expect(mocks.authFetch).not.toHaveBeenCalledWith("/universities/manage");
    expect(screen.queryByText("Quero apoiar o programa.")).not.toBeInTheDocument();
  });

  it("shows manager API errors", async () => {
    asManager();
    mocks.authFetch.mockResolvedValue(jsonResponse({ message: "Falha ao carregar programa." }, { status: 500 }));
    renderWithMui(<UniversitiesAdminApp />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Erro ao carregar dados (HTTP 500).");
  });

  it("paginates pending applications with shared controls", async () => {
    asManager();
    const applications = Array.from({ length: 51 }, (_, index) => ({
      ...application,
      id: `pending-${index + 1}`,
      member: { ...application.member, name: `Candidato ${index + 1}` },
    }));
    mockApi(applications);
    const user = userEvent.setup();
    renderWithMui(<UniversitiesAdminApp />);

    expect(await screen.findByText("Candidato 1")).toBeInTheDocument();
    expect(screen.queryByText("Candidato 51")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Próxima página" }));

    expect(await screen.findByText("Candidato 51")).toBeInTheDocument();
    expect(screen.queryByText("Candidato 1")).not.toBeInTheDocument();
  });

  it("creates a city from the manager form", async () => {
    asManager();
    const user = userEvent.setup();
    renderWithMui(<UniversitiesAdminApp />);
    await screen.findByText("IES Exemplo");

    await user.click(screen.getByRole("button", { name: "Nova cidade" }));
    await user.type(screen.getByLabelText("Nome da cidade"), "Curitiba");
    await user.type(screen.getByLabelText("UF"), "pr");
    await user.click(screen.getByRole("button", { name: "Salvar cidade" }));

    await waitFor(() => expect(mocks.authFetch).toHaveBeenCalledWith(
      "/universities/cities",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Curitiba", uf: "PR", isActive: true }) }),
    ));
  });
});
