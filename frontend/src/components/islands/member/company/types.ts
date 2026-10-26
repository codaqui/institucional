/**
 * Tipos e helpers puros do MyCompanySection (Docusaurus) — portados 1:1
 * para a ilha "Minha Empresa" (`/membros/empresa`).
 */

export interface Company {
  id: string;
  name: string;
  tradeName?: string;
  cnpj: string;
  logoUrl?: string;
  websiteUrl?: string;
  status: string;
  responsibleMemberId: string;
  subscriptionAmountCents?: number;
}

export interface CompanyMember {
  id: string;
  memberId: string;
  addedAt: string;
}

export interface CompanyWallet {
  id: string;
  balances: Record<string, number>;
  frozenTypes: string[];
}

export interface CompanySupportSummary {
  totalSupportedReais: number;
  supportCount: number;
  monthsSupporting: number;
}

export interface CompanyWalletTransaction {
  id: string;
  coinType: string;
  amount: number;
  source: string;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

export interface CompanyTransactionsResponse {
  items: CompanyWalletTransaction[];
  total: number;
  page: number;
  limit: number;
}

export interface CompanyLookupResult {
  companyData: Company | null;
  errorMessage: string | null;
}

export interface CompanyResourcesResult {
  wallet: CompanyWallet | null;
  collaborators: CompanyMember[];
  supportSummary: CompanySupportSummary;
  transactions: CompanyWalletTransaction[];
  transactionsTotal: number;
}

/** Destinatário da distribuição de SortCoins (dono + colaboradores). */
export interface DistributeRecipient {
  id: string;
  memberId: string;
  addedAt?: string;
  isOwner?: boolean;
}

export async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function normalizeCompanies(
  rawCollabs: Company[] | { items?: Company[] } | null,
): Company[] {
  if (Array.isArray(rawCollabs)) return rawCollabs;
  if (Array.isArray(rawCollabs?.items)) return rawCollabs.items;
  return [];
}

export function normalizeTransactionsData(
  txData: CompanyTransactionsResponse | CompanyWalletTransaction[],
): { transactions: CompanyWalletTransaction[]; transactionsTotal: number } {
  if (Array.isArray(txData)) {
    return { transactions: txData, transactionsTotal: txData.length };
  }
  return {
    transactions: Array.isArray(txData.items) ? txData.items : [],
    transactionsTotal: txData.total ?? 0,
  };
}

export async function resolveCompanyLookup(
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
  companyId?: string,
): Promise<CompanyLookupResult> {
  if (companyId) {
    const companyRes = await authFetch(`/companies/${companyId}`);
    return { companyData: await parseJsonSafe<Company>(companyRes), errorMessage: null };
  }

  const [ownedRes, collabRes] = await Promise.all([
    authFetch("/companies/me"),
    authFetch("/companies/my-collaborations"),
  ]);

  const owned = await parseJsonSafe<Company>(ownedRes);
  const rawCollabs = await parseJsonSafe<Company[] | { items?: Company[] }>(collabRes);
  const collabs = normalizeCompanies(rawCollabs);
  const companyData = owned ?? collabs[0] ?? null;
  const errorMessage = !ownedRes.ok && ownedRes.status !== 404 && !companyData
    ? "Erro ao carregar empresa."
    : null;

  return { companyData, errorMessage };
}

export async function fetchCompanyResources(
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
  companyId: string,
  transactionsPage: number,
  transactionsLimit: number,
): Promise<CompanyResourcesResult> {
  const [walletRes, collabRes, supportRes, txRes] = await Promise.all([
    authFetch(`/companies/${companyId}/wallet`),
    authFetch(`/companies/${companyId}/members`),
    authFetch(`/companies/${companyId}/support-summary`),
    authFetch(`/companies/${companyId}/wallet/transactions?page=${transactionsPage}&limit=${transactionsLimit}`),
  ]);

  const wallet = walletRes.ok ? (await walletRes.json()) as CompanyWallet : null;
  const collaborators = collabRes.ok ? (await collabRes.json()) as CompanyMember[] : [];
  const supportSummary = supportRes.ok
    ? (await supportRes.json()) as CompanySupportSummary
    : { totalSupportedReais: 0, supportCount: 0, monthsSupporting: 0 };

  if (!txRes.ok) {
    return { wallet, collaborators, supportSummary, transactions: [], transactionsTotal: 0 };
  }

  const txData = (await txRes.json()) as CompanyTransactionsResponse | CompanyWalletTransaction[];
  const { transactions, transactionsTotal } = normalizeTransactionsData(txData);
  return { wallet, collaborators, supportSummary, transactions, transactionsTotal };
}

export function buildDistributions(
  distribMode: "equal" | "custom",
  distribTotal: string,
  distribCustom: Record<string, string>,
  recipients: Array<{ id: string; memberId: string }>,
): { distributions: { githubHandle: string; amount: number }[]; error: string | null } {
  if (distribMode === "equal") {
    const total = Number.parseInt(distribTotal, 10);
    if (Number.isNaN(total) || total <= 0) {
      return { distributions: [], error: "Informe um valor total positivo." };
    }
    const perPerson = Math.floor(total / recipients.length);
    if (perPerson <= 0) {
      return { distributions: [], error: "Valor por pessoa seria 0. Aumente o total." };
    }
    return {
      distributions: recipients.map((r) => ({ githubHandle: r.memberId, amount: perPerson })),
      error: null,
    };
  }

  const distributions = recipients
    .map((r) => ({ githubHandle: r.memberId, amount: Number.parseInt(distribCustom[r.id] ?? "0", 10) }))
    .filter((d) => d.amount > 0);

  if (distributions.length === 0) {
    return { distributions: [], error: "Informe pelo menos um valor positivo." };
  }
  return { distributions, error: null };
}

export function formatCnpj(cnpj: string): string {
  if (cnpj.length !== 14) return cnpj;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}
