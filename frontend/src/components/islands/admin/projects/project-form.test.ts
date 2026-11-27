import { describe, expect, it } from "vitest";
import {
  ODS_OPTIONS,
  buildProjectPayload,
  createEmptyProjectForm,
  createProjectFormFromOpenSource,
  createProjectFormFromProject,
  validateProjectForm,
  type ProjectFormValues,
} from "./project-form";

const mentor = {
  id: "mentor-1",
  name: "Ana",
  githubHandle: "ana",
  avatarUrl: "ana.png",
};
const coMentor = {
  id: "co-1",
  name: "Bruno",
  githubHandle: "bruno",
  avatarUrl: null,
};

function validForm(): ProjectFormValues {
  return {
    ...createEmptyProjectForm(),
    name: "Projeto de extensão",
    entityId: "entity-1",
    summary: "Resumo",
    startsAt: "2027-03-10",
    endsAt: "2027-04-10",
    registrationStartsAt: "2027-03-01",
    registrationEndsAt: "2027-03-09",
    targetCommunity: "Participantes",
    justification: "Justificativa",
    objective: "Objetivo",
    skillsDeveloped: "Colaboração",
    totalHours: "0.30",
    maxParticipants: "8",
    schedule: [
      {
        id: "schedule-1",
        numero: "1",
        descricao: "Primeiro encontro",
        carga: "0.10",
      },
      {
        id: "schedule-2",
        numero: "2",
        descricao: "Segundo encontro",
        carga: "0.20",
      },
    ],
    mentor,
    coMentors: [coMentor],
  };
}

describe("project form defaults and ODS", () => {
  it("starts with ODS 4 and PjBL", () => {
    const form = createEmptyProjectForm();
    expect(form.odsPrimary).toBe(4);
    expect(form.methodology).toBe("PjBL");
  });

  it("creates unique stable IDs for dynamic rows", () => {
    const first = createEmptyProjectForm();
    const second = createEmptyProjectForm();
    expect(first.schedule[0].id).toBeTruthy();
    expect(second.schedule[0].id).toBeTruthy();
    expect(first.schedule[0].id).not.toBe(second.schedule[0].id);
  });

  it("lists all 17 ODS with Portuguese names", () => {
    expect(ODS_OPTIONS).toHaveLength(17);
    expect(ODS_OPTIONS[0]).toEqual({
      value: 1,
      label: "Erradicação da pobreza",
    });
    expect(ODS_OPTIONS[3]).toEqual({
      value: 4,
      label: "Educação de qualidade",
    });
    expect(ODS_OPTIONS[16]).toEqual({
      value: 17,
      label: "Parcerias e meios de implementação",
    });
  });
});

describe("validateProjectForm", () => {
  it("accepts a complete form and decimal hour sums in cents", () => {
    expect(validateProjectForm(validForm())).toEqual([]);
  });

  it("rejects secondary ODS duplicated or equal to the primary", () => {
    const form = { ...validForm(), odsSecondary: [4, 5, 5] };
    expect(validateProjectForm(form)).toContain(
      "As ODS secundárias devem ser únicas e diferentes da principal.",
    );
  });

  it("rejects invalid project and registration dates", () => {
    const form = {
      ...validForm(),
      startsAt: "2027-03-10",
      endsAt: "2027-03-09",
      registrationEndsAt: "2027-03-11",
    };
    expect(validateProjectForm(form)).toEqual(
      expect.arrayContaining([
        "O início do projeto deve ser anterior ao fim.",
        "A janela de inscrição deve terminar antes do início da execução ou no mesmo dia.",
      ]),
    );
  });

  it("rejects a schedule total different from totalHours", () => {
    const form = { ...validForm(), totalHours: "0.31" };
    expect(validateProjectForm(form)).toContain(
      "A soma dos encontros deve ser igual à carga horária total.",
    );
  });

  it("requires a principal mentor only for a proposal", () => {
    const form = { ...validForm(), mentor: null };
    expect(validateProjectForm(form)).toContain(
      "Selecione o mentor principal.",
    );
    const payload = buildProjectPayload(form, "draft");
    expect(payload).toMatchObject({
      name: "Projeto de extensão",
      entityId: "entity-1",
      status: "draft",
      summary: "Resumo",
      startsAt: "2027-03-10",
      endsAt: "2027-04-10",
      registrationStartsAt: "2027-03-01",
      registrationEndsAt: "2027-03-09",
      odsPrimary: 4,
      totalHours: 0.3,
      schedule: [
        { numero: 1, descricao: "Primeiro encontro", carga: 0.1 },
        { numero: 2, descricao: "Segundo encontro", carga: 0.2 },
      ],
      maxParticipants: 8,
      coMentors: ["co-1"],
    });
    expect(payload).not.toHaveProperty("mentorMemberId");
  });

  it("reopens and saves a partial draft without undefined values or errors", () => {
    const form: ProjectFormValues = {
      ...createEmptyProjectForm(),
      name: "Rascunho parcial",
      entityId: "entity-1",
      schedule: [{ id: "schedule-1", numero: "1", descricao: "Encontro", carga: "" }],
      supportPartners: [{ id: "partner-1", nome: "", cnpj: "12.345.678/0001-90" }],
      budgetItems: [{
        id: "budget-1",
        descricao: "Material",
        quantidade: "",
        unidadeMedida: "",
        valorUnitario: "10.50",
      }],
    };
    const persisted = buildProjectPayload(form, "draft");

    const reopened = createProjectFormFromProject(persisted as any);

    expect(reopened.schedule[0]?.carga).toBe("");
    expect(reopened.supportPartners[0]?.nome).toBe("");
    expect(buildProjectPayload(reopened, "draft")).toEqual(persisted);
  });

  it("preserves partial schedule, budget and partner values without empty artifacts", () => {
    const form: ProjectFormValues = {
      ...createEmptyProjectForm(),
      name: "Rascunho parcial",
      entityId: "entity-1",
      summary: "Resumo",
      schedule: [{ id: "schedule-1", numero: "1", descricao: "Encontro", carga: "" }],
      supportPartners: [{ id: "partner-1", nome: "", cnpj: "12.345.678/0001-90" }],
      budgetItems: [{
        id: "budget-1",
        descricao: "Material",
        quantidade: "",
        unidadeMedida: "",
        valorUnitario: "10.50",
      }],
    };

    expect(buildProjectPayload(form, "draft")).toEqual({
      name: "Rascunho parcial",
      entityId: "entity-1",
      status: "draft",
      category: "extension",
      kind: "projeto",
      summary: "Resumo",
      isPublic: true,
      odsPrimary: 4,
      odsSecondary: [],
      targetCommunity: "",
      justification: "",
      objective: "",
      skillsDeveloped: "",
      methodology: "PjBL",
      schedule: [{ numero: 1, descricao: "Encontro" }],
      coMentors: [],
      supportPartners: [{ cnpj: "12.345.678/0001-90" }],
      budget: {
        itens: [{ descricao: "Material", valorUnitario: 10.5 }],
        totalGeral: 0,
      },
      attachments: [],
    });
  });
});

describe("createProjectFormFromOpenSource", () => {
  it("prefills only name and summary without importing the source URL", () => {
    const form = createProjectFormFromOpenSource(
      {
        emoji: "🧪",
        title: "Projeto aberto",
        description: "Resumo da vitrine",
        href: "https://github.com/example/open-source",
      },
      "entity-1",
    );

    expect(form).toMatchObject({
      name: "Projeto aberto",
      summary: "Resumo da vitrine",
      entityId: "entity-1",
      odsPrimary: 4,
      methodology: "PjBL",
      mentor: null,
      coMentors: [],
      supportPartners: [],
      budgetItems: [],
      attachments: [],
    });
    expect(JSON.stringify(buildProjectPayload(form, "draft"))).not.toContain(
      "https://github.com/example/open-source",
    );
  });
});

describe("project categories", () => {
  it("serializes a campaign with canonical URL and no extension fields", () => {
    const form = {
      ...createEmptyProjectForm("campaign"),
      name: "Campanha",
      entityId: "entity-1",
      summary: "Campanha solidária",
      canonicalUrl: "https://tisocial.org.br/blog/campanha",
    };

    expect(buildProjectPayload(form, "draft")).toEqual({
      name: "Campanha",
      entityId: "entity-1",
      status: "draft",
      category: "campaign",
      kind: null,
      summary: "Campanha solidária",
      isPublic: true,
      canonicalUrl: "https://tisocial.org.br/blog/campanha",
    });
  });

  it("preserves open source identity and canonical URL when reopening", () => {
    const form = {
      ...createEmptyProjectForm("open_source"),
      name: "Sorteio App",
      entityId: "entity-1",
      summary: "Aplicação de sorteios",
      canonicalUrl: "https://github.com/DeveloperParana/sorteio-app",
    };
    const persisted = buildProjectPayload(form, "draft");

    const reopened = createProjectFormFromProject(persisted as any);

    expect(reopened.category).toBe("open_source");
    expect(reopened.canonicalUrl).toBe("https://github.com/DeveloperParana/sorteio-app");
    expect(buildProjectPayload(reopened, "draft")).toEqual(persisted);
  });
});

describe("buildProjectPayload", () => {
  it("builds the complete proposal with mentor IDs and computed resources", () => {
    const form: ProjectFormValues = {
      ...validForm(),
      supportPartners: [
        { id: "partner-1", nome: "Parceiro", cnpj: "12.345.678/0001-90" },
        { id: "partner-2", nome: " ", cnpj: "" },
      ],
      budgetItems: [
        {
          id: "budget-1",
          descricao: "Material",
          quantidade: "2",
          unidadeMedida: "pacote",
          valorUnitario: "10.50",
        },
        {
          id: "budget-2",
          descricao: "Transporte",
          quantidade: "1",
          unidadeMedida: "viagem",
          valorUnitario: "4.50",
        },
      ],
      attachments: [
        { id: "attachment-1", url: "https://drive.google.com/file/d/abc" },
        { id: "attachment-2", url: " " },
      ],
      internalNotes: "Nota interna",
    };

    expect(buildProjectPayload(form, "proposed")).toEqual({
      name: "Projeto de extensão",
      entityId: "entity-1",
      status: "proposed",
      category: "extension",
      kind: "projeto",
      summary: "Resumo",
      isPublic: true,
      startsAt: "2027-03-10",
      endsAt: "2027-04-10",
      registrationStartsAt: "2027-03-01",
      registrationEndsAt: "2027-03-09",
      odsPrimary: 4,
      odsSecondary: [],
      targetCommunity: "Participantes",
      justification: "Justificativa",
      objective: "Objetivo",
      skillsDeveloped: "Colaboração",
      methodology: "PjBL",
      totalHours: 0.3,
      schedule: [
        { numero: 1, descricao: "Primeiro encontro", carga: 0.1 },
        { numero: 2, descricao: "Segundo encontro", carga: 0.2 },
      ],
      maxParticipants: 8,
      mentorMemberId: "mentor-1",
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
          {
            descricao: "Transporte",
            quantidade: 1,
            unidadeMedida: "viagem",
            valorUnitario: 4.5,
            valorTotalItem: 4.5,
          },
        ],
        totalGeral: 25.5,
      },
      attachments: ["https://drive.google.com/file/d/abc"],
      internalNotes: "Nota interna",
    });
  });
});
