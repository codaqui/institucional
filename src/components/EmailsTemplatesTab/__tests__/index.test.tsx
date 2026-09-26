import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import EmailsTemplatesTab from "..";
import { buildAuthState, mockUseAuth } from "../../../test-utils/auth";
import { jsonResponse } from "../../../test-utils/http";

jest.mock("../../../hooks/useAuth");

const LIST = [
  { id: "event-registration-confirmation", subject: "Inscrição confirmada — {{eventTitle}}", isOverride: false, updatedAt: null },
  { id: "event-reminder-d1", subject: "Lembrete: {{eventTitle}} é amanhã", isOverride: true, updatedAt: "2026-09-20T00:00:00.000Z" },
  { id: "event-post-event", subject: "Obrigado por participar de {{eventTitle}}", isOverride: false, updatedAt: null },
];

const DETAIL = {
  id: "event-registration-confirmation",
  subject: "Inscrição confirmada — {{eventTitle}}",
  bodyMarkdown: "Olá, {{attendeeName}}!",
  isOverride: false,
  updatedAt: null,
  variables: ["attendeeName", "eventTitle", "checkinUrl"],
};

function mockFetch(handlers: Record<string, unknown>) {
  const authFetch = jest.fn(async (url: string, init?: { method?: string }) => {
    const method = init?.method ?? "GET";
    const key = `${method} ${url}`;
    if (handlers[key]) return jsonResponse(handlers[key]);
    return jsonResponse({ error: "not mocked" }, { ok: false, status: 404 });
  });
  mockUseAuth.mockReturnValue(buildAuthState({ authFetch: authFetch as any }));
  return authFetch;
}

describe("EmailsTemplatesTab", () => {
  it("lista templates com chip de estado e carrega o editor ao selecionar", async () => {
    mockFetch({
      "GET /notifications/templates": LIST,
      "GET /notifications/templates/event-registration-confirmation": DETAIL,
    });
    render(<EmailsTemplatesTab />);

    expect(await screen.findByText("Personalizado")).toBeInTheDocument();
    expect(screen.getAllByText("Padrão").length).toBe(2);

    fireEvent.click(screen.getByText("event-registration-confirmation"));
    expect(await screen.findByDisplayValue("Olá, {{attendeeName}}!")).toBeInTheDocument();
    expect(screen.getByText("{{checkinUrl}}")).toBeInTheDocument();
  });

  it("salva o template editado via PUT", async () => {
    const updatedDetail = {
      ...DETAIL,
      subject: "Inscrição ok — {{eventTitle}}",
      bodyMarkdown: "Olá, **{{attendeeName}}**!",
      isOverride: true,
      updatedAt: "2026-09-25T00:00:00.000Z",
    };
    const authFetch = mockFetch({
      "GET /notifications/templates": LIST,
      "GET /notifications/templates/event-registration-confirmation": DETAIL,
      "PUT /notifications/templates/event-registration-confirmation": updatedDetail,
    });
    render(<EmailsTemplatesTab />);

    fireEvent.click(await screen.findByText("event-registration-confirmation"));
    const body = await screen.findByDisplayValue("Olá, {{attendeeName}}!");
    fireEvent.change(body, { target: { value: "Olá, **{{attendeeName}}**!" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        "/notifications/templates/event-registration-confirmation",
        expect.objectContaining({ method: "PUT" }),
      );
    });
    expect(await screen.findByRole("button", { name: /restaurar padrão/i })).toBeEnabled();
  });

  it("ignora resposta lenta de seleção anterior (race entre seleções)", async () => {
    const detailA = { ...DETAIL, subject: "Assunto A", bodyMarkdown: "Corpo A" };
    const detailB = {
      ...DETAIL,
      id: "event-reminder-d1",
      subject: "Assunto B",
      bodyMarkdown: "Corpo B",
    };
    const authFetch = jest.fn(async (url: string) => {
      if (url.endsWith("/notifications/templates")) return jsonResponse(LIST);
      if (url.endsWith("/notifications/templates/event-registration-confirmation")) {
        await new Promise((r) => setTimeout(r, 60));
        return jsonResponse(detailA);
      }
      if (url.endsWith("/notifications/templates/event-reminder-d1")) {
        return jsonResponse(detailB);
      }
      return jsonResponse({ error: "not mocked" }, { ok: false, status: 404 });
    });
    mockUseAuth.mockReturnValue(buildAuthState({ authFetch: authFetch as any }));
    render(<EmailsTemplatesTab />);

    fireEvent.click(await screen.findByText("event-registration-confirmation"));
    fireEvent.click(screen.getByText("event-reminder-d1"));

    expect(await screen.findByDisplayValue("Corpo B")).toBeInTheDocument();
    // a resposta lenta de A chega depois, mas não deve sobrescrever a seleção atual
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(screen.getByDisplayValue("Corpo B")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Corpo A")).not.toBeInTheDocument();
  });

  it("envia e-mail de teste e exibe feedback", async () => {
    mockFetch({
      "GET /notifications/templates": LIST,
      "GET /notifications/templates/event-registration-confirmation": DETAIL,
      "POST /notifications/templates/event-registration-confirmation/test": { emailLogId: "log-1" },
    });
    render(<EmailsTemplatesTab />);

    fireEvent.click(await screen.findByText("event-registration-confirmation"));
    fireEvent.click(await screen.findByRole("button", { name: /enviar teste/i }));

    expect(await screen.findByText(/E-mail de teste enviado/)).toBeInTheDocument();
  });
});
