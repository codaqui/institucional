import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import UnsubscribeIsland from "./UnsubscribeIsland";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse, useFetchMock } from "../../../test/http-mock";

describe("UnsubscribeIsland", () => {
  const fetchMock = useFetchMock();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("confirma descadastro sem exigir login e sem expor e-mail quando token é válido", async () => {
    window.history.pushState({}, "", "/descadastro?token=a".padEnd(83, "0"));
    fetchMock.current.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        status: "unsubscribed",
        message:
          "Sua preferência foi atualizada. Este endereço não receberá novas comunicações promocionais.",
      }),
    );

    renderWithMui(<UnsubscribeIsland />);

    expect(
      await screen.findByText(/não receberá novas comunicações promocionais/i),
    ).toBeInTheDocument();
    expect(fetchMock.current).toHaveBeenCalledWith(
      expect.stringContaining("/campaigns/unsubscribe?token="),
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("exibe mensagem neutra quando token está ausente ou inválido", async () => {
    window.history.pushState({}, "", "/descadastro");

    renderWithMui(<UnsubscribeIsland />);

    expect(
      await screen.findByText(/Link de descadastro inválido ou expirado/i),
    ).toBeInTheDocument();
    expect(fetchMock.current).not.toHaveBeenCalled();
  });
});
