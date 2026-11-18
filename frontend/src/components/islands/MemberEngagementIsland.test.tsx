import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MemberEngagementIsland from "./MemberEngagementIsland";
import { jsonResponse } from "../../test/http-mock";

vi.mock("../../lib/api-url", () => ({ resolveApiUrl: () => "https://api.test" }));

const engagement = {
  designations: [{ key: "community:devparana:responsible", label: "Responsável · DevParaná" }],
  communities: [{ slug: "devparana", name: "DevParaná", href: "/comunidades/devparana" }],
  mentor: { id: "mentor-1", href: "/participe/mentoria?mentor=mentor-1" },
};

describe("MemberEngagementIsland", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("renders public designations, community links and an active mentorship action", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(engagement)));
    render(<MemberEngagementIsland routeHandle="maria" />);

    expect(screen.getByLabelText("Carregando vínculos públicos")).toBeInTheDocument();
    expect(await screen.findByText("Responsável · DevParaná")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "DevParaná" })).toHaveAttribute("href", "/comunidades/devparana");
    expect(screen.getByRole("link", { name: "Agendar mentoria" })).toHaveAttribute("href", "/participe/mentoria?mentor=mentor-1");
    expect(screen.queryByText(/targetId|appointedBy|applicationNotes/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/members/by-handle/maria/engagement",
      { signal: expect.any(AbortSignal) },
    );
  });

  it("omits the section and mentorship action when visibility returns no links", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ designations: [], communities: [], mentor: null })));
    const { container } = render(<MemberEngagementIsland routeHandle="maria" />);

    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByRole("link", { name: "Agendar mentoria" })).not.toBeInTheDocument();
  });

  it("offers an independent retry after an API failure", async () => {
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({}, { status: 503 })))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse(engagement)));
    const user = userEvent.setup();
    render(<MemberEngagementIsland routeHandle="maria" />);

    expect(await screen.findByText(/Não foi possível carregar os vínculos públicos/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Responsável · DevParaná")).toBeInTheDocument();
  });
});
