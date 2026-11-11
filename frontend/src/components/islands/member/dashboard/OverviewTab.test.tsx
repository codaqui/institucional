import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import OverviewTab from "./OverviewTab";
import type { EventRegistration } from "./types";
import { renderWithMui } from "../../../../test/render-mui";

function registration(overrides: Partial<EventRegistration>): EventRegistration {
  return {
    id: "reg-1",
    status: "confirmed",
    checkedInAt: null,
    certificateGrantedAt: null,
    checkinToken: "token",
    attendeeName: "Ana",
    memberId: "member-1",
    payerMemberId: "member-1",
    event: {
      id: "event-1",
      title: "Evento",
      startAt: new Date(Date.now() + 86_400_000).toISOString(),
      location: null,
      status: "scheduled",
    },
    activation: null,
    ticketType: null,
    ...overrides,
  };
}

describe("OverviewTab", () => {
  it("prioriza participação real e identifica métricas limitadas à página", () => {
    const registrations = [
      registration({ id: "future" }),
      registration({
        id: "granted",
        certificateGrantedAt: "2026-11-01T12:00:00.000Z",
        event: {
          id: "past",
          title: "Evento passado",
          startAt: "2026-11-01T13:00:00.000Z",
          location: null,
          status: "completed",
        },
      }),
      registration({ id: "pending", status: "pending_match", memberId: null }),
    ];
    renderWithMui(
      <OverviewTab
        donations={[]}
        txLoading={false}
        subscriptions={[]}
        subsLoading={false}
        reimbursements={[]}
        reimbLoading={false}
        registrations={registrations}
        regsLoading={false}
        onOpenDonationsTab={vi.fn()}
        onOpenSubscriptionsTab={vi.fn()}
        onOpenWalletTab={vi.fn()}
      />,
    );

    const upcoming = screen.getByText("Próximos eventos").closest("a");
    const certificates = screen.getByText("Certificados").closest("a");
    expect(upcoming).toHaveTextContent("1");
    expect(upcoming).toHaveAttribute("href", "?section=participation&tab=future");
    expect(certificates).toHaveTextContent("1 disponível");
    expect(certificates).toHaveTextContent("1 pendente de conta");
    expect(certificates).toHaveAttribute("href", "?section=participation&tab=certificates");
    expect(screen.getByText("Doações nesta página")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Minhas horas/i })).toHaveAttribute(
      "href",
      "/membro/horas",
    );
  });
});
