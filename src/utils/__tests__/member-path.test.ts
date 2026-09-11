import {
  MEMBER_HANDLE_REGEX,
  buildMemberJsonLd,
  buildMemberPath,
  defaultMemberBioFallback,
  truncateMemberBio,
} from "../member-path";
import type { PublicMemberProfile } from "../member-path";

const baseMember: PublicMemberProfile = {
  id: "uuid-1",
  githubHandle: "endersonmenezes",
  name: "Enderson Menezes",
  avatarUrl: "https://avatars.githubusercontent.com/endersonmenezes?v=4",
  bio: "Fundador da Codaqui.",
  linkedinUrl: "https://www.linkedin.com/in/endersonmenezes/",
  roles: ["admin"],
  joinedAt: "2022-01-01T00:00:00.000Z",
};

describe("MEMBER_HANDLE_REGEX", () => {
  it.each(["endersonmenezes", "user_name", "user-name", "ABC123"])(
    "aceita handle válido %s",
    (handle) => {
      expect(MEMBER_HANDLE_REGEX.test(handle)).toBe(true);
    }
  );

  it.each(["", "user name", "../etc", "user.name", "a/b", "a?b"])(
    "rejeita handle inválido %s",
    (handle) => {
      expect(MEMBER_HANDLE_REGEX.test(handle)).toBe(false);
    }
  );
});

describe("buildMemberPath", () => {
  it("monta a vanity URL do membro", () => {
    expect(buildMemberPath("endersonmenezes")).toBe("/@endersonmenezes");
  });
});

describe("buildMemberJsonLd", () => {
  const url = "https://codaqui.dev/@endersonmenezes";

  it("inclui os campos obrigatórios do schema.org/Person", () => {
    const jsonLd = buildMemberJsonLd(baseMember, url);
    expect(jsonLd["@context"]).toBe("https://schema.org");
    expect(jsonLd["@type"]).toBe("Person");
    expect(jsonLd.name).toBe("Enderson Menezes");
    expect(jsonLd.url).toBe(url);
    expect(jsonLd.image).toBe(baseMember.avatarUrl);
    expect(jsonLd.description).toBe("Fundador da Codaqui.");
    expect(jsonLd.sameAs).toEqual([
      "https://github.com/endersonmenezes",
      "https://www.linkedin.com/in/endersonmenezes/",
    ]);
  });

  it("omite description quando bio é null", () => {
    const jsonLd = buildMemberJsonLd({ ...baseMember, bio: null }, url);
    expect(jsonLd.description).toBeUndefined();
  });

  it("omite o LinkedIn de sameAs quando linkedinUrl é null", () => {
    const jsonLd = buildMemberJsonLd(
      { ...baseMember, linkedinUrl: null },
      url
    );
    expect(jsonLd.sameAs).toEqual(["https://github.com/endersonmenezes"]);
  });
});

describe("truncateMemberBio", () => {
  const fallback = defaultMemberBioFallback("Enderson Menezes");

  it("monta o fallback padrão com o nome", () => {
    expect(fallback).toBe("Perfil de Enderson Menezes na Associação Codaqui.");
  });

  it("mantém bio curta inalterada", () => {
    expect(truncateMemberBio("Bio curta.", fallback)).toBe("Bio curta.");
  });

  it("trunca bio longa em ~160 chars com reticência", () => {
    const result = truncateMemberBio("a".repeat(200), fallback);
    expect(result.length).toBeLessThanOrEqual(160);
    expect(result.endsWith("…")).toBe(true);
  });

  it("normaliza quebras de linha e espaços", () => {
    expect(truncateMemberBio("linha 1\n\n  linha   2", fallback)).toBe(
      "linha 1 linha 2"
    );
  });

  it("usa o fallback quando bio é null", () => {
    expect(truncateMemberBio(null, fallback)).toBe(fallback);
  });

  it("usa o fallback quando bio é undefined ou vazia", () => {
    expect(truncateMemberBio(undefined, fallback)).toBe(fallback);
    expect(truncateMemberBio("   ", fallback)).toBe(fallback);
  });
});
