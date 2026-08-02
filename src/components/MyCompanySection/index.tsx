/**
 * MyCompanySection — gerenciamento da empresa do usuário logado.
 *
 * Mostra:
 *  - Dados da empresa (nome, CNPJ, logo, website) com edição inline
 *  - Lista de colaboradores + botão para adicionar/remover
 *  - Saldo da carteira (somente leitura para colaboradores)
 *
 * Reusável em:
 *  - /participe/apoiar (após cadastro PJ)
 *  - /patrocinadores
 *  - /membros/:handle (perfil)
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Pagination from "@mui/material/Pagination";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import TokenIcon from "@mui/icons-material/Token";
import SendIcon from "@mui/icons-material/Send";
import BusinessIcon from "@mui/icons-material/Business";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import SaveIcon from "@mui/icons-material/Save";
import { useAuth } from "../../hooks/useAuth";
import { resolveApiUrl } from "../../lib/api-url";

interface Company {
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

interface CompanyMember {
  id: string;
  memberId: string;
  addedAt: string;
}

interface CompanyWallet {
  id: string;
  balances: Record<string, number>;
  frozenTypes: string[];
}

interface CompanySupportSummary {
  totalSupportedReais: number;
  supportCount: number;
  monthsSupporting: number;
}

interface CompanyWalletTransaction {
  id: string;
  coinType: string;
  amount: number;
  source: string;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

interface CompanyTransactionsResponse {
  items: CompanyWalletTransaction[];
  total: number;
  page: number;
  limit: number;
}

interface Props {
  /** Se fornecido, carrega a empresa desse ID diretamente (modo colaborador). Se omitido, busca via /companies/me. */
  companyId?: string;
}

interface CompanyLookupResult {
  companyData: Company | null;
  errorMessage: string | null;
}

interface CompanyResourcesResult {
  wallet: CompanyWallet | null;
  collaborators: CompanyMember[];
  supportSummary: CompanySupportSummary;
  transactions: CompanyWalletTransaction[];
  transactionsTotal: number;
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function normalizeCompanies(rawCollabs: Company[] | { items?: Company[] } | null): Company[] {
  if (Array.isArray(rawCollabs)) return rawCollabs;
  if (Array.isArray(rawCollabs?.items)) return rawCollabs.items;
  return [];
}

function normalizeTransactionsData(
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

async function resolveCompanyLookup(
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
  api: (path: string) => string,
  companyId?: string,
): Promise<CompanyLookupResult> {
  if (companyId) {
    const companyRes = await authFetch(api(`/companies/${companyId}`));
    return { companyData: await parseJsonSafe<Company>(companyRes), errorMessage: null };
  }

  const [ownedRes, collabRes] = await Promise.all([
    authFetch(api("/companies/me")),
    authFetch(api("/companies/my-collaborations")),
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

async function fetchCompanyResources(
  authFetch: (input: string, init?: RequestInit) => Promise<Response>,
  api: (path: string) => string,
  companyId: string,
  transactionsPage: number,
  transactionsLimit: number,
): Promise<CompanyResourcesResult> {
  const [walletRes, collabRes, supportRes, txRes] = await Promise.all([
    authFetch(api(`/companies/${companyId}/wallet`)),
    authFetch(api(`/companies/${companyId}/members`)),
    authFetch(api(`/companies/${companyId}/support-summary`)),
    authFetch(api(`/companies/${companyId}/wallet/transactions?page=${transactionsPage}&limit=${transactionsLimit}`)),
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

function buildDistributions(
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

function formatCnpj(cnpj: string): string {
  if (cnpj.length !== 14) return cnpj;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

interface CompanyHeaderProps {
  readonly company: Company;
  readonly sortCoins: number;
}

function CompanyHeader({ company, sortCoins }: CompanyHeaderProps): React.JSX.Element {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
      {company.logoUrl ? (
        <Avatar src={company.logoUrl} alt={company.name} sx={{ width: 48, height: 48 }} />
      ) : (
        <Avatar sx={{ width: 48, height: 48, bgcolor: "primary.main" }}>
          <BusinessIcon />
        </Avatar>
      )}
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h6" fontWeight={700}>{company.name}</Typography>
        {company.tradeName && (
          <Typography variant="body2" color="text.secondary">
            {company.tradeName}
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          CNPJ: {formatCnpj(company.cnpj)} · Status: {company.status}
        </Typography>
      </Box>
      <Chip
        label={`${sortCoins} SortCoins`}
        color="primary"
        size="small"
        sx={{ fontWeight: 700 }}
      />
    </Box>
  );
}

interface CompanyEditFormProps {
  readonly editName: string;
  readonly setEditName: (value: string) => void;
  readonly editTradeName: string;
  readonly setEditTradeName: (value: string) => void;
  readonly editLogo: string;
  readonly setEditLogo: (value: string) => void;
  readonly editWebsite: string;
  readonly setEditWebsite: (value: string) => void;
  readonly saveError: string | null;
  readonly saving: boolean;
  readonly onSave: () => void;
  readonly onCancel: () => void;
}

function CompanyEditForm({
  editName, setEditName,
  editTradeName, setEditTradeName,
  editLogo, setEditLogo,
  editWebsite, setEditWebsite,
  saveError, saving,
  onSave, onCancel,
}: CompanyEditFormProps): React.JSX.Element {
  return (
    <Stack spacing={2} sx={{ mb: 3 }}>
      <TextField label="Nome da empresa" value={editName} onChange={(e) => setEditName(e.target.value)} size="small" fullWidth />
      <TextField label="Nome fantasia" value={editTradeName} onChange={(e) => setEditTradeName(e.target.value)} size="small" fullWidth />
      <TextField label="URL do logotipo" value={editLogo} onChange={(e) => setEditLogo(e.target.value)} size="small" fullWidth />
      <TextField label="Website" value={editWebsite} onChange={(e) => setEditWebsite(e.target.value)} size="small" fullWidth />
      {saveError && <Alert severity="error">{saveError}</Alert>}
      <Box sx={{ display: "flex", gap: 1 }}>
        <Button variant="contained" size="small" startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />} onClick={onSave} disabled={saving}>
          Salvar
        </Button>
        <Button size="small" onClick={onCancel} disabled={saving}>Cancelar</Button>
      </Box>
    </Stack>
  );
}

interface CompanyInfoProps {
  readonly company: Company;
  readonly supportSummary: CompanySupportSummary;
  readonly isOwner: boolean;
  readonly isActive: boolean;
  readonly api: (path: string) => string;
  readonly onEdit: () => void;
}

function CompanyInfo({ company, supportSummary, isOwner, isActive, api, onEdit }: CompanyInfoProps): React.JSX.Element {
  const hasConfiguredRecurring = isActive && (company.subscriptionAmountCents ?? 0) > 0;
  return (
    <Box sx={{ mb: 3, display: "flex", flexDirection: "column", gap: 0.5 }}>
      {company.websiteUrl && (
        <Typography variant="body2">
          🌐{" "}
          <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer">
            {company.websiteUrl}
          </a>
        </Typography>
      )}
      {hasConfiguredRecurring ? (
        <Typography variant="body2" color="text.secondary">
          Recorrência configurada: R$ {(company.subscriptionAmountCents / 100).toFixed(0)}/mês
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Recorrência configurada: inativa
        </Typography>
      )}
      <Button
        size="small"
        variant="text"
        href={api(`/companies/${company.id}/receipt`)}
        target="_blank"
        rel="noopener noreferrer"
        sx={{ alignSelf: "flex-start", textTransform: "none", mt: 0.5 }}
      >
        Baixar comprovante de doação
      </Button>
      <Stack direction="row" spacing={1} sx={{ mt: 1 }} useFlexGap flexWrap="wrap">
        <Chip size="small" variant="outlined" label={`R$ ${supportSummary.totalSupportedReais.toLocaleString("pt-BR")} apoiados`} />
        <Chip size="small" variant="outlined" label={`${supportSummary.supportCount} apoio${supportSummary.supportCount === 1 ? "" : "s"}`} />
        <Chip size="small" variant="outlined" label={`${supportSummary.monthsSupporting} mês${supportSummary.monthsSupporting === 1 ? "" : "es"} apoiando`} />
      </Stack>
      <Button
        size="small"
        variant="outlined"
        startIcon={<EditIcon />}
        onClick={onEdit}
        sx={{ mt: 1, alignSelf: "flex-start", textTransform: "none" }}
        disabled={!isOwner || !isActive}
      >
        Editar dados
      </Button>
    </Box>
  );
}

interface CollaboratorsSectionProps {
  readonly company: Company;
  readonly collaborators: CompanyMember[];
  readonly isOwner: boolean;
  readonly isActive: boolean;
  readonly addHandle: string;
  readonly setAddHandle: (value: string) => void;
  readonly addError: string | null;
  readonly adding: boolean;
  readonly onAdd: () => void;
  readonly onRemove: (id: string) => void;
}

function CollaboratorsSection({
  company, collaborators, isOwner, isActive,
  addHandle, setAddHandle, addError, adding, onAdd, onRemove,
}: CollaboratorsSectionProps): React.JSX.Element {
  return (
    <>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>Colaboradores</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
        Colaboradores podem ver o saldo e o histórico de transações da empresa.
      </Typography>

      <List dense disablePadding sx={{ mb: 2 }}>
        {collaborators.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
            Nenhum colaborador adicionado.
          </Typography>
        )}
        {collaborators.map((c) => (
          <ListItem
            key={c.id}
            disablePadding
            sx={{ py: 0.5 }}
            secondaryAction={
              isOwner ? (
                <IconButton size="small" onClick={() => onRemove(c.id)} aria-label="remover colaborador">
                  <DeleteIcon fontSize="small" />
                </IconButton>
              ) : undefined
            }
          >
            <ListItemAvatar>
              <Avatar
                src={`https://avatars.githubusercontent.com/${c.memberId}?size=32`}
                alt={c.memberId}
                sx={{ width: 32, height: 32 }}
              />
            </ListItemAvatar>
            <ListItemText
              primary={`@${c.memberId}`}
              secondary={`Desde ${new Date(c.addedAt).toLocaleDateString("pt-BR")}`}
            />
          </ListItem>
        ))}
      </List>

      {isOwner && isActive && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <TextField
            label="GitHub handle do colaborador"
            value={addHandle}
            onChange={(e) => setAddHandle(e.target.value)}
            size="small"
            placeholder="ex: octocat"
            sx={{ flexGrow: 1 }}
            onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={adding ? <CircularProgress size={14} /> : <PersonAddIcon />}
            onClick={onAdd}
            disabled={adding || !addHandle.trim()}
            sx={{ whiteSpace: "nowrap", mt: 0.5 }}
          >
            Adicionar
          </Button>
        </Box>
      )}
      {addError && <Alert severity="error" sx={{ mt: 1 }}>{addError}</Alert>}
    </>
  );
}

interface TransactionsSectionProps {
  readonly transactions: CompanyWalletTransaction[];
  readonly transactionsTotal: number;
  readonly transactionsPage: number;
  readonly transactionsLimit: number;
  readonly txLoading: boolean;
  readonly onPageChange: (page: number) => void;
}

function TransactionsSection({
  transactions, transactionsTotal, transactionsPage, transactionsLimit, txLoading, onPageChange,
}: TransactionsSectionProps): React.JSX.Element {
  return (
    <>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>Histórico da carteira da empresa</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
        Últimas 20 movimentações de SortCoins da conta empresarial.
      </Typography>
      {txLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <>
          {transactions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
              Nenhuma transação registrada até o momento.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {transactions.map((tx) => (
                <Card key={tx.id} variant="outlined">
                  <CardContent sx={{ py: "10px !important" }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {tx.description ?? "Movimentação de carteira"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {tx.source} · {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        color={tx.amount >= 0 ? "success" : "warning"}
                        variant="outlined"
                        label={`${tx.amount >= 0 ? "+" : ""}${tx.amount} ${tx.coinType}`}
                      />
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}
      {transactionsTotal > transactionsLimit && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
          <Pagination
            page={transactionsPage}
            count={Math.max(1, Math.ceil(transactionsTotal / transactionsLimit))}
            onChange={(_, value) => onPageChange(value)}
            color="primary"
            size="small"
          />
        </Box>
      )}
    </>
  );
}

interface DistributeSectionProps {
  readonly recipients: Array<{ id: string; memberId: string; isOwner?: boolean }>;
  readonly sortCoins: number;
  readonly distribMode: "equal" | "custom";
  readonly setDistribMode: (mode: "equal" | "custom") => void;
  readonly distribTotal: string;
  readonly setDistribTotal: (value: string) => void;
  readonly distribCustom: Record<string, string>;
  readonly setDistribCustom: (value: Record<string, string>) => void;
  readonly distribError: string | null;
  readonly distribSuccess: string | null;
  readonly distributing: boolean;
  readonly onDistribute: () => void;
}

function DistributeSection({
  recipients, sortCoins,
  distribMode, setDistribMode,
  distribTotal, setDistribTotal,
  distribCustom, setDistribCustom,
  distribError, distribSuccess,
  distributing, onDistribute,
}: DistributeSectionProps): React.JSX.Element {
  const equalHint = useMemo(() => {
    if (!distribTotal || Number.isNaN(Number.parseInt(distribTotal, 10)) || recipients.length === 0) return undefined;
    return `≈ ${Math.floor(Number.parseInt(distribTotal, 10) / recipients.length)} por pessoa`;
  }, [distribTotal, recipients.length]);

  return (
    <>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" fontWeight={700} gutterBottom sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <TokenIcon fontSize="small" color="primary" /> Distribuir SortCoins
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: "block" }}>
        Transfere SortCoins da carteira da empresa para as carteiras pessoais. O dono (você) aparece com ★.
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <Chip
          label="Dividir igualmente"
          size="small"
          color={distribMode === "equal" ? "primary" : "default"}
          variant={distribMode === "equal" ? "filled" : "outlined"}
          onClick={() => setDistribMode("equal")}
          clickable
        />
        <Chip
          label="Valor personalizado"
          size="small"
          color={distribMode === "custom" ? "primary" : "default"}
          variant={distribMode === "custom" ? "filled" : "outlined"}
          onClick={() => setDistribMode("custom")}
          clickable
        />
      </Stack>
      {distribMode === "equal" ? (
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <TextField
            label={`Total a dividir (${recipients.length} pessoa(s))`}
            value={distribTotal}
            onChange={(e) => setDistribTotal(e.target.value)}
            size="small"
            type="number"
            placeholder="ex: 100"
            helperText={equalHint}
            sx={{ flexGrow: 1 }}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={distributing ? <CircularProgress size={14} /> : <SendIcon />}
            onClick={onDistribute}
            disabled={distributing || !distribTotal.trim() || sortCoins === 0}
            sx={{ whiteSpace: "nowrap", mt: 0.5 }}
          >
            Distribuir
          </Button>
        </Box>
      ) : (
        <Stack spacing={1}>
          {recipients.map((r) => (
            <Box key={r.id} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Typography variant="body2" sx={{ minWidth: 120 }}>
                {r.isOwner ? "★ " : ""}@{r.memberId}
              </Typography>
              <TextField
                size="small"
                type="number"
                placeholder="coins"
                value={distribCustom[r.id] ?? ""}
                onChange={(e) => setDistribCustom({ ...distribCustom, [r.id]: e.target.value })}
                sx={{ width: 100 }}
              />
            </Box>
          ))}
          <Button
            variant="contained"
            size="small"
            startIcon={distributing ? <CircularProgress size={14} /> : <SendIcon />}
            onClick={onDistribute}
            disabled={distributing || sortCoins === 0}
            sx={{ alignSelf: "flex-start" }}
          >
            Distribuir
          </Button>
        </Stack>
      )}
      {distribError && <Alert severity="error" sx={{ mt: 1 }}>{distribError}</Alert>}
      {distribSuccess && <Alert severity="success" sx={{ mt: 1 }}>{distribSuccess}</Alert>}
    </>
  );
}

// ─── Hook custom ─────────────────────────────────────────────────────────────

function useMyCompanySection({ companyId }: Props) {
  const { authFetch, isLoggedIn, ready, user } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const configuredApiUrl = (siteConfig.customFields?.apiUrl as string) ?? "";

  const api = useCallback(
    (path: string) => resolveApiUrl(configuredApiUrl, siteConfig.url) + path,
    [configuredApiUrl, siteConfig.url],
  );

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

  const distribRecipients = useMemo(() => {
    const ownerHandle = user?.handle ?? null;
    const isOwnerCurrent = company?.responsibleMemberId === user?.sub;
    return [
      ...(isOwnerCurrent && ownerHandle ? [{ id: "__owner__", memberId: ownerHandle, addedAt: "", isOwner: true }] : []),
      ...collaborators.map((c) => ({ ...c, isOwner: false })),
    ];
  }, [company, collaborators, user]);

  const load = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    setError(null);
    setTxLoading(true);
    try {
      const lookup = await resolveCompanyLookup(authFetch, api, companyId);
      const companyData = lookup.companyData;
      if (lookup.errorMessage) setError(lookup.errorMessage);

      if (!companyData) {
        return;
      }

      setCompany(companyData);
      const resources = await fetchCompanyResources(
        authFetch, api, companyData.id, transactionsPage, transactionsLimit,
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
  }, [authFetch, isLoggedIn, companyId, api, transactionsPage, transactionsLimit]);

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
      const res = await authFetch(api(`/companies/${company.id}`), {
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
  }, [company, api, authFetch, editName, editTradeName, editLogo, editWebsite]);

  const addCollaborator = useCallback(async () => {
    if (!company || !addHandle.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await authFetch(api(`/companies/${company.id}/members`), {
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
  }, [company, addHandle, api, authFetch, load]);

  const removeCollaborator = useCallback(async (memberId: string) => {
    if (!company) return;
    try {
      await authFetch(api(`/companies/${company.id}/members/${memberId}`), { method: "DELETE" });
      await load();
    } catch {
      // silencia — recarrega de qualquer forma
    }
  }, [company, api, authFetch, load]);

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
      const res = await authFetch(api(`/companies/${company.id}/wallet/distribute`), {
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
  }, [company, distribRecipients, distribMode, distribTotal, distribCustom, api, authFetch, load]);

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
    api,
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

// ─── Componente principal ────────────────────────────────────────────────────

export default function MyCompanySection({ companyId }: Readonly<Props>): React.JSX.Element {
  const {
    ready, isLoggedIn, company, loading, error,
    wallet, supportSummary, editing, editName, setEditName,
    editTradeName, setEditTradeName, editLogo, setEditLogo,
    editWebsite, setEditWebsite, saveError, saving, startEdit, saveEdit, setEditing,
    addHandle, setAddHandle, addError, adding, addCollaborator,
    collaborators, removeCollaborator,
    transactions, transactionsTotal, transactionsPage, transactionsLimit, txLoading, setTransactionsPage,
    distribMode, setDistribMode, distribTotal, setDistribTotal, distribCustom, setDistribCustom,
    distribError, distribSuccess, distributing, distributeCoins, distribRecipients,
    isOwner, isActive, sortCoins, api,
  } = useMyCompanySection({ companyId });

  if (!ready || loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!isLoggedIn) return null;

  if (!company) {
    return (
      <Alert severity="info">
        Nenhuma empresa vinculada ao seu perfil no momento. Se você acabou de ser adicionado como colaborador, atualize a página.
      </Alert>
    );
  }

  return (
    <Box>
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
          api={api}
          onEdit={startEdit}
        />
      )}

      <Divider sx={{ mb: 2 }} />
      <CollaboratorsSection
        company={company}
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
      <TransactionsSection
        transactions={transactions}
        transactionsTotal={transactionsTotal}
        transactionsPage={transactionsPage}
        transactionsLimit={transactionsLimit}
        txLoading={txLoading}
        onPageChange={setTransactionsPage}
      />

      {isOwner && isActive && distribRecipients.length > 0 && (
        <DistributeSection
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
    </Box>
  );
}
