import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CertificateVerifyIsland from "./CertificateVerifyIsland";
import { renderWithMui } from "../../test/render-mui";
import { jsonResponse } from "../../test/http-mock";

describe("CertificateVerifyIsland", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/certificado/verificar");
  });

  it("uses neutral guidance for an invalid result without exposing a reason", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ valid: false })));
    renderWithMui(<CertificateVerifyIsland />);

    await user.type(screen.getByLabelText("Código de verificação"), "CODIGO-ERRADO");
    await user.click(screen.getByRole("button", { name: "Verificar" }));

    expect(await screen.findByText(
      "Não foi possível validar este código. Confira a digitação; se o problema persistir, fale com o participante ou com a organização.",
    )).toBeInTheDocument();
    expect(screen.queryByText(/não encontrado|não concedido|cancelado|sem presença/i)).not.toBeInTheDocument();
  });
});
