import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import OverviewTab from "./OverviewTab";
import type { EventRegistration, ReimbursementRequest } from "./types";
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

function pendingReimbursement(): ReimbursementRequest {
  return {
    id: "reimbursement-1",
    account: { name: "Codaqui" },
    amount: 100,
    description: "Material do evento",
    receiptUrl: "https://drive.google.com/receipt",
    status: "pending",
    reviewNote: null,
    createdAt: "2026-11-01T12:00:00.000Z",
  };
}

function renderOverview(reimbursements: ReimbursementRequest[] = []) {
  const onOpenFinance = vi.fn();
  const onOpenWalletTab = vi.fn();
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
      reimbursements={reimbursements}
      reimbLoading={false}
      registrations={registrations}
      regsLoading={false}
      onOpenFinance={onOpenFinance}
      onOpenWalletTab={onOpenWalletTab}
    />,
  );
  return { onOpenFinance };
}

describe("OverviewTab", () => {
  it("prioriza participação e não apresenta a página financeira como total", () => {
    const { onOpenFinance } = renderOverview();

    const upcoming = screen.getByText("Próximos eventos").closest("a");
    const certificates = screen.getByText("Certificados").closest("a");
    expect(upcoming).toHaveTextContent("1");
    expect(upcoming).toHaveAttribute(
      "href",
      "?section=participation&tab=events&event=future",
    );
    expect(certificates).toHaveTextContent("1 disponível");
    expect(certificates).toHaveTextContent("1 pendente de conta");
    expect(certificates).toHaveAttribute("href", "?section=participation&tab=certificates");
    expect(screen.queryByText("Doações nesta página")).not.toBeInTheDocument();
    expect(screen.queryByText("Assinaturas ativas nesta página")).not.toBeInTheDocument();
    expect(screen.queryByText("Reembolsos pendentes")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir apoio e financeiro" }));
    expect(onOpenFinance).toHaveBeenCalledTimes(1);
  });

  it("mostra reembolsos pendentes somente quando existem", () => {
    renderOverview([pendingReimbursement()]);

    expect(screen.getByText("Reembolsos pendentes")).toBeInTheDocument();
  });
});
