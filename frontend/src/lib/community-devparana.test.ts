import { describe, expect, it } from "vitest";
import type { CommunitySiteConfig } from "../../../comunidades/shared/types";
import type { EventSummary } from "./events";
import type { PublicMemberProfile } from "./member-path";
import {
  ambassadorHandles,
  ambassadorResponsibilities,
  devparanaFeatureCards,
  devparanaRfcList,
  enrichDevparanaTeamMember,
  extractGithubHandle,
  findApiMember,
  findMemberByAmbassador,
  findRfcMember,
  formatFullEventDate,
  normalizeRfcFrontmatter,
  normalizeRfcPersonRef,
  rfcDisplayAvatar,
  rfcDisplayName,
  rfcStatusTone,
  teamHandles,
  upcomingCommunityEvents,
} from "./community-devparana";

const configFixture = (
  features: Partial<CommunitySiteConfig["features"]> = {},
): CommunitySiteConfig => ({
  slug: "devparana",
  name: "DevParaná",
  shortName: "DevParaná",
  tagline: "Comunidade de pessoas desenvolvedoras de software do Paraná.",
  description: "Descrição",
  logoUrl: "https://example.com/logo.png",
  theme: {
    primary: "#1ba250",
    primaryDark: "#147a3b",
    primaryLight: "#2dd47a",
    accent: "#0f8a4a",
    footerBg: "#0A0A0A",
  },
  basePath: "/comunidades/devparana",
  externalLinks: [],
  navMenu: [],
  features: {
    donations: true,
    transparency: true,
    events: false,
    blog: false,
    docs: true,
    ...features,
  },
  hero: {
    title: "DevParaná",
    subtitle: "Sub",
    ctaPrimary: { label: "Apoiar", to: "/comunidades/devparana/apoiar" },
  },
});

const eventFixture = (
  id: string,
  sourceKey: string,
  startAt: string,
  status: EventSummary["status"] = "scheduled",
): EventSummary => ({
  id,
  source: sourceKey.split(":")[0],
  sourceId: sourceKey.split(":")[1] ?? "",
  sourceKey,
  itemPath: `x/${id}.json`,
  title: `Evento ${id}`,
  summary: "",
  startAt,
  timezone: "America/Sao_Paulo",
  platform: "meetup",
  host: "DevParaná",
  location: "Maringá",
  href: "https://www.meetup.com/pt-BR/developerparana/",
  tags: [],
  ctaLabel: "Ver no Meetup",
  status,
});

const memberFixture = (
  githubHandle: string,
  name: string,
): PublicMemberProfile => ({
  id: githubHandle,
  githubHandle,
  name,
  avatarUrl: `https://avatars.example.com/${githubHandle}.png`,
  bio: `Bio de ${name}`,
  linkedinUrl: `https://www.linkedin.com/in/${githubHandle}/`,
  roles: ["membro"],
  joinedAt: "2024-01-01",
});

describe("devparanaFeatureCards", () => {
  it("retorna os 6 cards na ordem do original quando todas as features estão ligadas", () => {
    const cards = devparanaFeatureCards(configFixture());
    expect(cards.map((c) => c.title)).toEqual([
      "Documentação",
      "Equipe",
      "Embaixadores",
      "Eventos",
      "Apoiar",
      "Transparência",
    ]);
    expect(cards.map((c) => c.icon)).toEqual([
      "menu_book",
      "groups",
      "article",
      "calendar_month",
      "volunteer_activism",
      "paid",
    ]);
  });

  it("usa o basePath do config nos links internos e /eventos no card de Eventos", () => {
    const cards = devparanaFeatureCards(configFixture());
    expect(cards.find((c) => c.title === "Documentação")?.to).toBe(
      "/comunidades/devparana/docs",
    );
    expect(cards.find((c) => c.title === "Eventos")?.to).toBe("/eventos");
  });

  it("filtra Documentação/Apoiar/Transparência pelas features, mantendo os required", () => {
    const cards = devparanaFeatureCards(
      configFixture({ docs: false, donations: false, transparency: false }),
    );
    expect(cards.map((c) => c.title)).toEqual([
      "Equipe",
      "Embaixadores",
      "Eventos",
    ]);
  });
});

describe("upcomingCommunityEvents", () => {
  const events: EventSummary[] = [
    eventFixture("a", "meetup:devparana", "2030-01-10T18:00:00Z"),
    eventFixture("b", "meetup:devparana", "2030-01-05T18:00:00Z", "completed"),
    eventFixture("c", "meetup:devparana", "2030-01-02T18:00:00Z"),
    eventFixture("d", "meetup:elasnocodigo", "2030-01-01T18:00:00Z"),
    eventFixture("e", "meetup:devparana", "2030-01-08T18:00:00Z", "active"),
  ];

  it("filtra por sourceKey, exclui completed, ordena ASC e limita", () => {
    const upcoming = upcomingCommunityEvents(events, ["meetup:devparana"]);
    expect(upcoming.map((e) => e.id)).toEqual(["c", "e", "a"]);
  });

  it("respeita o limite customizado", () => {
    const upcoming = upcomingCommunityEvents(events, ["meetup:devparana"], 2);
    expect(upcoming.map((e) => e.id)).toEqual(["c", "e"]);
  });

  it("retorna vazio sem sourceKeys", () => {
    expect(upcomingCommunityEvents(events, [])).toEqual([]);
  });
});

describe("formatFullEventDate", () => {
  it("formata em pt-BR com data completa e hora curta no timezone do evento", () => {
    const formatted = formatFullEventDate(
      "2030-06-15T18:30:00Z",
      "America/Sao_Paulo",
    );
    expect(formatted).toContain("15 de junho de 2030");
    expect(formatted).toMatch(/15:30/);
  });
});

describe("extractGithubHandle", () => {
  it("extrai o handle de uma URL do GitHub", () => {
    expect(extractGithubHandle("https://github.com/ByIvo")).toBe("ByIvo");
    expect(extractGithubHandle("https://github.com/ByIvo/")).toBe("ByIvo");
  });

  it("retorna undefined sem URL ou sem match", () => {
    expect(extractGithubHandle(undefined)).toBeUndefined();
    expect(extractGithubHandle("https://example.com/x")).toBeUndefined();
  });
});

describe("ambassadorHandles / findMemberByAmbassador", () => {
  const regions = [
    {
      id: "norte",
      name: "Norte",
      cities: ["Maringá"],
      ambassador: {
        name: "Ivo Batistela",
        github: "https://github.com/ByIvo",
        githubHandle: "ByIvo",
      },
    },
    {
      id: "oeste",
      name: "Oeste",
      cities: ["Cascavel"],
      ambassador: { name: "Ana Costa", github: "https://github.com/anacosta" },
    },
    { id: "leste", name: "Leste", cities: ["Curitiba"] },
  ];

  it("deriva handles de embaixadores (handle direto ou URL), pulando regiões vazias", () => {
    expect(ambassadorHandles(regions)).toEqual(["ByIvo", "anacosta"]);
  });

  it("encontra membro pelo handle (case-insensitive) antes do nome", () => {
    const members = [memberFixture("byivo", "Ivo B.")];
    const found = findMemberByAmbassador(regions[0].ambassador!, members);
    expect(found?.githubHandle).toBe("byivo");
  });

  it("cai no nome quando não há handle", () => {
    const members = [memberFixture("anacosta", "Ana Costa")];
    const found = findMemberByAmbassador(regions[1].ambassador!, members);
    expect(found?.name).toBe("Ana Costa");
  });

  it("lista de responsabilidades tem os 8 itens do original", () => {
    expect(ambassadorResponsibilities).toHaveLength(8);
  });
});

describe("teamHandles / findApiMember / enrichDevparanaTeamMember", () => {
  const team = [
    {
      name: "Everton Tavares",
      role: "Voluntário",
      avatar: "https://example.com/e.png",
      githubHandle: "evertontavaresdev",
    },
    {
      name: "Luiz Schons",
      role: "Organizador",
      avatar: "https://example.com/l.png",
      githubHandle: "",
    },
    { name: "Você?", role: "Voluntário", avatar: "https://example.com/v.png" },
  ];

  it("deriva handles não-vazios da equipe", () => {
    expect(teamHandles(team)).toEqual(["evertontavaresdev"]);
  });

  it("findApiMember acha por handle e por nome", () => {
    const members = [
      memberFixture("EvertonT", "Everton Tavares"),
      memberFixture("luizschons", "Luiz Schons"),
    ];
    expect(findApiMember(team[0], members)?.githubHandle).toBe("EvertonT");
    expect(
      findApiMember({ ...team[1], githubHandle: undefined }, members)?.name,
    ).toBe("Luiz Schons");
  });

  it("enriquece com dados da API (avatar, bio, linkedin, github)", () => {
    const api = memberFixture("evertontavaresdev", "Everton T.");
    const enriched = enrichDevparanaTeamMember(team[0], [api]);
    expect(enriched.name).toBe("Everton T.");
    expect(enriched.avatar).toBe(api.avatarUrl);
    expect(enriched.bio).toBe("Bio de Everton T.");
    expect(enriched.linkedin).toBe(api.linkedinUrl);
    expect(enriched.github).toBe("https://github.com/evertontavaresdev");
    expect(enriched.isVolunteerCTA).toBe(false);
  });

  it("mantém dados locais sem API e marca o CTA 'Você?'", () => {
    const enriched = enrichDevparanaTeamMember(team[2], []);
    expect(enriched.name).toBe("Você?");
    expect(enriched.isVolunteerCTA).toBe(true);
    expect(enriched.bio).toBeUndefined();
  });
});

describe("RFCs", () => {
  it("normalizeRfcPersonRef aceita string, objeto e lixo", () => {
    expect(normalizeRfcPersonRef("Everton")).toEqual({ name: "Everton" });
    expect(
      normalizeRfcPersonRef({ name: "X", githubHandle: "x", email: "x@y.z" }),
    ).toEqual({ name: "X", githubHandle: "x", email: "x@y.z" });
    expect(normalizeRfcPersonRef(42)).toEqual({});
  });

  it("normalizeRfcFrontmatter normaliza campos e descarta timeline inválida", () => {
    const fm = normalizeRfcFrontmatter({
      rfcId: "001",
      title: "Projeto Embaixadores",
      status: "Ready",
      summary: "Resumo",
      authors: [{ name: "Everton Tavares", email: "ivo@devpr.org" }],
      approvers: [{ email: "fernando@codaqui.dev" }],
      writtenAt: "31 Out 2025",
      publishedAt: "10 Nov 2025",
      timeline: [
        { date: "31 Out 2025", label: "Fim da escrita" },
        { date: "", label: "incompleto" },
      ],
    });
    expect(fm.rfcId).toBe("001");
    expect(fm.status).toBe("Ready");
    expect(fm.authors).toEqual([{ name: "Everton Tavares", email: "ivo@devpr.org" }]);
    expect(fm.approvers).toEqual([{ email: "fernando@codaqui.dev" }]);
    expect(fm.timeline).toEqual([{ date: "31 Out 2025", label: "Fim da escrita" }]);
  });

  it("status padrão é Draft", () => {
    expect(normalizeRfcFrontmatter({}).status).toBe("Draft");
  });

  it("rfcStatusTone: Ready → success, demais → default", () => {
    expect(rfcStatusTone("Ready")).toBe("success");
    expect(rfcStatusTone("Draft")).toBe("default");
    expect(rfcStatusTone("Archived")).toBe("default");
  });

  it("findRfcMember acha por handle e por nome", () => {
    const members = [memberFixture("endersonmenezes", "Enderson Menezes")];
    expect(
      findRfcMember({ githubHandle: "EndersonMenezes" }, members)?.githubHandle,
    ).toBe("endersonmenezes");
    expect(findRfcMember({ name: "Enderson Menezes" }, members)).toBeDefined();
    expect(findRfcMember({ email: "x@y.z" }, members)).toBeUndefined();
  });

  it("rfcDisplayName/rfcDisplayAvatar com fallbacks", () => {
    expect(rfcDisplayName({}, undefined)).toBe("—");
    expect(rfcDisplayName({ email: "a@b.c" }, undefined)).toBe("a@b.c");
    expect(rfcDisplayName({ name: "X" }, memberFixture("x", "Xavier"))).toBe(
      "Xavier",
    );
    expect(rfcDisplayAvatar({ githubHandle: "byivo" }, undefined)).toBe(
      "https://github.com/byivo.png",
    );
    expect(rfcDisplayAvatar({}, undefined)).toBe(
      "https://github.com/ghost.png",
    );
    expect(rfcDisplayAvatar({}, memberFixture("x", "X"))).toBe(
      "https://avatars.example.com/x.png",
    );
  });

  it("devparanaRfcLista lista os dois RFCs com rotas no basePath", () => {
    const list = devparanaRfcList("/comunidades/devparana");
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      id: "001",
      title: "Projeto Embaixadores",
      status: "Ready",
    });
    expect(list[0].to).toBe(
      "/comunidades/devparana/docs/rfcs/projeto-embaixadores",
    );
    expect(list[1].to).toBe(
      "/comunidades/devparana/docs/rfcs/devparana-na-estrada-2026",
    );
  });
});
