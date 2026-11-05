import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse, useFetchMock } from "../../../../test/http-mock";
import type { PublicMemberProfile } from "../../../../lib/member-path";
import MemberProfileIsland from "../../MemberProfileIsland";

vi.mock("../../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: false,
    user: null,
    authFetch: vi.fn(),
  }),
}));

const fetchMock = useFetchMock();
const member: PublicMemberProfile = {
  id: "member-1",
  githubHandle: "membro-teste",
  name: "Membro Sintético",
  avatarUrl: "https://example.test/avatar.png",
};

const publicEntry = {
  id: "hour-1",
  sourceType: "event_checkin",
  sourceLabel: "Encontro sintético",
  hours: 2.5,
  description: "Presença aprovada",
  occurredAt: "2026-06-10T12:00:00.000Z",
};

function mockProfileRequests(hoursMember: Record<string, unknown>) {
  fetchMock.current.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/hours/public")) return jsonResponse([hoursMember]);
    if (url.endsWith("/hours/members/member-1/summary")) {
      return jsonResponse({ totalHours: 12.5, entries: [publicEntry] });
    }
    if (url.endsWith("/members/member-1/donations")) return jsonResponse([]);
    if (url.endsWith("/events/members/member-1/registrations")) return jsonResponse([]);
    if (url.endsWith("/club/public-wallet/membro-teste?limit=10")) {
      return jsonResponse({ wallet: null, transactions: [] });
    }
    if (url.endsWith("/stripe/business-members")) return jsonResponse({ items: [] });
    if (url.endsWith("/companies/member/membro-teste/public-affiliation")) return jsonResponse(null);
    return jsonResponse({ message: `Rota inesperada: ${url}` }, { status: 500 });
  });
}

function renderPublicProfile() {
  return renderWithMui(
    <MemberProfileIsland
      variant="public"
      routeHandle={member.githubHandle}
      initialMember={member}
    />,
  );
}

describe("MemberProfileIsland public hours and badge", () => {
  beforeEach(() => {
    fetchMock.current.mockReset();
  });

  it("renders approved hours, milestones, timeline and badge when allowed", async () => {
    mockProfileRequests({
      memberId: member.id,
      githubHandle: member.githubHandle,
      name: member.name,
      badge: true,
      totalHours: 12.5,
    });
    renderPublicProfile();

    expect(await screen.findByText("12,50 horas")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Marcos de horas" })).toBeInTheDocument();
    expect(screen.getByText("Presença aprovada")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Selo Codaqui de Membro Sintético" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Histórico de eventos" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Histórico de Doações" })).toBeInTheDocument();
  });

  it("does not recreate hidden hours or a disabled badge with zero-value defaults", async () => {
    mockProfileRequests({
      memberId: member.id,
      githubHandle: member.githubHandle,
      name: member.name,
      badge: false,
    });
    renderPublicProfile();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(fetchMock.current).toHaveBeenCalledWith(expect.stringContaining("/hours/public"));
    });
    expect(screen.queryByRole("heading", { name: "Horas aprovadas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Selo público" })).not.toBeInTheDocument();
    expect(screen.queryByText("0,00 horas")).not.toBeInTheDocument();
    expect(fetchMock.current.mock.calls.every(
      ([input]) => !String(input).endsWith("/hours/members/member-1/summary"),
    )).toBe(true);
    expect(screen.getByRole("heading", { name: "Histórico de eventos" })).toBeInTheDocument();
  });

  it("keeps a badge independent from hidden hours", async () => {
    mockProfileRequests({
      memberId: member.id,
      githubHandle: member.githubHandle,
      name: member.name,
      badge: true,
    });
    renderPublicProfile();

    expect(await screen.findByRole("img", { name: "Selo Codaqui de Membro Sintético" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Horas aprovadas" })).not.toBeInTheDocument();
    expect(screen.queryByText("0,00 horas")).not.toBeInTheDocument();
  });
});
