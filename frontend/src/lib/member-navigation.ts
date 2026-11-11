export type MemberSection = "overview" | "participation" | "finance" | "account";

export interface MemberLocation {
  section: MemberSection;
  tab?: string;
}

const SECTION_TABS: Record<MemberSection, readonly string[]> = {
  overview: [],
  participation: ["future", "history", "projects", "certificates"],
  finance: ["donations", "subscriptions", "wallet"],
  account: ["profile", "privacy"],
};

const LEGACY_TAB_SECTIONS: Record<string, MemberSection> = {
  future: "participation",
  history: "participation",
  projects: "participation",
  certificates: "participation",
  donations: "finance",
  subscriptions: "finance",
  wallet: "finance",
  profile: "account",
  privacy: "account",
};

function isMemberSection(value: string | null): value is MemberSection {
  return value !== null && Object.hasOwn(SECTION_TABS, value);
}

export function memberSectionFromSearchParams(search: string): MemberLocation {
  const params = new URLSearchParams(search);
  if (params.get("purchase") === "success") {
    return { section: "participation", tab: "future" };
  }

  const requestedSection = params.get("section");
  const requestedTab = params.get("tab");
  const section = isMemberSection(requestedSection)
    ? requestedSection
    : requestedSection === null
      ? (LEGACY_TAB_SECTIONS[requestedTab ?? ""] ?? "overview")
      : "overview";
  const tab = requestedTab && SECTION_TABS[section].includes(requestedTab)
    ? requestedTab
    : undefined;

  return tab ? { section, tab } : { section };
}

export function buildMemberHref(section: MemberSection, tab?: string): string {
  const params = new URLSearchParams({ section });
  if (tab && SECTION_TABS[section].includes(tab)) params.set("tab", tab);
  return `?${params.toString()}`;
}
