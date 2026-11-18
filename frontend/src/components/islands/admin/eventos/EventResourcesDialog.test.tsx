import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EventResourcesDialog from "./EventResourcesDialog";
import type { HubRow } from "./types";
import { renderWithMui } from "../../../../test/render-mui";
import { jsonResponse } from "../../../../test/http-mock";

const managedRow: HubRow = {
  kind: "internal",
  key: "event-1",
  title: "DevPR Conf 2027",
  startAt: "2027-01-10T12:00:00.000Z",
  hasOverride: false,
  canEdit: true,
  features: [],
  event: {
    id: "event-1",
    slug: "devpr-conf-2027",
    title: "DevPR Conf 2027",
    summary: "Conferência",
    description: null,
    imageUrl: null,
    location: "Maringá",
    startAt: "2027-01-10T12:00:00.000Z",
    endAt: null,
    timezone: "America/Sao_Paulo",
    communityProjectKey: "devparana",
    status: "draft",
    capacity: null,
    workloadMinutes: null,
    adultOnly: false,
    venueType: "auditorio",
    ticketTypes: [{ id: "t1" }, { id: "t2" }] as never,
    staff: [{ id: "s1" }] as never,
  },
};

const externalRow: HubRow = {
  kind: "external",
  key: "external-1",
  title: "DevPR Conf 2027",
  startAt: "2027-01-10T12:00:00.000Z",
  hasOverride: false,
  canEdit: true,
  features: [],
  communityProjectKey: "devparana",
  event: {
    id: "123",
    source: "sympla",
    sourceId: "devpr",
    sourceKey: "sympla:devpr",
    itemPath: "/eventos/sympla/devpr/123",
    title: "DevPR Conf 2027",
    summary: "Conferência",
    startAt: "2027-01-10T12:00:00.000Z",
    timezone: "America/Sao_Paulo",
    platform: "Sympla",
    host: "DevParaná",
    location: "Maringá",
    href: "https://example.com",
    tags: [],
    ctaLabel: "Inscrever-se",
  },
};

describe("EventResourcesDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("resume recursos e ativa C4P próprio com slug/nome derivados", async () => {
    const user = userEvent.setup();
    const authFetch = vi.fn().mockResolvedValue(jsonResponse({ id: "call-1" }));
    renderWithMui(
      <EventResourcesDialog open row={managedRow} onClose={vi.fn()} authFetch={authFetch} />,
    );

    expect(screen.getByText("2 tipos de ingresso")).toBeInTheDocument();
    expect(screen.getByText("1 pessoa na equipe")).toBeInTheDocument();
    expect(screen.getByDisplayValue("devpr-conf-2027-c4p")).toBeInTheDocument();
    expect(screen.getByDisplayValue("C4P — DevPR Conf 2027")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ativar C4P" }));

    await waitFor(() => expect(authFetch).toHaveBeenCalledWith(
      "/events/event-1/c4p",
      expect.objectContaining({ method: "POST" }),
    ));
    const body = JSON.parse(authFetch.mock.calls[0][1].body);
    expect(body).toEqual({ slug: "devpr-conf-2027-c4p", name: "C4P — DevPR Conf 2027" });
    expect(await screen.findByRole("link", { name: "Abrir curadoria" })).toHaveAttribute(
      "href",
      "/admin/c4p/detalhe?id=call-1",
    );
  });

  it("envia comunidade, título e início na primeira ativação externa", async () => {
    const user = userEvent.setup();
    const authFetch = vi.fn().mockResolvedValue(jsonResponse({ id: "call-2" }));
    renderWithMui(
      <EventResourcesDialog open row={externalRow} onClose={vi.fn()} authFetch={authFetch} />,
    );

    await user.click(screen.getByRole("button", { name: "Ativar C4P" }));

    await waitFor(() => expect(authFetch).toHaveBeenCalledWith(
      "/events/external/sympla:devpr:123/c4p",
      expect.objectContaining({ method: "POST" }),
    ));
    const body = JSON.parse(authFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      slug: "devpr-conf-2027-c4p",
      name: "C4P — DevPR Conf 2027",
      communityProjectKey: "devparana",
      title: "DevPR Conf 2027",
      startAt: "2027-01-10T12:00:00.000Z",
    });
  });

  it("mostra erro sem fechar nem exibir link de curadoria", async () => {
    const user = userEvent.setup();
    const authFetch = vi.fn().mockResolvedValue(jsonResponse({ message: "Slug já utilizado" }, { status: 409 }));
    renderWithMui(
      <EventResourcesDialog open row={managedRow} onClose={vi.fn()} authFetch={authFetch} />,
    );

    await user.click(screen.getByRole("button", { name: "Ativar C4P" }));

    expect(await screen.findByText("Slug já utilizado")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir curadoria" })).not.toBeInTheDocument();
  });
});
