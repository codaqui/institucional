import { describe, expect, it } from "vitest";
import type { Member } from "../data/team";
import type { PublicMemberProfile } from "./member-path";
import {
  enrichTeamMember,
  githubHandleFromUrl,
  publicProfilePathForHandle,
} from "./team";

const local: Member = {
  name: "Enderson local",
  role: "Presidente",
  specialty: "DevOps",
  avatar: "https://example.com/local.png",
  linkedin: "https://www.linkedin.com/in/local/",
  github: "https://github.com/EndersonMenezes",
};

const publicMember: PublicMemberProfile = {
  id: "member-1",
  githubHandle: "endersonmenezes",
  name: "Enderson Menezes",
  avatarUrl: "https://example.com/public.png",
  linkedinUrl: "https://www.linkedin.com/in/public/",
};

describe("githubHandleFromUrl", () => {
  it("extracts a handle from a canonical GitHub profile URL", () => {
    expect(githubHandleFromUrl("https://github.com/EndersonMenezes")).toBe(
      "EndersonMenezes",
    );
    expect(githubHandleFromUrl("https://github.com/endersonmenezes/")).toBe(
      "endersonmenezes",
    );
  });

  it.each([
    "http://github.com/endersonmenezes",
    "https://github.com.evil.example/endersonmenezes",
    "https://user@github.com/endersonmenezes",
    "https://github.com/endersonmenezes?tab=repositories",
    "https://github.com/endersonmenezes/projects",
    "https://github.com/",
    "not a URL",
    undefined,
  ])("rejects an invalid or non-profile URL: %s", (url) => {
    expect(githubHandleFromUrl(url)).toBeUndefined();
  });
});

describe("enrichTeamMember", () => {
  it("enriches public fields by case-insensitive handle and preserves curation", () => {
    expect(enrichTeamMember(local, [publicMember])).toEqual({
      name: "Enderson Menezes",
      role: "Presidente",
      specialty: "DevOps",
      avatar: "https://example.com/public.png",
      linkedin: "https://www.linkedin.com/in/public/",
      github: "https://github.com/endersonmenezes",
      profilePath: "/@endersonmenezes",
    });
  });

  it("keeps local optional links when the public profile does not provide them", () => {
    const enriched = enrichTeamMember(local, [
      { ...publicMember, linkedinUrl: null },
    ]);

    expect(enriched.linkedin).toBe("https://www.linkedin.com/in/local/");
  });

  it("does not associate people by name without a GitHub handle", () => {
    const localWithoutHandle: Member = {
      name: "Enderson Menezes",
      role: "Membro",
      avatar: "https://example.com/local.png",
    };

    expect(enrichTeamMember(localWithoutHandle, [publicMember])).toEqual(
      localWithoutHandle,
    );
  });

  it("keeps the complete local card when the handle has no public match", () => {
    expect(enrichTeamMember(local, [])).toEqual(local);
  });
});

describe("publicProfilePathForHandle", () => {
  it("returns a vanity path only for a public handle", () => {
    expect(
      publicProfilePathForHandle("EndersonMenezes", [publicMember]),
    ).toBe("/@endersonmenezes");
    expect(publicProfilePathForHandle("missing", [publicMember])).toBeUndefined();
  });
});
