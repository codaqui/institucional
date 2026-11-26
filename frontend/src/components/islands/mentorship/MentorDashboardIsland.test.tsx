import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse } from "../../../test/http-mock";
import { completeMenteeLinkFlow } from "../../../test/mentorship-session-fixtures";
import MentorDashboardIsland from "./MentorDashboardIsland";

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  isAdmin: false,
  replace: vi.fn(),
}));
vi.mock("../../../lib/use-auth", () => ({
  useAuth: () => ({
    ready: true,
    isLoggedIn: true,
    isAdmin: mocks.isAdmin,
    user: {
      sub: "member-1",
      handle: "ana",
      name: "Ana",
      roles: mocks.isAdmin ? ["admin"] : ["membro"],
    },
    authFetch: mocks.authFetch,
  }),
}));

const session = {
  id: "session-1",
  mentorId: "mentor-1",
  menteeName: "Bia",
  menteeEmail: "bia@x.dev",
  topicTags: ["DevOps"],
  scheduledAt: "2026-11-16T22:00:00.000Z",
  durationMin: 60,
  timeZone: "America/Sao_Paulo",
  status: "requested",
  meetLink: null,
};

interface AvailabilityRule {
  weekday: number;
  startTime: string;
  endTime: string;
  timeZone: string;
}

let availabilityRules: AvailabilityRule[] = [];

const AVAILABILITY_PUT_PATH = /^\/mentorship\/availability\/(\d+)$/;

function availabilityPutCalls() {
  return mocks.authFetch.mock.calls.filter(
    ([path, init]) =>
      typeof path === "string" &&
      AVAILABILITY_PUT_PATH.test(path) &&
      init?.method === "PUT",
  );
}

async function renderAvailabilityEditor() {
  const user = userEvent.setup();
  renderWithMui(<MentorDashboardIsland />);
  await screen.findByLabelText("Início da janela 1");
  return user;
}

async function selectDay(user: ReturnType<typeof userEvent.setup>, day: string) {
  await user.selectOptions(screen.getByLabelText("Dia da semana"), day);
}

async function editWindow(index: number, startTime: string, endTime: string) {
  fireEvent.change(screen.getByLabelText(`Início da janela ${index}`), {
    target: { value: startTime },
  });
  fireEvent.change(screen.getByLabelText(`Fim da janela ${index}`), {
    target: { value: endTime },
  });
}

async function addWindow(user: ReturnType<typeof userEvent.setup>, startTime: string, endTime: string) {
  await user.click(screen.getByRole("button", { name: "Adicionar janela" }));
  await editWindow(1, startTime, endTime);
}

async function saveDay(user: ReturnType<typeof userEvent.setup>, day: string) {
  await user.click(
    screen.getByRole("button", { name: `Salvar disponibilidade de ${day}` }),
  );
}

describe("MentorDashboardIsland", () => {
  beforeEach(() => {
    mocks.isAdmin = false;
    mocks.replace.mockReset();
    vi.stubGlobal("location", {
      replace: mocks.replace,
      origin: "http://localhost",
    });
    availabilityRules = [
      {
        weekday: 1,
        startTime: "19:00",
        endTime: "20:00",
        timeZone: "America/Sao_Paulo",
      },
      {
        weekday: 1,
        startTime: "20:00",
        endTime: "21:00",
        timeZone: "America/Sao_Paulo",
      },
      {
        weekday: 3,
        startTime: "09:00",
        endTime: "10:00",
        timeZone: "America/Chicago",
      },
    ];
    mocks.authFetch
      .mockReset()
      .mockImplementation(async (path: string, init?: RequestInit) => {
        if (path === "/mentorship/profile")
          return jsonResponse({
            id: "mentor-1",
            areas: ["DevOps"],
            focus: "Carreira",
          });
        if (path === "/mentorship/sessions") return jsonResponse([session]);
        if (path === "/mentorship/availability/mine")
          return jsonResponse(availabilityRules);
        const availabilityPut = path.match(AVAILABILITY_PUT_PATH);
        if (availabilityPut && init?.method === "PUT") {
          const weekday = Number(availabilityPut[1]);
          const body = JSON.parse(String(init?.body)) as Array<Omit<AvailabilityRule, "weekday">>;
          availabilityRules = [
            ...availabilityRules.filter((rule) => rule.weekday !== weekday),
            ...body.map((rule) => ({ ...rule, weekday })),
          ];
          return jsonResponse(body);
        }
        if (
          path.startsWith("/mentorship/member-options") ||
          path === "/mentorship/sessions/session-1/mentee"
        ) {
          return jsonResponse(
            init?.method === "POST"
              ? {
                  ...session,
                  menteeMember: {
                    id: "member-1",
                    name: "Ana",
                    githubHandle: "ana",
                    avatarUrl: "avatar",
                  },
                }
              : [
                  {
                    id: "member-1",
                    name: "Ana",
                    githubHandle: "ana",
                    avatarUrl: "avatar",
                  },
                ],
          );
        }
        return jsonResponse(
          {
            ...session,
            status: "confirmed",
            meetLink: "https://meet.example.test/session",
          },
          { status: init?.method === "POST" ? 201 : 200 },
        );
      });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("guides the mentor to publish weekly availability", async () => {
    renderWithMui(<MentorDashboardIsland />);

    expect(
      await screen.findByText(
        "Cadastre ao menos um horário semanal para oferecer sessões na página pública.",
      ),
    ).toBeInTheDocument();
  });

  it("confirms a request with an HTTPS meet link", async () => {
    const user = userEvent.setup();
    renderWithMui(<MentorDashboardIsland />);

    await user.type(
      await screen.findByLabelText(/^Link da sessão/),
      "https://meet.example.test/session",
    );
    await user.click(screen.getByRole("button", { name: "Confirmar sessão" }));

    await waitFor(() =>
      expect(mocks.authFetch).toHaveBeenCalledWith(
        "/mentorship/sessions/session-1/confirm",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    const confirmCall = mocks.authFetch.mock.calls.find(
      ([path]) => path === "/mentorship/sessions/session-1/confirm",
    );
    expect(JSON.parse(String(confirmCall?.[1]?.body))).toEqual({
      meetLink: "https://meet.example.test/session",
    });
    expect(await screen.findByText(/sessão confirmada/i)).toBeInTheDocument();
  });

  it("shows a Google Calendar link only for confirmed sessions", async () => {
    const confirmed = {
      ...session,
      id: "session-2",
      status: "confirmed",
      meetLink: "https://meet.example.test/session",
      token: "token-2",
      scheduledAt: "2026-11-17T22:00:00.000Z",
    };
    const completed = { ...confirmed, id: "session-3", status: "completed" };
    const canceled = { ...confirmed, id: "session-4", status: "canceled" };
    mocks.authFetch.mockImplementation(async (path: string) => {
      if (path === "/mentorship/profile")
        return jsonResponse({
          id: "mentor-1",
          areas: ["DevOps"],
          focus: "Carreira",
        });
      if (path === "/mentorship/sessions")
        return jsonResponse([session, confirmed, completed, canceled]);
      if (path === "/mentorship/availability/mine")
        return jsonResponse(availabilityRules);
      return jsonResponse({});
    });

    renderWithMui(<MentorDashboardIsland />);

    const links = await screen.findAllByRole("link", {
      name: "Adicionar ao Google Calendar",
    });
    expect(links).toHaveLength(1);
    const href = links[0].getAttribute("href") ?? "";
    expect(href.startsWith("https://calendar.google.com/calendar/render?action=TEMPLATE")).toBe(
      true,
    );
    expect(href).toContain("dates=20261117T220000Z%2F20261117T230000Z");
    expect(href).toContain(encodeURIComponent("http://localhost/mentoria/sessao/token-2"));
    expect(href).toContain(
      `location=${encodeURIComponent("https://meet.example.test/session")}`,
    );
  });

  it("shows friendly session data, links a participant and reloads sessions", async () => {
    const user = userEvent.setup();
    renderWithMui(<MentorDashboardIsland />);

    expect(await screen.findByText("Solicitada")).toBeInTheDocument();
    expect(screen.getByText(/16\/11\/2026/)).toBeInTheDocument();
    expect(screen.getByText("Não vinculado à plataforma")).toBeInTheDocument();

    await completeMenteeLinkFlow(user);

    await waitFor(() => {
      expect(mocks.authFetch).toHaveBeenCalledWith(
        "/mentorship/sessions/session-1/mentee",
        expect.objectContaining({ method: "POST" }),
      );
      expect(
        mocks.authFetch.mock.calls.filter(
          ([path]) => path === "/mentorship/sessions",
        ).length,
      ).toBeGreaterThanOrEqual(2);
    });
  });

  it("allows an admin who is also a mentor to configure their own availability", async () => {
    mocks.isAdmin = true;
    renderWithMui(<MentorDashboardIsland />);

    expect(
      await screen.findByText("Disponibilidade semanal"),
    ).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.authFetch).toHaveBeenCalledWith("/mentorship/profile");
    expect(mocks.authFetch).toHaveBeenCalledWith("/mentorship/sessions");
  });

  describe("editor de disponibilidade semanal", () => {
    it("carrega as janelas e o fuso do dia selecionado", async () => {
      renderWithMui(<MentorDashboardIsland />);

      expect(await screen.findByLabelText("Início da janela 1")).toHaveValue(
        "19:00",
      );
      expect(screen.getByLabelText("Fim da janela 1")).toHaveValue("20:00");
      expect(screen.getByLabelText("Início da janela 2")).toHaveValue("20:00");
      expect(screen.getByLabelText("Fim da janela 2")).toHaveValue("21:00");
      expect(screen.getByLabelText("Fuso horário")).toHaveValue(
        "America/Sao_Paulo",
      );
      expect(mocks.authFetch).toHaveBeenCalledWith(
        "/mentorship/availability/mine",
      );
    });

    it("mostra estado vazio para dia sem janelas", async () => {
      const user = await renderAvailabilityEditor();
      await user.selectOptions(
        screen.getByLabelText("Dia da semana"),
        "2",
      );

      expect(
        screen.getByText(
          "Nenhuma janela cadastrada para Terça. Adicione uma janela para atender neste dia.",
        ),
      ).toBeInTheDocument();
    });

    it("adiciona duas janelas e envia o array completo no PUT", async () => {
      const user = await renderAvailabilityEditor();
      await selectDay(user, "2");
      await user.click(screen.getByRole("button", { name: "Adicionar janela" }));
      await user.click(screen.getByRole("button", { name: "Adicionar janela" }));

      await editWindow(1, "10:00", "11:00");
      await editWindow(2, "14:00", "15:00");
      await user.selectOptions(
        screen.getByLabelText("Fuso horário"),
        "America/New_York",
      );
      await saveDay(user, "Terça");

      await waitFor(() => expect(availabilityPutCalls()).toHaveLength(1));
      expect(JSON.parse(String(availabilityPutCalls()[0]?.[1]?.body))).toEqual([
        {
          startTime: "10:00",
          endTime: "11:00",
          timeZone: "America/New_York",
        },
        {
          startTime: "14:00",
          endTime: "15:00",
          timeZone: "America/New_York",
        },
      ]);
      expect(
        await screen.findByText("Disponibilidade de Terça salva."),
      ).toBeInTheDocument();
    });

    it("remove uma janela e salva o array restante", async () => {
      const user = userEvent.setup();
      renderWithMui(<MentorDashboardIsland />);

      await screen.findByLabelText("Início da janela 2");
      await user.click(
        screen.getByRole("button", { name: "Remover janela 1" }),
      );
      await saveDay(user, "Segunda");

      await waitFor(() => expect(availabilityPutCalls()).toHaveLength(1));
      expect(JSON.parse(String(availabilityPutCalls()[0]?.[1]?.body))).toEqual([
        {
          startTime: "20:00",
          endTime: "21:00",
          timeZone: "America/Sao_Paulo",
        },
      ]);
    });

    it("envia array vazio no PUT quando todas as janelas são removidas", async () => {
      const user = userEvent.setup();
      renderWithMui(<MentorDashboardIsland />);

      await screen.findByLabelText("Início da janela 2");
      await user.click(
        screen.getByRole("button", { name: "Remover janela 1" }),
      );
      await user.click(
        screen.getByRole("button", { name: "Remover janela 1" }),
      );
      expect(
        screen.getByText(
          "Nenhuma janela cadastrada para Segunda. Adicione uma janela para atender neste dia.",
        ),
      ).toBeInTheDocument();

      await saveDay(user, "Segunda");

      await waitFor(() => expect(availabilityPutCalls()).toHaveLength(1));
      expect(JSON.parse(String(availabilityPutCalls()[0]?.[1]?.body))).toEqual(
        [],
      );
    });

    it("preserva o rascunho ao trocar de dia", async () => {
      const user = await renderAvailabilityEditor();
      await selectDay(user, "2");
      await addWindow(user, "10:00", "11:00");

      await selectDay(user, "3");
      expect(await screen.findByLabelText("Início da janela 1")).toHaveValue(
        "09:00",
      );

      await selectDay(user, "2");
      expect(screen.getByLabelText("Início da janela 1")).toHaveValue("10:00");
      expect(screen.getByLabelText("Fim da janela 1")).toHaveValue("11:00");
    });

    it("mantém o fuso horário por dia", async () => {
      const user = await renderAvailabilityEditor();
      await selectDay(user, "2");
      await user.selectOptions(
        screen.getByLabelText("Fuso horário"),
        "America/New_York",
      );
      await selectDay(user, "3");
      expect(screen.getByLabelText("Fuso horário")).toHaveValue(
        "America/Chicago",
      );
      await selectDay(user, "2");
      expect(screen.getByLabelText("Fuso horário")).toHaveValue(
        "America/New_York",
      );
    });

    it("indica alterações não salvas até o PUT confirmar", async () => {
      const user = userEvent.setup();
      renderWithMui(<MentorDashboardIsland />);

      await screen.findByLabelText("Início da janela 2");
      expect(
        screen.queryByText("Segunda (não salvo)"),
      ).not.toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: "Remover janela 1" }),
      );
      expect(screen.getByText("Segunda (não salvo)")).toBeInTheDocument();

      await saveDay(user, "Segunda");
      await waitFor(() => expect(availabilityPutCalls()).toHaveLength(1));
      await waitFor(() =>
        expect(
          screen.queryByText("Segunda (não salvo)"),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByLabelText("Início da janela 1")).toHaveValue("20:00");
    });

    it("valida no submit e foca o erro sem enviar o PUT", async () => {
      const user = await renderAvailabilityEditor();
      await selectDay(user, "2");
      await user.click(screen.getByRole("button", { name: "Adicionar janela" }));
      await editWindow(1, "11:00", "10:00");

      await saveDay(user, "Terça");

      expect(
        await screen.findByText(/início deve ser anterior ao fim/i),
      ).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveFocus();
      expect(availabilityPutCalls()).toHaveLength(0);
    });

    it("rejeita janelas sobrepostas no submit", async () => {
      const user = await renderAvailabilityEditor();
      await selectDay(user, "2");
      await user.click(screen.getByRole("button", { name: "Adicionar janela" }));
      await addWindow(user, "10:00", "11:00");
      await editWindow(2, "10:30", "11:30");

      await saveDay(user, "Terça");

      expect(
        await screen.findByText(/não podem se sobrepor/i),
      ).toBeInTheDocument();
      expect(availabilityPutCalls()).toHaveLength(0);
    });

    it("anuncia erro do PUT no formulário com foco e preserva o rascunho", async () => {
      const user = userEvent.setup();
      mocks.authFetch.mockImplementation(async (path: string) => {
        if (path === "/mentorship/profile")
          return jsonResponse({
            id: "mentor-1",
            areas: ["DevOps"],
            focus: "Carreira",
          });
        if (path === "/mentorship/sessions") return jsonResponse([session]);
        if (path === "/mentorship/availability/mine")
          return jsonResponse(availabilityRules);
        if (AVAILABILITY_PUT_PATH.test(path))
          return jsonResponse(
            { message: "Horário sobrepõe outra janela." },
            { status: 400 },
          );
        return jsonResponse({});
      });

      renderWithMui(<MentorDashboardIsland />);

      const form = await screen.findByRole("form", {
        name: "Editor de disponibilidade semanal",
      });
      await screen.findByLabelText("Início da janela 1");
      await selectDay(user, "2");
      await addWindow(user, "10:00", "11:00");
      await saveDay(user, "Terça");

      const alert = await within(form).findByRole("alert");
      expect(alert).toHaveTextContent("Horário sobrepõe outra janela.");
      expect(alert).toHaveFocus();
      expect(screen.getByLabelText("Início da janela 1")).toHaveValue("10:00");
      expect(screen.getByText("Terça (não salvo)")).toBeInTheDocument();
      expect(
        mocks.authFetch.mock.calls.filter(
          ([path]) => path === "/mentorship/availability/mine",
        ),
      ).toHaveLength(1);
      expect(screen.getAllByRole("alert")).toHaveLength(1);
    });

    it("substitui alertas antigos ao reenviar o formulário", async () => {
      const user = await renderAvailabilityEditor();
      await selectDay(user, "2");
      await addWindow(user, "10:00", "11:00");
      await saveDay(user, "Terça");
      expect(
        await screen.findByText("Disponibilidade de Terça salva."),
      ).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText("Fim da janela 1"), {
        target: { value: "09:00" },
      });
      await saveDay(user, "Terça");
      expect(
        screen.queryByText("Disponibilidade de Terça salva."),
      ).not.toBeInTheDocument();
      expect(
        await screen.findByText(/início deve ser anterior ao fim/i),
      ).toBeInTheDocument();
      expect(availabilityPutCalls()).toHaveLength(1);

      fireEvent.change(screen.getByLabelText("Fim da janela 1"), {
        target: { value: "11:00" },
      });
      await saveDay(user, "Terça");
      expect(
        screen.queryByText(/início deve ser anterior ao fim/i),
      ).not.toBeInTheDocument();
      expect(
        await screen.findByText("Disponibilidade de Terça salva."),
      ).toBeInTheDocument();
      expect(availabilityPutCalls()).toHaveLength(2);
    });

    it("não exibe empty state falso nem permite salvar quando o GET falha", async () => {
      const user = userEvent.setup();
      let availabilityFails = true;
      mocks.authFetch.mockImplementation(async (path: string) => {
        if (path === "/mentorship/profile")
          return jsonResponse({
            id: "mentor-1",
            areas: ["DevOps"],
            focus: "Carreira",
          });
        if (path === "/mentorship/sessions") return jsonResponse([]);
        if (path === "/mentorship/availability/mine") {
          if (availabilityFails)
            return jsonResponse({ message: "Falha interna." }, { status: 500 });
          return jsonResponse(availabilityRules);
        }
        return jsonResponse({});
      });

      renderWithMui(<MentorDashboardIsland />);

      const form = await screen.findByRole("form", {
        name: "Editor de disponibilidade semanal",
      });
      const alert = await within(form).findByRole("alert");
      expect(alert).toHaveTextContent(
        "Não foi possível carregar sua disponibilidade. Tente novamente.",
      );
      expect(alert).toHaveFocus();
      expect(
        screen.queryByText(/Nenhuma janela cadastrada/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Salvar disponibilidade/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Adicionar janela" }),
      ).not.toBeInTheDocument();
      expect(availabilityPutCalls()).toHaveLength(0);

      availabilityFails = false;
      await user.click(
        screen.getByRole("button", { name: "Tentar novamente" }),
      );
      expect(
        await screen.findByLabelText("Início da janela 1"),
      ).toHaveValue("19:00");
      expect(within(form).queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
