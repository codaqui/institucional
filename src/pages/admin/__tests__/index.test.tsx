import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminPage from "../index";
import { useAuth } from "../../../hooks/useAuth";

const replaceMock = jest.fn();
const historyMock = { replace: replaceMock };

jest.mock("../../../hooks/useAuth");
jest.mock("@docusaurus/router", () => ({
  useHistory: () => historyMock,
}));
jest.mock("../../../components/AdminNavbar", () => ({
  __esModule: true,
  default: () => <div data-testid="admin-navbar" />,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

type MemberRole = "membro" | "finance-analyzer" | "admin";

function buildMember(idx: number, role: MemberRole = "membro") {
  return {
    id: `m-${idx}`,
    name: `Member ${idx}`,
    githubHandle: `member${idx}`,
    avatarUrl: `https://example.com/${idx}.png`,
    role,
    isActive: true,
    joinedAt: "2026-01-10T10:00:00.000Z",
  };
}

describe("/admin (dashboard)", () => {
  beforeEach(() => {
    replaceMock.mockReset();
  });

  it("permite acesso do finance-analyzer sem listar membros", async () => {
    const authFetch = jest.fn();
    mockUseAuth.mockReturnValue({
      ready: true,
      isLoggedIn: true,
      isAdmin: false,
      isFinanceAnalyzer: true,
      authFetch: authFetch as any,
      user: { sub: "fa-1" } as any,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
    } as any);

    render(<AdminPage />);

    expect(
      await screen.findByText(/A gestão de membros permanece restrita a administradores/i),
    ).toBeInTheDocument();
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("lista membros com paginação e filtro de busca", async () => {
    const members = Array.from({ length: 25 }, (_, i) => buildMember(i + 1));
    const authFetch = jest.fn(async (url: string) => {
      if (url.endsWith("/admin/members")) {
        return {
          ok: true,
          status: 200,
          json: async () => members,
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    mockUseAuth.mockReturnValue({
      ready: true,
      isLoggedIn: true,
      isAdmin: true,
      isFinanceAnalyzer: false,
      authFetch: authFetch as any,
      user: { sub: "admin-1" } as any,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
    } as any);

    render(<AdminPage />);

    expect(await screen.findByText(/Membros \(25\)/i)).toBeInTheDocument();
    expect(screen.getByText("Member 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /go to page 2/i }));
    expect(await screen.findByText("Member 21")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome/i), {
      target: { value: "member 24" },
    });

    expect(await screen.findByText(/Membros \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText("Member 24")).toBeInTheDocument();
  });

  it("abre confirmação e atualiza status ativo/inativo do membro", async () => {
    const authFetch = jest.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/admin/members") && !options) {
        return {
          ok: true,
          status: 200,
          json: async () => [buildMember(1)],
        };
      }
      if (url.endsWith("/admin/members/m-1") && options?.method === "PATCH") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    mockUseAuth.mockReturnValue({
      ready: true,
      isLoggedIn: true,
      isAdmin: true,
      isFinanceAnalyzer: false,
      authFetch: authFetch as any,
      user: { sub: "admin-1" } as any,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
    } as any);

    render(<AdminPage />);

    await screen.findByText("Member 1");
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(await screen.findByRole("button", { name: /^Desativar$/i }));

    await waitFor(() => {
      expect(authFetch).toHaveBeenCalledWith(
        expect.stringContaining("/admin/members/m-1"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });
});
