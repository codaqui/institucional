import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { jsonResponse } from "../../../test-utils/http";
import MembrosPage from "../index";

describe("/membros", () => {
  beforeEach(() => {
    if (jest.isMockFunction(globalThis.fetch)) {
      (globalThis.fetch as jest.Mock).mockReset();
    }
  });

  it("separa doadores de CLUB ativo", async () => {
    const members = [
      {
        id: "member-1",
        githubHandle: "monthly-user",
        name: "Monthly User",
        avatarUrl: "https://example.com/a.png",
        bio: null,
        linkedinUrl: null,
        role: "membro",
        joinedAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "member-2",
        githubHandle: "one-time-user",
        name: "One Time User",
        avatarUrl: "https://example.com/b.png",
        bio: null,
        linkedinUrl: null,
        role: "membro",
        joinedAt: "2024-02-01T00:00:00.000Z",
      },
    ];

    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes("/members?limit=100")) {
        return jsonResponse({ data: members, total: 2, page: 1, totalPages: 1 });
      }
      if (url.includes("/members/donors?limit=100")) {
        return jsonResponse({
          data: [
            {
              ...members[0],
              totalDonated: 50,
              donationCount: 1,
              lastDonatedAt: "2024-03-01T00:00:00.000Z",
            },
            {
              ...members[1],
              totalDonated: 20,
              donationCount: 1,
              lastDonatedAt: "2024-03-02T00:00:00.000Z",
            },
          ],
          total: 2,
          page: 1,
          totalPages: 1,
        });
      }
      if (url.includes("/stripe/club-members")) {
        return jsonResponse({ items: [{ memberId: "member-1" }], total: 1 });
      }
      if (url.includes("/stripe/business-members")) {
        return jsonResponse({
          items: [
            { memberId: "member-1", membershipType: "owner" },
            { memberId: "member-2", membershipType: "collaborator" },
          ],
          total: 2,
        });
      }
      return jsonResponse(null, { ok: false, status: 404 });
    });

    (globalThis.fetch as any) = fetchMock;

    render(<MembrosPage />);

    await waitFor(() => {
      expect(screen.getByText("CLUB (1)")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Doador(a)")).toHaveLength(2);
    expect(screen.getAllByText("CLUB")).toHaveLength(1);
    expect(screen.getAllByText("CLUB Business")).toHaveLength(1);
    expect(screen.getAllByText("Business Member")).toHaveLength(1);
  });
});
