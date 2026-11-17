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
      sub: "director-1",
      githubId: "gh-1",
      handle: "director",
      name: "Diretor",
      avatarUrl: "",
      roles: ["diretor"],
    },
    authFetch: mocks.authFetch,
  }),
}));

const entity = {
  id: "2a4a38de-eacf-49f1-a67f-a8162ec0f631",
  slug: "codaqui",
  name: "Associação Codaqui",
  type: "ong",
  cnpj: null,
  website: "https://codaqui.dev",
  contactEmail: null,
  isActive: true,
  registeredById: "director-1",
  createdAt: "2026-11-01T12:00:00.000Z",
  updatedAt: "2026-11-01T12:00:00.000Z",
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
  supportPartners: [{ nome: "Parceiro", cnpj: "12.345.678/0001-90" }],
  budget: {
    itens: [
      {
        descricao: "Material",
        quantidade: 2,
        unidadeMedida: "pacote",
        valorUnitario: 10.5,
        valorTotalItem: 21,
      },
    ],
    totalGeral: 21,
  },
  attachments: ["https://drive.google.com/file/d/abc"],
  mentor: {
    id: "70c0d1d0-8fd6-477d-b59c-eb48f37a1f18",
    name: "Ana",
    githubHandle: "ana",
    avatarUrl: "ana.png",
  },
  coMentors: [
    { id: "co-1", name: "Bruno", githubHandle: "bruno", avatarUrl: null },
  ],
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
    mocks.authFetch
      .mockReset()
      .mockImplementation(async (path: string, init?: RequestInit) => {
        if (path.startsWith("/projects?")) {
          return jsonResponse({
            data: [project],
            total: 1,
            page: 1,
            totalPages: 1,
            limit: 50,
          });
        }
        if (path.startsWith("/entities?")) {
          return jsonResponse({
            data: [entity],
            total: 1,
            page: 1,
            totalPages: 1,
            limit: 50,
          });
        }
        return jsonResponse(project, {
          status: init?.method === "POST" ? 201 : 200,
        });
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

  it("imports a showcase item only after saving a new draft", async () => {
    const user = userEvent.setup();
    renderWithMui(<ProjectsAdminApp />);
    await screen.findByText("Projeto sintético");

    await user.click(screen.getByRole("button", { name: "Importar da vitrine" }));
    await user.click(screen.getByRole("button", { name: "Usar Backstage Lab" }));

    expect(await screen.findByLabelText(/^Nome/)).toHaveValue("Backstage Lab");
    expect(screen.getByLabelText("Resumo")).toHaveValue("Projeto para explorar o Backstage, a plataforma open source de developer portal da Spotify.");
    expect(await screen.findByRole("link", { name: "Origem open source" })).toHaveAttribute("href", "https://github.com/codaqui/backstage");
    expect(call("/projects", "POST")).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    await waitFor(() => expect(call("/projects", "POST")).toBeDefined());
    expect(JSON.parse(String(call("/projects", "POST")?.[1]?.body))).toEqual({
      name: "Backstage Lab",
      entityId: entity.id,
      status: "draft",
    });
  });

  it("keeps proposal validation and clears source state between forms", async () => {
    const user = userEvent.setup();
    renderWithMui(<ProjectsAdminApp />);
    await screen.findByText("Projeto sintético");

    await user.click(screen.getByRole("button", { name: "Importar da vitrine" }));
    await user.click(screen.getByRole("button", { name: "Usar Backstage Lab" }));
    await user.click(screen.getByRole("button", { name: "Salvar proposta" }));
    expect(await screen.findByText(/Informe a carga horária total/)).toBeInTheDocument();
    expect(call("/projects", "POST")).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Fechar" }));
    await user.click(await screen.findByRole("button", { name: "Editar" }));
    expect(screen.queryByRole("link", { name: "Origem open source" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    await user.click(await screen.findByRole("button", { name: "Novo projeto" }));
    expect(screen.queryByRole("link", { name: "Origem open source" })).not.toBeInTheDocument();
  });

  it("preserves mentors and resources when saving an existing project as proposed", async () => {
    const user = userEvent.setup();
    renderWithMui(<ProjectsAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Editar" }));
    expect(screen.getByLabelText("Justificativa")).toHaveValue("Justificativa");
    expect(screen.getByLabelText("Mentor principal")).toHaveValue("Ana (@ana)");
    expect(screen.getByText("Bruno (@bruno)")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do parceiro 1")).toHaveValue("Parceiro");
    expect(
      (
        screen.getByLabelText("Total do item 1") as HTMLInputElement
      ).value.replace(/\s/g, " "),
    ).toBe("R$ 21,00");
    await user.click(screen.getByRole("button", { name: "Salvar proposta" }));

    await waitFor(() =>
      expect(call(`/projects/${project.id}`, "PATCH")).toBeDefined(),
    );
    expect(
      JSON.parse(String(call(`/projects/${project.id}`, "PATCH")?.[1]?.body)),
    ).toMatchObject({
      status: "proposed",
      name: project.name,
      entityId: entity.id,
      totalHours: 4,
      schedule: [{ numero: 1, descricao: "Encontro inicial", carga: 4 }],
      mentorMemberId: "70c0d1d0-8fd6-477d-b59c-eb48f37a1f18",
      coMentors: ["co-1"],
      supportPartners: [{ nome: "Parceiro", cnpj: "12.345.678/0001-90" }],
      budget: {
        itens: [
          {
            descricao: "Material",
            quantidade: 2,
            unidadeMedida: "pacote",
            valorUnitario: 10.5,
            valorTotalItem: 21,
          },
        ],
        totalGeral: 21,
      },
      attachments: ["https://drive.google.com/file/d/abc"],
    });
  });

  it("blocks a non-HTTPS attachment before calling the API", async () => {
    const user = userEvent.setup();
    renderWithMui(<ProjectsAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Editar" }));
    const attachment = screen.getByLabelText("URL do anexo 1");
    await user.clear(attachment);
    await user.type(attachment, "http://drive.google.com/file/d/abc");
    await user.click(screen.getByRole("button", { name: "Salvar proposta" }));

    expect(
      await screen.findByText("Os anexos devem usar URLs HTTPS válidas."),
    ).toBeInTheDocument();
    expect(call(`/projects/${project.id}`, "PATCH")).toBeUndefined();
  });

  it("keeps the dialog open with the storage allowlist error", async () => {
    mocks.authFetch.mockImplementation(
      async (path: string, init?: RequestInit) => {
        if (path.startsWith("/projects?")) {
          return jsonResponse({
            data: [project],
            total: 1,
            page: 1,
            totalPages: 1,
            limit: 50,
          });
        }
        if (path.startsWith("/entities?")) {
          return jsonResponse({
            data: [entity],
            total: 1,
            page: 1,
            totalPages: 1,
            limit: 50,
          });
        }
        if (path === `/projects/${project.id}` && init?.method === "PATCH") {
          return jsonResponse(
            { message: "URL de comprovante fora da allowlist." },
            { status: 400 },
          );
        }
        return jsonResponse(project);
      },
    );
    const user = userEvent.setup();
    renderWithMui(<ProjectsAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Salvar proposta" }));

    expect(
      await screen.findByText("URL de comprovante fora da allowlist."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("URL do anexo 1")).toBeInTheDocument();
  });

  it("shows the owner-transition error returned to a non-owner director", async () => {
    mocks.authFetch.mockImplementation(
      async (path: string, init?: RequestInit) => {
        if (path.startsWith("/projects?")) {
          return jsonResponse({
            data: [project],
            total: 1,
            page: 1,
            totalPages: 1,
            limit: 50,
          });
        }
        if (path.startsWith("/entities?")) {
          return jsonResponse({
            data: [entity],
            total: 1,
            page: 1,
            totalPages: 1,
            limit: 50,
          });
        }
        return jsonResponse(
          {
            message: "A transição exige admin ou o diretor criador do projeto.",
          },
          { status: 403 },
        );
      },
    );
    const user = userEvent.setup();
    renderWithMui(<ProjectsAdminApp />);

    await user.click(await screen.findByRole("button", { name: "Ativar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A transição exige admin ou o diretor criador do projeto.",
    );
    expect(
      JSON.parse(String(call(`/projects/${project.id}`, "PATCH")?.[1]?.body)),
    ).toEqual({ status: "active" });
  });

  it("finalizes an active project with a report instead of offering an invalid edit", async () => {
    mocks.authFetch.mockImplementation(
      async (path: string, init?: RequestInit) => {
        if (path.startsWith("/projects?")) {
          return jsonResponse({
            data: [{ ...project, status: "active" }],
            total: 1,
            page: 1,
            totalPages: 1,
            limit: 50,
          });
        }
        if (path.startsWith("/entities?")) {
          return jsonResponse({
            data: [entity],
            total: 1,
            page: 1,
            totalPages: 1,
            limit: 50,
          });
        }
        return jsonResponse({ ...project, status: "finished" });
      },
    );
    const user = userEvent.setup();
    renderWithMui(<ProjectsAdminApp />);

    expect(
      await screen.findByRole("button", { name: "Finalizar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Editar" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finalizar" }));
    await user.type(
      screen.getByLabelText(/URL do relatório/),
      "https://github.com/codaqui/institucional/discussions/42",
    );
    await user.click(
      screen.getByRole("button", { name: "Confirmar finalização" }),
    );

    await waitFor(() =>
      expect(call(`/projects/${project.id}`, "PATCH")).toBeDefined(),
    );
    expect(
      JSON.parse(String(call(`/projects/${project.id}`, "PATCH")?.[1]?.body)),
    ).toEqual({
      status: "finished",
      reportDiscussionUrl:
        "https://github.com/codaqui/institucional/discussions/42",
    });
  });
});
