import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MemberCertificatesTab, { certificateAvailability } from "./MemberCertificatesTab";
import type { EventRegistration } from "./types";
import { renderWithMui } from "../../../../test/render-mui";

function makeRegistration(overrides: Partial<EventRegistration> = {}): EventRegistration {
  return {
    id: "reg-1",
    status: "confirmed",
    checkedInAt: null,
    certificateGrantedAt: "2026-11-01T12:00:00.000Z",
    checkinToken: "token-1",
    attendeeName: "Ana",
    memberId: "member-1",
    payerMemberId: "member-1",
    event: {
      id: "event-1",
      title: "DevPR Conf 26",
      startAt: "2026-11-01T13:00:00.000Z",
      location: "Maringá",
      status: "completed",
    },
    activation: null,
    ticketType: { name: "Gratuito", kind: "free", priceCents: 0 },
    ...overrides,
  };
}

describe("MemberCertificatesTab", () => {
  it("abre um certificado concedido mesmo sem presença", async () => {
    const user = userEvent.setup();
    const onEmitCertificate = vi.fn();
    const registration = makeRegistration();
    renderWithMui(
      <MemberCertificatesTab
        registrations={[registration]}
        loading={false}
        error=""
        onEmitCertificate={onEmitCertificate}
      />,
    );

    expect(certificateAvailability(registration)).toBe("available");
    expect(screen.getByText("DevPR Conf 26")).toBeInTheDocument();
    expect(screen.getByText("Certificado disponível")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver certificado" }));
    expect(onEmitCertificate).toHaveBeenCalledWith("reg-1");
  });

  it("orienta o vínculo da conta quando a concessão ainda está pendente de cadastro", () => {
    const registration = makeRegistration({
      status: "pending_match",
      memberId: null,
    });
    renderWithMui(
      <MemberCertificatesTab
        registrations={[registration]}
        loading={false}
        error=""
        onEmitCertificate={vi.fn()}
      />,
    );

    expect(certificateAvailability(registration)).toBe("pending_account");
    expect(screen.getByText(/aguardando vínculo da conta/i)).toBeInTheDocument();
    expect(screen.getByText(/e-mail verificado no GitHub/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver certificado" })).not.toBeInTheDocument();
  });

  it("explica uma concessão indisponível sem prometer emissão", () => {
    const registration = makeRegistration({ certificateGrantedAt: null });
    renderWithMui(
      <MemberCertificatesTab
        registrations={[registration]}
        loading={false}
        error=""
        onEmitCertificate={vi.fn()}
      />,
    );

    expect(certificateAvailability(registration)).toBe("unavailable");
    expect(screen.getByText("Certificado ainda não disponível")).toBeInTheDocument();
    expect(screen.getByText(/organização ainda não concedeu/i)).toBeInTheDocument();
  });

  it("abre somente o certificado indicado pelo deep link", async () => {
    const onEmitCertificate = vi.fn();
    const selected = makeRegistration({ id: "reg-selected" });
    const other = makeRegistration({ id: "reg-other", event: null });
    renderWithMui(
      <MemberCertificatesTab
        registrations={[other, selected]}
        loading={false}
        error=""
        selectedCertificateId="reg-selected"
        onEmitCertificate={onEmitCertificate}
      />,
    );

    await waitFor(() => expect(onEmitCertificate).toHaveBeenCalledWith("reg-selected"));
    expect(onEmitCertificate).toHaveBeenCalledTimes(1);
  });
});
