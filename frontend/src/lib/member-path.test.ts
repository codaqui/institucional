import { describe, it, expect } from "vitest";
import {
  MEMBER_HANDLE_REGEX,
  buildMemberPath,
  buildMemberJsonLd,
  truncateMemberBio,
  defaultMemberBioFallback,
  type PublicMemberProfile,
} from "./member-path";

describe("MEMBER_HANDLE_REGEX", () => {
  it("aceita letras, dígitos, hífen e underscore", () => {
    expect(MEMBER_HANDLE_REGEX.test("endersonmenezes")).toBe(true);
    expect(MEMBER_HANDLE_REGEX.test("ana-dev")).toBe(true);
    expect(MEMBER_HANDLE_REGEX.test("ana_dev2")).toBe(true);
  });
  it("rejeita espaço, ponto e vazio", () => {
    expect(MEMBER_HANDLE_REGEX.test("ana dev")).toBe(false);
    expect(MEMBER_HANDLE_REGEX.test("ana.dev")).toBe(false);
    expect(MEMBER_HANDLE_REGEX.test("")).toBe(false);
  });
});

describe("buildMemberPath", () => {
  it("monta a vanity URL /@<handle>", () => {
    expect(buildMemberPath("endersonmenezes")).toBe("/@endersonmenezes");
  });
});

describe("buildMemberJsonLd", () => {
  const member: PublicMemberProfile = {
    id: "uuid-1",
    githubHandle: "endersonmenezes",
    name: "Enderson Menezes",
    avatarUrl: "https://avatars.githubusercontent.com/u/123?v=4",
    bio: "Fundador da Codaqui",
    linkedinUrl: "https://www.linkedin.com/in/endersonmenezes/",
    roles: ["membro", "admin"],
    joinedAt: "2023-01-01T00:00:00.000Z",
  };

  it("emite schema.org/Person com chaves obrigatórias", () => {
    const ld = buildMemberJsonLd(member, "https://codaqui.dev/@endersonmenezes");
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Person");
    expect(ld.name).toBe("Enderson Menezes");
    expect(ld.url).toBe("https://codaqui.dev/@endersonmenezes");
    expect(ld.image).toBe(member.avatarUrl);
    expect(ld.description).toBe("Fundador da Codaqui");
    expect(ld.sameAs).toEqual([
      "https://github.com/endersonmenezes",
      "https://www.linkedin.com/in/endersonmenezes/",
    ]);
  });

  it("omite description e linkedin quando ausentes", () => {
    const ld = buildMemberJsonLd(
      { ...member, bio: null, linkedinUrl: null },
      "https://codaqui.dev/@endersonmenezes",
    );
    expect(ld.description).toBeUndefined();
    expect(ld.sameAs).toEqual(["https://github.com/endersonmenezes"]);
  });
});

describe("truncateMemberBio", () => {
  it("retorna fallback sem bio", () => {
    expect(truncateMemberBio(null, "fallback")).toBe("fallback");
    expect(truncateMemberBio("   ", "fallback")).toBe("fallback");
  });
  it("normaliza espaços e trunca em ~160 chars com reticência", () => {
    expect(truncateMemberBio("bio\n  curta", "fallback")).toBe("bio curta");
    const long = "a".repeat(200);
    const out = truncateMemberBio(long, "fallback");
    expect(out).toHaveLength(160);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("defaultMemberBioFallback", () => {
  it("monta o fallback com o nome", () => {
    expect(defaultMemberBioFallback("Ana")).toBe(
      "Perfil de Ana na Associação Codaqui.",
    );
  });
});
