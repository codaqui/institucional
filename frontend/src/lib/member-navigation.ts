export type MemberSection = "overview" | "participation" | "finance" | "account";
export type ParticipationFilter = "all" | "events" | "certificates" | "projects";
export type FinanceFilter = "all" | "donations" | "subscriptions" | "reimbursements";
export type EventFilter = "future" | "purchased" | "history";

export interface MemberLocation {
  section: MemberSection;
  tab?: string;
  event?: EventFilter;
}

const PARTICIPATION_FILTERS = new Set<ParticipationFilter>([
  "all",
  "events",
  "certificates",
  "projects",
]);
const FINANCE_FILTERS = new Set<FinanceFilter>([
  "all",
  "donations",
  "subscriptions",
  "reimbursements",
]);
const EVENT_FILTERS = new Set<EventFilter>(["future", "purchased", "history"]);
const ACCOUNT_TABS = new Set(["profile", "privacy"]);

const LEGACY_TAB_SECTIONS: Record<string, MemberSection> = {
  future: "participation",
  purchased: "participation",
  history: "participation",
  events: "participation",
  all: "participation",
  projects: "participation",
  certificates: "participation",
  donations: "finance",
  subscriptions: "finance",
  reimbursements: "finance",
  wallet: "finance",
  profile: "account",
  privacy: "account",
};

function isMemberSection(value: string | null): value is MemberSection {
  return value === "overview" || value === "participation" || value === "finance" || value === "account";
}

function isEventFilter(value: string | null): value is EventFilter {
  return EVENT_FILTERS.has(value as EventFilter);
}

function participationLocation(tab: string | null, event: string | null): MemberLocation {
  if (isEventFilter(tab)) {
    return { section: "participation", tab: "events", event: tab };
  }
  if (tab === "events") {
    return {
      section: "participation",
      tab,
      event: isEventFilter(event) ? event : "future",
    };
  }
  return {
    section: "participation",
    tab: PARTICIPATION_FILTERS.has(tab as ParticipationFilter) ? tab! : "all",
  };
}

function financeLocation(tab: string | null): MemberLocation {
  const canonical = tab === "wallet" ? "reimbursements" : tab;
  return {
    section: "finance",
    tab: FINANCE_FILTERS.has(canonical as FinanceFilter) ? canonical! : "all",
  };
}

export function memberSectionFromSearchParams(search: string): MemberLocation {
  const params = new URLSearchParams(search);
  if (params.get("purchase") === "success") {
    return { section: "participation", tab: "events", event: "future" };
  }

  const requestedSection = params.get("section");
  const requestedTab = params.get("tab");
  const section = isMemberSection(requestedSection)
    ? requestedSection
    : requestedSection === null
      ? (LEGACY_TAB_SECTIONS[requestedTab ?? ""] ?? "overview")
      : "overview";

  if (section === "participation") {
    return participationLocation(requestedTab, params.get("event"));
  }
  if (section === "finance") return financeLocation(requestedTab);
  if (section === "account" && ACCOUNT_TABS.has(requestedTab ?? "")) {
    return { section, tab: requestedTab! };
  }
  return { section };
}

export function buildMemberHref(
  section: MemberSection,
  tab?: string,
  event?: EventFilter,
): string {
  const params = new URLSearchParams({ section });
  if (section === "participation") {
    const location = participationLocation(tab ?? "all", event ?? null);
    params.set("tab", location.tab!);
    if (location.event) params.set("event", location.event);
  } else if (section === "finance") {
    params.set("tab", financeLocation(tab ?? "all").tab!);
  } else if (section === "account" && ACCOUNT_TABS.has(tab ?? "")) {
    params.set("tab", tab!);
  }
  return `?${params.toString()}`;
}
