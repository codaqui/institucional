/**
 * "Minha Empresa" (`/membros/empresa`) — gerenciamento da empresa vinculada
 * ao perfil do membro logado. Port de `src/components/MyCompanySection`
 * (Docusaurus, 1.006 linhas), decomposto em:
 *
 *  - `CompanyHeader.tsx`  — cabeçalho (avatar/nome/CNPJ) + dados cadastrais
 *    com edição inline (`CompanyInfo`/`CompanyEditForm`)
 *  - `CollaboratorsPanel.tsx` — colaboradores add/remove
 *  - `CompanyWalletPanel.tsx` — histórico da carteira + distribuir SortCoins
 *  - `SupportSummary.tsx` — chips do resumo de apoio
 *  - `types.ts` — interfaces e helpers puros (lookup, recursos, distribuição)
 *
 * Diferenças para o original: o `useAuth` do Astro já prefixa a API_URL no
 * `authFetch` (chamadas por path); a URL do comprovante usa `API_URL` de
 * `lib/config`; o guard usa `location.replace("/")` e o `useHistory` do
 * Docusaurus virou `window.location`. MUI v9: system props (fontWeight,
 * flexWrap) migradas para `sx`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import BusinessIcon from "@mui/icons-material/Business";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../../admin/ui/PageContainer";
import { useAuth } from "../../../../lib/use-auth";
import { API_URL } from "../../../../lib/config";
import type {
  Company,
  CompanyMember,
  CompanySupportSummary,
  CompanyWallet,
  CompanyWalletTransaction,
  DistributeRecipient,
} from "./types";
import {
  buildDistributions,
  fetchCompanyResources,
  resolveCompanyLookup,
} from "./types";
import { CompanyHeader, CompanyEditForm, CompanyInfo } from "./CompanyHeader";
import CollaboratorsPanel from "./CollaboratorsPanel";
import { DistributePanel, WalletTransactions } from "./CompanyWalletPanel";

interface Props {
  /** Se fornecido, carrega a empresa desse ID diretamente (modo colaborador). Se omitido, busca via /companies/me. */
  companyId?: string;
}

function useMyCompanySection({ companyId }: Props) {
  const { authFetch, isLoggedIn, ready, user } = useAuth();

  const [company, setCompany] = useState<Company | null>(null);
  const [wallet, setWallet] = useState<CompanyWallet | null>(null);
  const [supportSummary, setSupportSummary] = useState<CompanySupportSummary>({
    totalSupportedReais: 0, supportCount: 0, monthsSupporting: 0,
  });
  const [transactions, setTransactions] = useState<CompanyWalletTransaction[]>([]);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsLimit] = useState(20);
  const [txLoading, setTxLoading] = useState(false);
  const [collaborators, setCollaborators] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editTradeName, setEditTradeName] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [addHandle, setAddHandle] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [distribMode, setDistribMode] = useState<"equal" | "custom">("equal");
  const [distribTotal, setDistribTotal] = useState("");
  const [distribCustom, setDistribCustom] = useState<Record<string, string>>({});
  const [distributing, setDistributing] = useState(false);
  const [distribError, setDistribError] = useState<string | null>(null);
  const [distribSuccess, setDistribSuccess] = useState<string | null>(null);

  const distribRecipients = useMemo<DistributeRecipient[]>(() => {
    const ownerHandle = user?.handle ?? null;
    const isOwnerCurrent = company?.responsibleMemberId === user?.sub;
    return [
      ...(isOwnerCurrent && ownerHandle
        ? [{ id: "__owner__", memberId: ownerHandle, addedAt: "", isOwner: true }]
        : []),
      ...collaborators.map((c) => ({ ...c, isOwner: false })),
    ];
  }, [company, collaborators, user]);

  const load = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    setError(null);
    setTxLoading(true);
    try {
      const lookup = await resolveCompanyLookup(authFetch, companyId);
      const companyData = lookup.companyData;
      if (lookup.errorMessage) setError(lookup.errorMessage);

      if (!companyData) {
        return;
      }

      setCompany(companyData);
      const resources = await fetchCompanyResources(
        authFetch, companyData.id, transactionsPage, transactionsLimit,
      );
      setWallet(resources.wallet);
      setCollaborators(resources.collaborators);
      setSupportSummary(resources.supportSummary);
      setTransactions(resources.transactions);
      setTransactionsTotal(resources.transactionsTotal);
    } catch {
      setError("Erro de conexão.");
      setTransactions([]);
      setTransactionsTotal(0);
      setWallet(null);
      setCollaborators([]);
      setSupportSummary({ totalSupportedReais: 0, supportCount: 0, monthsSupporting: 0 });
    } finally {
      setTxLoading(false);
      setLoading(false);
    }
  }, [authFetch, isLoggedIn, companyId, transactionsPage, transactionsLimit]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = useCallback(() => {
    if (!company) return;
    setEditName(company.name);
    setEditTradeName(company.tradeName ?? "");
    setEditLogo(company.logoUrl ?? "");
    setEditWebsite(company.websiteUrl ?? "");
    setSaveError(null);
    setEditing(true);
  }, [company]);

  const saveEdit = useCallback(async () => {
    if (!company) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch(`/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName || undefined,
          tradeName: editTradeName || undefined,
          logoUrl: editLogo || undefined,
          websiteUrl: editWebsite || undefined,
        }),
      });
      if (res.ok) {
        setCompany((await res.json()) as Company);
        setEditing(false);
      } else {
        const data = (await res.json()) as { message?: string };
        setSaveError(data.message ?? "Erro ao salvar.");
      }
    } catch {
      setSaveError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }, [company, authFetch, editName, editTradeName, editLogo, editWebsite]);

  const addCollaborator = useCallback(async () => {
    if (!company || !addHandle.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await authFetch(`/companies/${company.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ githubHandle: addHandle.trim() }),
      });
      if (res.ok) {
        setAddHandle("");
        await load();
      } else {
        const data = (await res.json()) as { message?: string };
        setAddError(data.message ?? "Erro ao adicionar colaborador.");
      }
    } catch {
      setAddError("Erro de conexão.");
    } finally {
      setAdding(false);
    }
  }, [company, addHandle, authFetch, load]);

  const removeCollaborator = useCallback(async (memberId: string) => {
    if (!company) return;
    try {
      await authFetch(`/companies/${company.id}/members/${memberId}`, { method: "DELETE" });
      await load();
    } catch {
      // silencia — recarrega de qualquer forma
    }
  }, [company, authFetch, load]);

  const distributeCoins = useCallback(async () => {
    if (!company || distribRecipients.length === 0) return;
    setDistributing(true);
    setDistribError(null);
    setDistribSuccess(null);
    try {
      const distributionResult = buildDistributions(distribMode, distribTotal, distribCustom, distribRecipients);
      if (distributionResult.error) {
        setDistribError(distributionResult.error);
        return;
      }
      const res = await authFetch(`/companies/${company.id}/wallet/distribute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distributions: distributionResult.distributions }),
      });
      if (res.ok) {
        const data = (await res.json()) as { distributed: number; recipients: number };
        setDistribSuccess(`${data.distributed} SortCoins distribuídos para ${data.recipients} colaborador(es)!`);
        setDistribTotal("");
        setDistribCustom({});
        await load();
      } else {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setDistribError(body.message ?? "Erro ao distribuir.");
      }
    } catch {
      setDistribError("Erro de conexão.");
    } finally {
      setDistributing(false);
    }
  }, [company, distribRecipients, distribMode, distribTotal, distribCustom, authFetch, load]);

  const isOwner = company?.responsibleMemberId === user?.sub;
  const isActive = company?.status === "active";
  const sortCoins = wallet?.balances?.["sort_coin"] ?? 0;

  return {
    ready,
    isLoggedIn,
    user,
    company,
    wallet,
    supportSummary,
    transactions,
    transactionsTotal,
    transactionsPage,
    transactionsLimit,
    txLoading,
    collaborators,
    loading,
    error,
    editing,
    editName,
    editTradeName,
    editLogo,
    editWebsite,
    saving,
    saveError,
    addHandle,
    addError,
    adding,
    distribMode,
    distribTotal,
    distribCustom,
    distributing,
    distribError,
    distribSuccess,
    distribRecipients,
    setTransactionsPage,
    setEditing,
    setEditName,
    setEditTradeName,
    setEditLogo,
    setEditWebsite,
    setAddHandle,
    setDistribMode,
    setDistribTotal,
    setDistribCustom,
    startEdit,
    saveEdit,
    addCollaborator,
    removeCollaborator,
    distributeCoins,
    isOwner,
    isActive,
    sortCoins,
    load,
  };
}

function MyCompanyInner({ companyId }: Readonly<Props>): React.JSX.Element | null {
  const {
    ready, isLoggedIn, company, loading, error,
    supportSummary, editing, editName, setEditName,
    editTradeName, setEditTradeName, editLogo, setEditLogo,
    editWebsite, setEditWebsite, saveError, saving, startEdit, saveEdit, setEditing,
    addHandle, setAddHandle, addError, adding, addCollaborator,
    collaborators, removeCollaborator,
    transactions, transactionsTotal, transactionsPage, transactionsLimit, txLoading, setTransactionsPage,
    distribMode, setDistribMode, distribTotal, setDistribTotal, distribCustom, setDistribCustom,
    distribError, distribSuccess, distributing, distributeCoins, distribRecipients,
    isOwner, isActive, sortCoins,
  } = useMyCompanySection({ companyId });

  useEffect(() => {
    if (ready && !isLoggedIn) {
      window.location.replace("/");
    }
  }, [ready, isLoggedIn]);

  if (!ready || loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!isLoggedIn) return null;

  if (!company) {
    if (error) {
      return <Alert severity="error">{error}</Alert>;
    }
    return (
      <Alert severity="info">
        Nenhuma empresa vinculada ao seu perfil no momento. Se você acabou de ser adicionado como colaborador, atualize a página.
      </Alert>
    );
  }

  return (
    <PageContainer sx={{ maxWidth: "md" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 4 }}>
        <BusinessIcon sx={{ fontSize: 36, color: "success.main" }} />
        <Box>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>
            Minha Empresa
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Gerencie a empresa vinculada ao seu perfil, colaboradores e carteira CLUB Business.
          </Typography>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!isActive && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Empresa <strong>{company.status === "pending" ? "aguardando ativação" : company.status}</strong> pelo administrador. Edições e distribuição de SortCoins estarão disponíveis após a ativação.
        </Alert>
      )}

      <CompanyHeader company={company} sortCoins={sortCoins} />
      <Divider sx={{ mb: 2 }} />

      {editing ? (
        <CompanyEditForm
          editName={editName} setEditName={setEditName}
          editTradeName={editTradeName} setEditTradeName={setEditTradeName}
          editLogo={editLogo} setEditLogo={setEditLogo}
          editWebsite={editWebsite} setEditWebsite={setEditWebsite}
          saveError={saveError} saving={saving}
          onSave={saveEdit} onCancel={() => setEditing(false)}
        />
      ) : (
        <CompanyInfo
          company={company}
          supportSummary={supportSummary}
          isOwner={isOwner}
          isActive={isActive}
          receiptUrl={`${API_URL}/companies/${company.id}/receipt`}
          onEdit={startEdit}
        />
      )}

      <Divider sx={{ mb: 2 }} />
      <CollaboratorsPanel
        collaborators={collaborators}
        isOwner={isOwner}
        isActive={isActive}
        addHandle={addHandle}
        setAddHandle={setAddHandle}
        addError={addError}
        adding={adding}
        onAdd={addCollaborator}
        onRemove={removeCollaborator}
      />

      <Divider sx={{ my: 2 }} />
      <WalletTransactions
        transactions={transactions}
        transactionsTotal={transactionsTotal}
        transactionsPage={transactionsPage}
        transactionsLimit={transactionsLimit}
        txLoading={txLoading}
        onPageChange={setTransactionsPage}
      />

      {isOwner && isActive && distribRecipients.length > 0 && (
        <DistributePanel
          recipients={distribRecipients}
          sortCoins={sortCoins}
          distribMode={distribMode}
          setDistribMode={setDistribMode}
          distribTotal={distribTotal}
          setDistribTotal={setDistribTotal}
          distribCustom={distribCustom}
          setDistribCustom={setDistribCustom}
          distribError={distribError}
          distribSuccess={distribSuccess}
          distributing={distributing}
          onDistribute={distributeCoins}
        />
      )}
    </PageContainer>
  );
}

export default function MyCompanyApp({ companyId }: Readonly<Props> = {}): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <MyCompanyInner companyId={companyId} />
    </MuiIslandProvider>
  );
}
