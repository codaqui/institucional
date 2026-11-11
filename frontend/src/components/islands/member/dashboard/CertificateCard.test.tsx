import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import CertificateCard from "./CertificateCard";
import type { CertificateData } from "./types";
import { renderWithMui } from "../../../../test/render-mui";

const certificate: CertificateData = {
  attendeeName: "Ana Participante",
  attendeeEmail: "ana@example.test",
  eventTitle: "DevPR Conf 26",
  eventStartAt: "2026-11-01T13:00:00.000Z",
  eventEndAt: "2026-11-01T14:00:00.000Z",
  workloadMinutes: 60,
  communityProjectKey: null,
  verificationCode: "ABCD-1234",
  issuedAt: "2026-11-02T12:00:00.000Z",
};

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn(writeText) },
  });
}

describe("CertificateCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "clipboard");
    Reflect.deleteProperty(document, "execCommand");
  });

  it("copies the verification code and link and opens public verification", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    renderWithMui(<CertificateCard certificate={certificate} origin="https://codaqui.dev" />);

    expect(screen.getByRole("link", { name: "Abrir verificação" })).toHaveAttribute(
      "href",
      "https://codaqui.dev/certificado/verificar?codigo=ABCD-1234",
    );
    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));
    fireEvent.click(screen.getByRole("button", { name: "Copiar link de verificação" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
    expect(writeText).toHaveBeenNthCalledWith(1, "ABCD-1234");
    expect(writeText).toHaveBeenNthCalledWith(
      2,
      "https://codaqui.dev/certificado/verificar?codigo=ABCD-1234",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Link de verificação copiado.");
  });

  it("announces clipboard failure without hiding the canonical certificate", async () => {
    mockClipboard(() => Promise.reject(new Error("denied")));
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });
    renderWithMui(<CertificateCard certificate={certificate} origin="https://codaqui.dev" />);

    fireEvent.click(screen.getByRole("button", { name: "Copiar código" }));

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/Não foi possível copiar/);
    });
    expect(screen.getByText("CERTIFICADO DE PARTICIPAÇÃO")).toBeInTheDocument();
    expect(screen.getByText("ABCD-1234", { exact: false })).toBeInTheDocument();
  });
});
