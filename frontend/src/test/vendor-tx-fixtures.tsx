import { vi } from "vitest";
import type { Mock } from "vitest";

// Fixtures e mocks compartilhados entre os testes das telas de transações de
// fornecedor (pagamentos/recebimentos). Os vi.mock abaixo são registrados
// quando este módulo é avaliado — importe-o ANTES do componente sob teste.
const state = vi.hoisted(() => ({
  ready: true,
  isLoggedIn: true,
  isAdmin: true,
  isFinanceAnalyzer: false,
  authFetch: vi.fn(),
}));
export const authState = state;

vi.mock("../lib/use-auth", () => ({
  useAuth: () => ({
    user: null,
    ready: authState.ready,
    isLoggedIn: authState.isLoggedIn,
    isAdmin: authState.isAdmin,
    isFinanceAnalyzer: authState.isFinanceAnalyzer,
    isEventOrganizer: false,
    isEventFinance: false,
    isEventHost: false,
    isEventChecker: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    authFetch: authState.authFetch,
  }),
}));

vi.mock("../lib/config", () => ({
  API_URL: "https://api.test",
  STRIPE_PUBLISHABLE_KEY: "",
}));

export const vendors = [
  {
    id: "v1",
    name: "Acme Ltda",
    document: "44593429000105",
    website: null,
    accountId: "av1",
  },
  {
    id: "v2",
    name: "Fornecedor X",
    document: null,
    website: null,
    accountId: "av2",
  },
];

export const accounts = [
  { id: "a1", name: "Banco Principal", type: "BANK" },
  { id: "a2", name: "Conta Externa", type: "EXTERNAL" },
];

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export interface VendorTxFetchOverrides {
  vendors?: unknown;
  accounts?: unknown;
  [key: string]: unknown;
}

/**
 * authFetch mock das telas de vendor-tx: `route` resolve as respostas
 * específicas da tela (retornando null para cair no roteamento comum);
 * /vendors, /ledger/accounts e o fallback JSON vazio vivem aqui.
 */
export function makeVendorFetchMock<T extends VendorTxFetchOverrides>(
  overrides: T,
  route: (url: string, o: T) => Response | null,
) {
  return vi.fn((url: string) => {
    const primary = route(url, overrides);
    if (primary) return Promise.resolve(primary);
    if (url.includes("/vendors")) {
      return Promise.resolve(jsonResponse(overrides.vendors ?? vendors));
    }
    if (url.includes("/ledger/accounts")) {
      return Promise.resolve(jsonResponse(overrides.accounts ?? accounts));
    }
    return Promise.resolve(jsonResponse({}));
  });
}

/** beforeEach padrão das telas de vendor-tx (sessão admin + fetch default). */
export function resetVendorTxAuthState(makeFetch: () => Mock) {
  authState.ready = true;
  authState.isLoggedIn = true;
  authState.isAdmin = true;
  authState.isFinanceAnalyzer = false;
  authState.authFetch = makeFetch();
}
