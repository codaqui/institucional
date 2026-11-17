export interface ProjectMemberOption {
  id: string;
  name: string;
  githubHandle: string;
  avatarUrl: string | null;
}

export interface ScheduleFormValue {
  id: string;
  numero: string;
  descricao: string;
  carga: string;
}

export interface SupportPartnerFormValue {
  id: string;
  nome: string;
  cnpj: string;
}

export interface BudgetItemFormValue {
  id: string;
  descricao: string;
  quantidade: string;
  unidadeMedida: string;
  valorUnitario: string;
}

export interface AttachmentFormValue {
  id: string;
  url: string;
}

let nextRowId = 0;
export function createFormRowId(): string {
  nextRowId += 1;
  return `row-${nextRowId}`;
}

export interface ProjectFormValues {
  name: string;
  entityId: string;
  kind: "programa" | "projeto" | "oficina" | "evento" | "prestacao_servicos";
  summary: string;
  isPublic: boolean;
  startsAt: string;
  endsAt: string;
  registrationStartsAt: string;
  registrationEndsAt: string;
  odsPrimary: number;
  odsSecondary: number[];
  targetCommunity: string;
  justification: string;
  objective: string;
  skillsDeveloped: string;
  methodology: string;
  totalHours: string;
  maxParticipants: string;
  schedule: ScheduleFormValue[];
  mentor: ProjectMemberOption | null;
  coMentors: ProjectMemberOption[];
  supportPartners: SupportPartnerFormValue[];
  budgetItems: BudgetItemFormValue[];
  attachments: AttachmentFormValue[];
  internalNotes: string;
}

export const ODS_OPTIONS = [
  { value: 1, label: "Erradicação da pobreza" },
  { value: 2, label: "Fome zero e agricultura sustentável" },
  { value: 3, label: "Saúde e bem-estar" },
  { value: 4, label: "Educação de qualidade" },
  { value: 5, label: "Igualdade de gênero" },
  { value: 6, label: "Água potável e saneamento" },
  { value: 7, label: "Energia limpa e acessível" },
  { value: 8, label: "Trabalho decente e crescimento econômico" },
  { value: 9, label: "Indústria, inovação e infraestrutura" },
  { value: 10, label: "Redução das desigualdades" },
  { value: 11, label: "Cidades e comunidades sustentáveis" },
  { value: 12, label: "Consumo e produção responsáveis" },
  { value: 13, label: "Ação contra a mudança global do clima" },
  { value: 14, label: "Vida na água" },
  { value: 15, label: "Vida terrestre" },
  { value: 16, label: "Paz, justiça e instituições eficazes" },
  { value: 17, label: "Parcerias e meios de implementação" },
] as const;

export function createEmptyProjectForm(): ProjectFormValues {
  return {
    name: "",
    entityId: "",
    kind: "projeto",
    summary: "",
    isPublic: true,
    startsAt: "",
    endsAt: "",
    registrationStartsAt: "",
    registrationEndsAt: "",
    odsPrimary: 4,
    odsSecondary: [],
    targetCommunity: "",
    justification: "",
    objective: "",
    skillsDeveloped: "",
    methodology: "PjBL",
    totalHours: "",
    maxParticipants: "",
    schedule: [
      { id: createFormRowId(), numero: "1", descricao: "", carga: "" },
    ],
    mentor: null,
    coMentors: [],
    supportPartners: [],
    budgetItems: [],
    attachments: [],
    internalNotes: "",
  };
}

const cents = (value: number): number => Math.round(value * 100);

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function validateRequiredFields(values: ProjectFormValues): string[] {
  const errors: string[] = [];
  const required: Array<[string, string]> = [
    [values.name, "Informe o nome do projeto."],
    [values.entityId, "Selecione a entidade."],
    [values.summary, "Informe o resumo."],
    [values.targetCommunity, "Informe o público da comunidade."],
    [values.justification, "Informe a justificativa."],
    [values.objective, "Informe o objetivo."],
    [values.skillsDeveloped, "Informe as competências desenvolvidas."],
    [values.methodology, "Informe a metodologia."],
    [values.totalHours, "Informe a carga horária total."],
    [values.maxParticipants, "Informe o número de vagas."],
    [values.startsAt, "Informe o início do projeto."],
    [values.endsAt, "Informe o fim do projeto."],
    [values.registrationStartsAt, "Informe o início das inscrições."],
    [values.registrationEndsAt, "Informe o fim das inscrições."],
  ];
  for (const [value, message] of required) {
    if (!hasText(value)) errors.push(message);
  }
  if (!values.mentor) errors.push("Selecione o mentor principal.");
  return errors;
}

function validateOds(values: ProjectFormValues): string[] {
  const errors: string[] = [];
  if (
    !Number.isInteger(values.odsPrimary) ||
    values.odsPrimary < 1 ||
    values.odsPrimary > 17
  ) {
    errors.push("A ODS principal deve estar entre 1 e 17.");
  }
  if (
    values.odsSecondary.some(
      (value) => !Number.isInteger(value) || value < 1 || value > 17,
    ) ||
    new Set(values.odsSecondary).size !== values.odsSecondary.length ||
    values.odsSecondary.includes(values.odsPrimary)
  ) {
    errors.push(
      "As ODS secundárias devem ser únicas e diferentes da principal.",
    );
  }
  return errors;
}

function validateDates(values: ProjectFormValues): string[] {
  const errors: string[] = [];
  const start = Date.parse(values.startsAt);
  const end = Date.parse(values.endsAt);
  const registrationStart = Date.parse(values.registrationStartsAt);
  const registrationEnd = Date.parse(values.registrationEndsAt);
  if (start >= end)
    errors.push("O início do projeto deve ser anterior ao fim.");
  if (registrationStart >= registrationEnd) {
    errors.push("A janela de inscrição deve ter início anterior ao fim.");
  }
  if (registrationEnd > start) {
    errors.push(
      "A janela de inscrição deve terminar antes do início da execução ou no mesmo dia.",
    );
  }
  return errors;
}

function validateSchedule(values: ProjectFormValues): string[] {
  const errors: string[] = [];
  if (Number(values.totalHours) <= 0) {
    errors.push("A carga horária total deve ser positiva.");
  }
  if (
    !Number.isInteger(Number(values.maxParticipants)) ||
    Number(values.maxParticipants) < 0
  ) {
    errors.push("O número de vagas deve ser um inteiro não negativo.");
  }
  if (values.schedule.length === 0) {
    errors.push("Informe ao menos um encontro com carga horária positiva.");
  }
  for (const item of values.schedule) {
    if (!hasText(item.descricao) || Number(item.carga) <= 0) {
      errors.push("Cada encontro precisa de descrição e carga positiva.");
      break;
    }
  }
  const scheduleTotal = values.schedule.reduce(
    (sum, item) => sum + cents(Number(item.carga) || 0),
    0,
  );
  if (scheduleTotal !== cents(Number(values.totalHours) || 0)) {
    errors.push("A soma dos encontros deve ser igual à carga horária total.");
  }
  return errors;
}

function validateSupportPartners(values: ProjectFormValues): string[] {
  const errors: string[] = [];
  for (const partner of values.supportPartners) {
    if (!hasText(partner.nome) && hasText(partner.cnpj)) {
      errors.push("Informe o nome do parceiro de apoio.");
      break;
    }
  }
  return errors;
}

function validateBudget(values: ProjectFormValues): string[] {
  const errors: string[] = [];
  for (const item of values.budgetItems) {
    if (!hasText(item.descricao)) {
      errors.push("Informe a descrição de cada item do orçamento.");
      break;
    }
    if (
      Number(item.quantidade) <= 0 ||
      !hasText(item.unidadeMedida) ||
      Number(item.valorUnitario) < 0 ||
      !hasText(item.valorUnitario)
    ) {
      errors.push(
        "Cada item do orçamento precisa de quantidade, unidade e valor unitário válidos.",
      );
      break;
    }
  }
  return errors;
}

function validateAttachments(values: ProjectFormValues): string[] {
  const errors: string[] = [];
  for (const attachment of values.attachments) {
    if (!hasText(attachment.url)) continue;
    try {
      if (new URL(attachment.url).protocol !== "https:") {
        errors.push("Os anexos devem usar URLs HTTPS válidas.");
      }
    } catch {
      errors.push("Os anexos devem usar URLs HTTPS válidas.");
      break;
    }
  }
  return errors;
}

function validateResources(values: ProjectFormValues): string[] {
  return [
    ...validateSupportPartners(values),
    ...validateBudget(values),
    ...validateAttachments(values),
  ];
}

export function validateProjectForm(values: ProjectFormValues): string[] {
  return [
    ...validateRequiredFields(values),
    ...validateOds(values),
    ...validateDates(values),
    ...validateSchedule(values),
    ...validateResources(values),
  ];
}

export function buildProjectPayload(
  values: ProjectFormValues,
  status: "draft" | "proposed",
): Record<string, unknown> {
  const base = {
    name: values.name.trim(),
    entityId: values.entityId,
    status,
  };
  if (status === "draft" || !values.mentor) return base;

  const budgetItems = values.budgetItems
    .filter((item) => hasText(item.descricao))
    .map((item) => ({
      descricao: item.descricao.trim(),
      quantidade: Number(item.quantidade),
      unidadeMedida: item.unidadeMedida.trim(),
      valorUnitario: Number(item.valorUnitario),
      valorTotalItem:
        cents(Number(item.quantidade) * Number(item.valorUnitario)) / 100,
    }));
  return {
    ...base,
    kind: values.kind,
    summary: values.summary.trim(),
    isPublic: values.isPublic,
    startsAt: values.startsAt,
    endsAt: values.endsAt,
    registrationStartsAt: values.registrationStartsAt,
    registrationEndsAt: values.registrationEndsAt,
    odsPrimary: values.odsPrimary,
    odsSecondary: values.odsSecondary,
    targetCommunity: values.targetCommunity.trim(),
    justification: values.justification.trim(),
    objective: values.objective.trim(),
    skillsDeveloped: values.skillsDeveloped.trim(),
    methodology: values.methodology.trim(),
    totalHours: Number(values.totalHours),
    schedule: values.schedule.map((item) => ({
      numero: Number(item.numero),
      descricao: item.descricao.trim(),
      carga: Number(item.carga),
    })),
    maxParticipants: Number(values.maxParticipants),
    mentorMemberId: values.mentor.id,
    coMentors: values.coMentors
      .map((member) => member.id)
      .filter((id) => id !== values.mentor?.id),
    supportPartners: values.supportPartners
      .filter((partner) => hasText(partner.nome))
      .map((partner) => ({
        nome: partner.nome.trim(),
        ...(hasText(partner.cnpj) ? { cnpj: partner.cnpj.trim() } : {}),
      })),
    ...(budgetItems.length > 0
      ? {
          budget: {
            itens: budgetItems,
            totalGeral:
              budgetItems.reduce(
                (sum, item) => sum + cents(item.valorTotalItem),
                0,
              ) / 100,
          },
        }
      : {}),
    attachments: values.attachments
      .map((attachment) => attachment.url.trim())
      .filter(Boolean),
    ...(hasText(values.internalNotes)
      ? { internalNotes: values.internalNotes.trim() }
      : {}),
  };
}

export interface ManagedProject {
  id: string;
  kind: ProjectFormValues["kind"] | null;
  name: string;
  entityId: string;
  partnershipId: string | null;
  summary: string | null;
  isPublic: boolean;
  status: "draft" | "proposed" | "active" | "finished" | "canceled";
  startsAt: string | null;
  endsAt: string | null;
  registrationStartsAt: string | null;
  registrationEndsAt: string | null;
  odsPrimary: number | null;
  odsSecondary: number[];
  targetCommunity: string | null;
  justification: string | null;
  objective: string | null;
  skillsDeveloped: string | null;
  methodology: string | null;
  totalHours: number | null;
  schedule: Array<{ numero: number; descricao: string; carga: number }> | null;
  maxParticipants: number | null;
  supportPartners: Array<{ nome: string; cnpj?: string }>;
  budget: {
    itens: Array<{
      descricao: string;
      quantidade: number;
      unidadeMedida: string;
      valorUnitario: number;
      valorTotalItem: number;
    }>;
    totalGeral: number;
  } | null;
  attachments: string[];
  internalNotes: string | null;
  mentor: ProjectMemberOption | null;
  coMentors: ProjectMemberOption[];
}

export function createProjectFormFromProject(
  project: ManagedProject | null,
  defaultEntityId = "",
): ProjectFormValues {
  if (!project) {
    return { ...createEmptyProjectForm(), entityId: defaultEntityId };
  }
  return {
    name: project.name,
    entityId: project.entityId,
    kind: project.kind ?? "projeto",
    summary: project.summary ?? "",
    isPublic: project.isPublic,
    startsAt: project.startsAt ?? "",
    endsAt: project.endsAt ?? "",
    registrationStartsAt: project.registrationStartsAt ?? "",
    registrationEndsAt: project.registrationEndsAt ?? "",
    odsPrimary: project.odsPrimary ?? 4,
    odsSecondary: project.odsSecondary,
    targetCommunity: project.targetCommunity ?? "",
    justification: project.justification ?? "",
    objective: project.objective ?? "",
    skillsDeveloped: project.skillsDeveloped ?? "",
    methodology: project.methodology ?? "PjBL",
    totalHours: project.totalHours?.toString() ?? "",
    maxParticipants: project.maxParticipants?.toString() ?? "",
    schedule: project.schedule?.map((item) => ({
      id: createFormRowId(),
      numero: String(item.numero),
      descricao: item.descricao,
      carga: String(item.carga),
    })) ?? [{ id: createFormRowId(), numero: "1", descricao: "", carga: "" }],
    mentor: project.mentor,
    coMentors: project.coMentors,
    supportPartners: project.supportPartners.map((partner) => ({
      id: createFormRowId(),
      nome: partner.nome,
      cnpj: partner.cnpj ?? "",
    })),
    budgetItems:
      project.budget?.itens.map((item) => ({
        id: createFormRowId(),
        descricao: item.descricao,
        quantidade: String(item.quantidade),
        unidadeMedida: item.unidadeMedida,
        valorUnitario: String(item.valorUnitario),
      })) ?? [],
    attachments: project.attachments.map((url) => ({
      id: createFormRowId(),
      url,
    })),
    internalNotes: project.internalNotes ?? "",
  };
}
