import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import C4pSubmissionIsland from "./C4pSubmissionIsland";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse, useFetchMock } from "../../../test/http-mock";

const fetchMock = useFetchMock();

const openCall = {
  slug: "devpr-conf-2026",
  name: "C4P DevPR Conf 2026",
  description: "Chamada de trabalhos",
  status: "open",
  submissionOpenAt: null,
  submissionCloseAt: null,
  community: null,
  event: null,
};

async function renderIsland() {
  renderWithMui(<C4pSubmissionIsland slug="devpr-conf-2026" />);
  await waitFor(() =>
    expect(fetchMock.current).toHaveBeenCalledWith(
      expect.stringContaining("/c4p/public/calls/devpr-conf-2026"),
    ),
  );
}

describe("C4pSubmissionIsland", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carrega a chamada e exibe o formulário", async () => {
    fetchMock.current.mockResolvedValue(jsonResponse(openCall));
    await renderIsland();
    expect(await screen.findByLabelText(/título da palestra/i)).toBeTruthy();
    expect(screen.getByText("C4P DevPR Conf 2026")).toBeTruthy();
  });

  it("campanha fechada: aviso e sem formulário de submissão", async () => {
    fetchMock.current.mockResolvedValue(
      jsonResponse({ ...openCall, status: "closed" }),
    );
    await renderIsland();
    expect(
      await screen.findByText(/não está aceitando submissões/i),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/título da palestra/i)).toBeNull();
  });

  it("exige consentimento antes de enviar", async () => {
    fetchMock.current.mockResolvedValue(jsonResponse(openCall));
    await renderIsland();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/seu nome/i), "Maria");
    await user.type(screen.getByLabelText(/seu e-mail/i), "maria@example.com");
    await user.type(screen.getByLabelText(/título da palestra/i), "Palestra X");
    await user.type(screen.getByLabelText(/resumo/i), "Um resumo.");
    const submit = screen.getByRole("button", { name: /enviar proposta/i });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(
      fetchMock.current.mock.calls.filter(([url]) =>
        String(url).includes("/submissions"),
      ),
    ).toHaveLength(0);
  });

  it("envia a proposta com consentimento e mostra confirmação", async () => {
    fetchMock.current
      .mockResolvedValueOnce(jsonResponse(openCall))
      .mockResolvedValueOnce(jsonResponse({ id: "talk-1" }, { status: 201 }));
    await renderIsland();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/seu nome/i), "Maria");
    await user.type(screen.getByLabelText(/seu e-mail/i), "maria@example.com");
    await user.type(screen.getByLabelText(/título da palestra/i), "Palestra X");
    await user.type(screen.getByLabelText(/resumo/i), "Um resumo.");
    await user.click(screen.getByRole("checkbox", { name: /consentimento/i }));
    await user.click(screen.getByRole("button", { name: /enviar proposta/i }));

    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    const postCall = fetchMock.current.mock.calls.find(([url, init]) =>
      String(url).includes("/submissions") &&
      (init as RequestInit).method === "POST",
    );
    expect(postCall).toBeTruthy();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.consent).toBe(true);
    expect(body.speakerName).toBe("Maria");
    expect(body.turnstileToken).toBe("development");
  });

  it("erro da API exibe Alert", async () => {
    fetchMock.current
      .mockResolvedValueOnce(jsonResponse(openCall))
      .mockResolvedValueOnce(
        jsonResponse({ message: "Esta chamada não está aceitando submissões." }, { status: 409 }),
      );
    await renderIsland();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/seu nome/i), "Maria");
    await user.type(screen.getByLabelText(/seu e-mail/i), "maria@example.com");
    await user.type(screen.getByLabelText(/título da palestra/i), "Palestra X");
    await user.type(screen.getByLabelText(/resumo/i), "Um resumo.");
    await user.click(screen.getByRole("checkbox", { name: /consentimento/i }));
    await user.click(screen.getByRole("button", { name: /enviar proposta/i }));
    expect(
      await screen.findByText(/não está aceitando submissões/i),
    ).toBeTruthy();
  });
});
