import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import AnnouncementsBarIsland from "./AnnouncementsBarIsland";
import { renderWithMui } from "../../test/render-mui";
import { jsonResponse } from "../../test/http-mock";

const snapshot = {
  generatedAt: "2026-11-11T12:00:00.000Z",
  announcements: [
    {
      id: "error-1",
      text: "Manutenção crítica",
      severity: "error",
      linkUrl: "/sobre/privacidade",
      linkLabel: "Entenda",
      startsAt: null,
      endsAt: null,
    },
    {
      id: "info-1",
      text: "<b>Manutenção</b>",
      severity: "info",
      linkUrl: "https://github.com/codaqui/institucional/issues",
      linkLabel: "Reportar bug",
      startsAt: null,
      endsAt: null,
    },
  ],
};

describe("AnnouncementsBarIsland", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    document.documentElement.dataset.theme = "light";
  });

  it("does not reserve space for an empty snapshot or a request error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ generatedAt: "now", announcements: [] })));
    const { container, unmount } = renderWithMui(<AnnouncementsBarIsland />);

    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith("/announcements/index.json"));
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    unmount();

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const errorRender = renderWithMui(<AnnouncementsBarIsland />);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(errorRender.container).toBeEmptyDOMElement();
  });

  it("renders received order, textual severities and safe links without injecting HTML", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(snapshot)));
    document.documentElement.dataset.theme = "dark";
    renderWithMui(<AnnouncementsBarIsland />);

    const region = await screen.findByRole("region", { name: "Avisos institucionais" });
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(2);
    expect(articles[0]).toHaveTextContent("Manutenção crítica");
    expect(articles[0]).toHaveTextContent("Erro");
    expect(articles[1]).toHaveTextContent("Informação");
    expect(articles[1]).toHaveTextContent("<b>Manutenção</b>");
    expect(articles[1].querySelector("b")).toBeNull();

    const internal = screen.getByRole("link", { name: "Entenda" });
    expect(internal).toHaveAttribute("href", "/sobre/privacidade");
    expect(internal).not.toHaveAttribute("target");
    const external = screen.getByRole("link", { name: "Reportar bug" });
    expect(external).toHaveAttribute("target", "_blank");
    expect(external).toHaveAttribute("rel", "noopener noreferrer");
    expect(region).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
