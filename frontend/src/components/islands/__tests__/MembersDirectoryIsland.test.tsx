/**
 * Testes da MembersDirectoryIsland — paginação real do diretório (Fase UI-3).
 * Cobre: total ≤ 100 sem controles (comportamento atual), total > 100 com
 * controles + label de intervalo, troca de página refetch em
 * `/members?page=N&limit=100` e a nota de busca client-side por página.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import MembersDirectoryIsland from "../MembersDirectoryIsland";
import { renderWithMui } from "../../../test/render-mui";
import { jsonResponse, useFetchMock } from "../../../test/http-mock";

const fetchMock = useFetchMock();

vi.mock("../../../lib/api-url", () => ({
  resolveApiUrl: () => "https://api.test",
}));

interface MemberShape {
  id: string;
  githubHandle: string;
  name: string;
}

function makeMember({ id, githubHandle, name }: MemberShape) {
  return {
    id,
    githubHandle,
    name,
    avatarUrl: `https://example.com/${githubHandle}.png`,
    bio: null,
    linkedinUrl: null,
    role: "membro",
    joinedAt: "2024-01-01T00:00:00Z",
  };
}

const page1Members = [
  makeMember({ id: "m-1", githubHandle: "ana", name: "Ana Silva" }),
  makeMember({ id: "m-2", githubHandle: "bruno", name: "Bruno Costa" }),
];
const page2Members = [
  makeMember({ id: "m-101", githubHandle: "carol", name: "Carol Souza" }),
];

function membersPage(data: MemberShape[], page: number, total: number, totalPages: number) {
  return {
    data,
    total,
    page,
    totalPages,
    limit: 100,
  };
}

/** Roteador de fetch: membros paginados + donors/club/business vazios. */
function mockDirectoryFetch(total: number, totalPages: number) {
  fetchMock.current.mockImplementation((url: string) => {
    if (url.includes("/members?page=1&limit=100")) {
      return Promise.resolve(
        jsonResponse(membersPage(page1Members, 1, total, totalPages)),
      );
    }
    if (url.includes("/members?page=2&limit=100")) {
      return Promise.resolve(
        jsonResponse(membersPage(page2Members, 2, total, totalPages)),
      );
    }
    if (url.includes("/members/donors")) {
      return Promise.resolve(jsonResponse(membersPage([], 1, 0, 0)));
    }
    if (url.includes("/stripe/club-members") || url.includes("/stripe/business-members")) {
      return Promise.resolve(jsonResponse({ items: [] }));
    }
    return Promise.reject(new Error(`URL não mockada: ${url}`));
  });
}

async function renderDirectory(total: number, totalPages: number) {
  mockDirectoryFetch(total, totalPages);
  renderWithMui(<MembersDirectoryIsland />);
  // Espera o conteúdo da página 1 renderizar (fim do loading inicial).
  await screen.findByText("Ana Silva");
}

describe("MembersDirectoryIsland — paginação", () => {
  it("total ≤ 100: renderiza membros sem controles de paginação", async () => {
    await renderDirectory(2, 1);

    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
    expect(screen.getByText("Bruno Costa")).toBeInTheDocument();
    expect(screen.getByText("2 membros")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: /Paginação de membros/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Mostrando /)).not.toBeInTheDocument();
  });

  it("total > 100: exibe controles e label de intervalo (COUNT do envelope)", async () => {
    await renderDirectory(150, 2);

    expect(screen.getByText("150 membros")).toBeInTheDocument();
    expect(screen.getByText("Mostrando 1–100 de 150")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: /Paginação de membros/i }),
    ).toBeInTheDocument();
  });

  it("troca de página refetch /members?page=N e troca o conteúdo", async () => {
    await renderDirectory(150, 2);

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    // Refetch na página 2 + conteúdo trocado + label atualizada.
    await screen.findByText("Carol Souza");
    expect(screen.queryByText("Ana Silva")).not.toBeInTheDocument();
    expect(screen.getByText("Mostrando 101–150 de 150")).toBeInTheDocument();
    expect(fetchMock.current).toHaveBeenCalledWith(
      "https://api.test/members?page=2&limit=100",
    );

    // Volta para a página 1.
    fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
    await screen.findByText("Ana Silva");
    expect(
      fetchMock.current.mock.calls.filter((call: unknown[]) =>
        String(call[0]).includes("/members?page=1&limit=100"),
      ),
    ).toHaveLength(2);
  });

  it("nota de busca aparece ao digitar (busca client-side na página)", async () => {
    await renderDirectory(150, 2);

    fireEvent.change(
      screen.getByPlaceholderText("Buscar por nome, @github ou bio"),
      { target: { value: "ana" } },
    );

    expect(
      await screen.findByText(/Busca aplicada à página atual/),
    ).toBeInTheDocument();
    expect(screen.getByText("Ana Silva")).toBeInTheDocument();
    expect(screen.queryByText("Bruno Costa")).not.toBeInTheDocument();
  });

  it("falha ao trocar de página exibe erro com retry", async () => {
    await renderDirectory(150, 2);

    // A partir de agora, página 2 falha.
    fetchMock.current.mockImplementation((url: string) => {
      if (url.includes("/members?page=2")) {
        return Promise.resolve(jsonResponse({}, { status: 503 }));
      }
      if (url.includes("/members?page=1")) {
        return Promise.resolve(
          jsonResponse(membersPage(page1Members, 1, 150, 2)),
        );
      }
      if (url.includes("/members/donors")) {
        return Promise.resolve(jsonResponse(membersPage([], 1, 0, 0)));
      }
      if (url.includes("/stripe/")) {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      return Promise.reject(new Error(`URL não mockada: ${url}`));
    });

    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));

    expect(
      await screen.findByText("Não foi possível carregar esta página."),
    ).toBeInTheDocument();

    // Retry: volta a mockar a página 2 com sucesso e refaz o fetch.
    mockDirectoryFetch(150, 2);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
      expect(screen.getByText("Carol Souza")).toBeInTheDocument();
    });
  });
});
