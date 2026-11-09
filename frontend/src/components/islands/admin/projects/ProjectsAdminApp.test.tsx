import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";
import ProjectsAdminApp from "./ProjectsAdminApp";

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    isAdmin: false,
    user: {
      sub: "director-1", githubId: "gh-1", handle: "director", name: "Diretor",
      avatarUrl: "", roles: ["diretor"],
    },
    authFetch: mocks.authFetch,
  }),
}));

const entity = {
  id: "2a4a38de-eacf-49f1-a67f-a8162ec0f631", slug: "codaqui", name: "Associação Codaqui",
  type: "ong", cnpj: null, website: "https://codaqui.dev", contactEmail: null,
  isActive: true, registeredById: "director-1",
  createdAt: "2026-11-01T12:00:00.000Z", updatedAt: "2026-11-01T12:00:00.000Z",
};

const project = {
  id: "b2d1507b-8b32-4f57-b8d0-fcf8d7a61f80",
  kind: "projeto",
  name: "Projeto sintético",
  normalizedName: "projeto sintetico",
  slug: "projeto-sintetico",
  entityId: entity.id,
  partnershipId: null,
  createdById: "another-director",
  summary: "Resumo completo do projeto",
  isPublic: true,
  status: "proposed",
  startsAt: "2027-03-10",
  endsAt: "2027-04-10",
  registrationStartsAt: "2027-03-01",
  registrationEndsAt: "2027-03-09",
  odsPrimary: 4,
  odsSecondary: [5],
  targetCommunity: "Participantes da comunidade",
  justification: "Justificativa",
  objective: "Objetivo",
  skillsDeveloped: "Colaboração",
  methodology: "PjBL",
  totalHours: 4,
  schedule: [{ numero: 1, descricao: "Encontro inicial", carga: 4 }],
  maxParticipants: 8,
  supportPartners: [],
  budget: null,
  attachments: [],
  internalNotes: null,
  reportDiscussionUrl: null,
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
};

function call(path: string, method = "GET") {
  return mocks.authFetch.mock.calls.findLast(
    ([url, init]) => url === path && (init?.method ?? "GET") === method,
  );
}

describe("ProjectsAdminApp", { timeout: 20_000 }, () => {
  beforeEach(() => {
    mocks.authFetch.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/projects?")) {
        return jsonResponse({ data: [project], total: 1, page: 1, totalPages: 1, limit: 50 });
      }
      if (path.startsWith("/entities?")) {
        return jsonResponse({ data: [entity], total: 1, page: 1, totalPages: 1, limit: 50 });
      }
      return jsonResponse(project, { status: init?.method === "POST" ? 201 : 200 });
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("creates a minimal draft with name and entity", async () => {
    const user = userEvent.setup();
    renderWithMui(<ProjectsAdminApp />);
    await screen.findByText("Projeto sintético");

    await user.click(screen.getByRole("button", { name: "Novo projeto" }));
    await user.type(screen.getByLabelText(/Nome/), "Novo rascunho");
    await user.click(screen.getByRole("combobox", { name: "Entidade" }));
    await user.click(await screen.findByRole("option", { name: entity.name }));
    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));

    await waitFor(() => expect(call("/projects", "POST")).toBeDefined());
    expect(JSON.parse(String(call("/projects", "POST")?.[1]?.body))).toEqual({
      name: "Novo rascunho",
      entityId: entity.id,
      status: "draft",
    });
  });

  it("saves the complete project as proposed with schedule and mentor", async () => {
    const user = userEvent.setup();
    renderWithMui(<ProjectsAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Editar" }));
    expect(screen.getByLabelText("Justificativa")).toHaveValue("Justificativa");
    await user.type(screen.getByLabelText("ID do mentor principal"), "70c0d1d0-8fd6-477d-b59c-eb48f37a1f18");
    await user.click(screen.getByRole("button", { name: "Salvar proposta" }));

    await waitFor(() => expect(call(`/projects/${project.id}`, "PATCH")).toBeDefined());
    expect(JSON.parse(String(call(`/projects/${project.id}`, "PATCH")?.[1]?.body))).toMatchObject({
      status: "proposed",
      name: project.name,
      entityId: entity.id,
      totalHours: 4,
      schedule: [{ numero: 1, descricao: "Encontro inicial", carga: 4 }],
      mentorMemberId: "70c0d1d0-8fd6-477d-b59c-eb48f37a1f18",
    });
  });

  it("shows the owner-transition error returned to a non-owner director", async () => {
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/projects?")) {
        return jsonResponse({ data: [project], total: 1, page: 1, totalPages: 1, limit: 50 });
      }
      if (path.startsWith("/entities?")) {
        return jsonResponse({ data: [entity], total: 1, page: 1, totalPages: 1, limit: 50 });
      }
      return jsonResponse({ message: "A transição exige admin ou o diretor criador do projeto." }, { status: 403 });
    });
    const user = userEvent.setup();
    renderWithMui(<ProjectsAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Ativar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("A transição exige admin ou o diretor criador do projeto.");
    expect(JSON.parse(String(call(`/projects/${project.id}`, "PATCH")?.[1]?.body))).toEqual({ status: "active" });
  });

  it("finalizes an active project with a report instead of offering an invalid edit", async () => {
    mocks.authFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/projects?")) {
        return jsonResponse({ data: [{ ...project, status: "active" }], total: 1, page: 1, totalPages: 1, limit: 50 });
      }
      if (path.startsWith("/entities?")) {
        return jsonResponse({ data: [entity], total: 1, page: 1, totalPages: 1, limit: 50 });
      }
      return jsonResponse({ ...project, status: "finished" });
    });
    const user = userEvent.setup();
    renderWithMui(<ProjectsAdminApp />);

    expect(await screen.findByRole("button", { name: "Finalizar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finalizar" }));
    await user.type(screen.getByLabelText(/URL do relatório/), "https://github.com/codaqui/institucional/discussions/42");
    await user.click(screen.getByRole("button", { name: "Confirmar finalização" }));

    await waitFor(() => expect(call(`/projects/${project.id}`, "PATCH")).toBeDefined());
    expect(JSON.parse(String(call(`/projects/${project.id}`, "PATCH")?.[1]?.body))).toEqual({
      status: "finished",
      reportDiscussionUrl: "https://github.com/codaqui/institucional/discussions/42",
    });
  });
});
