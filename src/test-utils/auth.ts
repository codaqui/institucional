import { useAuth } from "../hooks/useAuth";

type UseAuthReturn = ReturnType<typeof useAuth>;

export const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

export function buildAuthState(
  overrides: Partial<UseAuthReturn> = {},
): UseAuthReturn {
  return {
    ready: true,
    isLoggedIn: true,
    isAdmin: false,
    isFinanceAnalyzer: false,
    authFetch: jest.fn(),
    user: null,
    login: jest.fn(),
    logout: jest.fn(),
    refreshUser: jest.fn(),
    ...overrides,
  };
}
