import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import MembrosEmpresaPage from "../empresa";
import { useAuth } from "../../../hooks/useAuth";

const replaceMock = jest.fn();

jest.mock("../../../hooks/useAuth");
jest.mock("@docusaurus/router", () => ({
  useHistory: () => ({ replace: replaceMock }),
}));
jest.mock("@docusaurus/Head", () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}), { virtual: true });
jest.mock("../../../components/MyCompanySection", () => ({
  __esModule: true,
  default: () => <div data-testid="my-company-section">My Company</div>,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe("/membros/empresa", () => {
  beforeEach(() => {
    replaceMock.mockReset();
  });

  it("redireciona para / quando não autenticado", async () => {
    mockUseAuth.mockReturnValue({
      ready: true,
      isLoggedIn: false,
      authFetch: jest.fn() as any,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      user: null,
      isAdmin: false,
      isFinanceAnalyzer: false,
    } as any);

    render(<MembrosEmpresaPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/");
    });
    expect(screen.queryByTestId("my-company-section")).not.toBeInTheDocument();
  });

  it("renderiza página quando autenticado", () => {
    mockUseAuth.mockReturnValue({
      ready: true,
      isLoggedIn: true,
      authFetch: jest.fn() as any,
      login: jest.fn(),
      logout: jest.fn(),
      refreshUser: jest.fn(),
      user: { sub: "u-1" } as any,
      isAdmin: false,
      isFinanceAnalyzer: false,
    } as any);

    render(<MembrosEmpresaPage />);

    expect(screen.getByText("Minha Empresa")).toBeInTheDocument();
    expect(screen.getByTestId("my-company-section")).toBeInTheDocument();
  });
});
