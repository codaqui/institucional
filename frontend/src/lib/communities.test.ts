import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  communityLevelLabel,
  communitySealLabel,
  getCommunityPrimaryLink,
  loadCommunitiesIndex,
  type CommunityIndexFile,
} from "./communities";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function snapshotFixture() {
  const directory = mkdtempSync(path.join(tmpdir(), "codaqui-community-loader-"));
  directories.push(directory);
  const snapshotPath = path.join(directory, "index.json");
  const snapshot: CommunityIndexFile = {
    generatedAt: "2026-11-02T12:00:00.000Z",
    communities: [
      {
        id: "devparana",
        slug: "devparana",
        name: "DevParaná",
        description: "Comunidade de pessoas desenvolvedoras.",
        emoji: "👥",
        logo: "/img/devparana.svg",
        location: "Maringá, PR",
        founded: 2015,
        links: [
          { type: "website", label: "Página da comunidade", url: "/comunidades/devparana" },
          { type: "github", label: "GitHub", url: "https://github.com/DeveloperParana" },
        ],
        socialProfiles: [],
        tags: ["developers"],
        level: "integrada",
        status: "active",
        sealStatus: "sealed",
        sealGrantedAt: "2026-11-01T12:00:00.000Z",
        sealGrantedById: "admin-1",
        sealValidUntil: "2027-11-01T12:00:00.000Z",
        sealNotes: "Avaliação concluída.",
        siteEnabled: true,
        siteDomain: "devparana.org",
        responsible: null,
      },
    ],
  };
  writeFileSync(snapshotPath, JSON.stringify(snapshot));
  return { snapshotPath, snapshot };
}

describe("loadCommunitiesIndex", () => {
  it("loads the generatedAt and public communities from the snapshot", () => {
    const { snapshotPath, snapshot } = snapshotFixture();

    expect(loadCommunitiesIndex(snapshotPath)).toEqual(snapshot);
  });
});

describe("public community presentation", () => {
  it("preserves the first configured link as the card destination", () => {
    const { snapshot } = snapshotFixture();

    expect(getCommunityPrimaryLink(snapshot.communities[0])).toEqual(
      snapshot.communities[0].links[0],
    );
  });

  it("returns no destination when links are absent", () => {
    const { snapshot } = snapshotFixture();

    expect(getCommunityPrimaryLink({ ...snapshot.communities[0], links: [] })).toBeNull();
  });

  it("labels levels and seal states in Portuguese", () => {
    expect(communityLevelLabel("integrada")).toBe("Integrada");
    expect(communityLevelLabel("parceira")).toBe("Parceira");
    expect(communitySealLabel("sealed")).toBe("Selo Codaqui");
    expect(communitySealLabel("applied")).toBe("Selo em avaliação");
    expect(communitySealLabel("none")).toBeNull();
  });
});
