import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import AuthCallback from "../callback";
import { useAuth } from "../../../hooks/useAuth";
import { resolveCommunityFromPath } from "../../../lib/community-context";

const replaceMock = jest.fn();
const historyMock = { replace: replaceMock };

jest.mock("../../../hooks/useAuth");
jest.mock("@docusaurus/router", () => ({
  useHistory: () => historyMock,
}));
jest.mock("../../../lib/community-context", () => ({
  resolveCommunityFromPath: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockResolveCommunityFromPath = resolveCommunityFromPath as jest.MockedFunction<
  typeof resolveCommunityFromPath
>;

describe("/auth/callback", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    sessionStorage.clear();
    globalThis.window.history.replaceState({}, "", "/auth/callback");
    (globalThis.fetch as jest.Mock | undefined)?.mockReset?.();
    mockResolveCommunityFromPath.mockReturnValue(null);
  });

  it("finaliza handoff com token e redireciona para returnTo relativo", async () => {
    const refreshUser = jest.fn(async () => ({ sub: "u-1" }));
    mockUseAuth.mockReturnValue({
      refreshUser,
      authFetch: jest.fn() as any,
      ready: true,
      isLoggedIn: false,
      user: null,
      login: jest.fn(),
      logout: jest.fn(),
      isAdmin: false,
      isFinanceAnalyzer: false,
    } as any);
    (globalThis.fetch as any) = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ ok: true }) }),
    );

    sessionStorage.setItem("codaqui_auth_return", "/membros/empresa");
    sessionStorage.setItem("codaqui_auth_community", "tisocial");
    globalThis.window.history.replaceState(
      {},
      "",
      "/auth/callback?status=success#token=jwt-handoff-token",
    );

    render(<AuthCallback />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/finalize"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(refreshUser).toHaveBeenCalled();
      expect(replaceMock).toHaveBeenCalledWith("/membros/empresa");
    });
    expect(sessionStorage.getItem("codaqui_auth_return")).toBeNull();
    expect(sessionStorage.getItem("codaqui_auth_community")).toBeNull();
  });

  it("sem status=success e sem sessão válida redireciona para home", async () => {
    const refreshUser = jest.fn(async () => null);
    mockUseAuth.mockReturnValue({
      refreshUser,
      authFetch: jest.fn() as any,
      ready: true,
      isLoggedIn: false,
      user: null,
      login: jest.fn(),
      logout: jest.fn(),
      isAdmin: false,
      isFinanceAnalyzer: false,
    } as any);
    (globalThis.fetch as any) = jest.fn();

    globalThis.window.history.replaceState({}, "", "/auth/callback");
    render(<AuthCallback />);

    await waitFor(() => {
      expect(refreshUser).toHaveBeenCalled();
      expect(replaceMock).toHaveBeenCalledWith("/");
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("renderiza estado de erro e volta para comunidade quando status=error", async () => {
    mockResolveCommunityFromPath.mockReturnValue({
      slug: "tisocial",
      name: "T.I. Social",
      shortName: "T.I. Social",
      logoUrl: "/img/tisocial-logo.png",
      basePath: "/comunidades/tisocial",
      theme: { primary: "#0ea5e9" },
    } as any);
    mockUseAuth.mockReturnValue({
      refreshUser: jest.fn(async () => null),
      authFetch: jest.fn() as any,
      ready: true,
      isLoggedIn: false,
      user: null,
      login: jest.fn(),
      logout: jest.fn(),
      isAdmin: false,
      isFinanceAnalyzer: false,
    } as any);

    sessionStorage.setItem("codaqui_auth_return", "/comunidades/tisocial/membro");
    globalThis.window.history.replaceState({}, "", "/auth/callback?status=error");

    render(<AuthCallback />);

    expect(await screen.findByText(/Não foi possível autenticar/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Voltar para T\.I\. Social/i })).toHaveAttribute(
      "href",
      "/comunidades/tisocial",
    );
  });
});
