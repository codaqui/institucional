import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import CertificadoVerificarPage from "../verificar";
import { resetRouterMocks, setMockSearch } from "../../../test-utils/router";

interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function jsonResponse(data: unknown, ok = true, status = 200): MockResponse {
  return { ok, status, json: async () => data };
}

const VALID_RESULT = {
  valid: true,
  attendeeName: "Maria Silva",
  eventTitle: "DevParaná MeetUP #42",
  eventStartAt: "2026-05-10T17:00:00Z",
  communityProjectKey: "devparana",
};

describe("CertificadoVerificarPage", () => {
  beforeEach(() => {
    resetRouterMocks();
    (globalThis.fetch as unknown as jest.Mock) = jest.fn();
  });

  it("auto-verifica código válido vindo da query string", async () => {
    setMockSearch("?codigo=ABC123");
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue(jsonResponse(VALID_RESULT));

    render(<CertificadoVerificarPage />);

    await waitFor(() => {
      expect(screen.getByText("Certificado válido")).toBeInTheDocument();
    });
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByText("DevParaná MeetUP #42")).toBeInTheDocument();
    expect(screen.getByText(/DevParaná/)).toBeInTheDocument();
    const fetchMock = globalThis.fetch as unknown as jest.Mock;
    expect(fetchMock.mock.calls[0][0]).toContain("/events/certificates/verify/ABC123");
  });

  it("renderiza selo de inválido quando o backend retorna 404", async () => {
    setMockSearch("?codigo=NAO-EXISTE");
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue(
      jsonResponse(null, false, 404)
    );

    render(<CertificadoVerificarPage />);

    await waitFor(() => {
      expect(screen.getByText("Certificado inválido")).toBeInTheDocument();
    });
  });

  it("renderiza selo de inválido quando valid=false", async () => {
    setMockSearch("?codigo=XYZ");
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue(
      jsonResponse({ valid: false })
    );

    render(<CertificadoVerificarPage />);

    await waitFor(() => {
      expect(screen.getByText("Certificado inválido")).toBeInTheDocument();
    });
  });

  it("permite digitar o código manualmente quando não vem na query", async () => {
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue(jsonResponse(VALID_RESULT));

    render(<CertificadoVerificarPage />);

    // Sem query: nenhuma verificação automática
    expect(globalThis.fetch as unknown as jest.Mock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Código de verificação"), {
      target: { value: "ABC123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificar" }));

    await waitFor(() => {
      expect(screen.getByText("Certificado válido")).toBeInTheDocument();
    });
  });

  it("mostra erro amigável quando o backend falha", async () => {
    setMockSearch("?codigo=ABC123");
    (globalThis.fetch as unknown as jest.Mock).mockRejectedValue(new Error("rede fora"));

    render(<CertificadoVerificarPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Não foi possível verificar o certificado agora. Tente novamente.")
      ).toBeInTheDocument();
    });
  });

  it("não quebra com eventStartAt inválida (defensivo contra Invalid Date)", async () => {
    setMockSearch("?codigo=ABC123");
    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue(
      jsonResponse({ ...VALID_RESULT, eventStartAt: "não-é-data" })
    );

    render(<CertificadoVerificarPage />);

    await waitFor(() => {
      expect(screen.getByText("Certificado válido")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });
});
