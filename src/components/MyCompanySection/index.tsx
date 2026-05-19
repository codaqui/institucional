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
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
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

export default function MyCompanySection({ companyId }: Readonly<Props>) {
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
    totalSupportedReais: 0,
    supportCount: 0,
    monthsSupporting: 0,
  });
  const [transactions, setTransactions] = useState<CompanyWalletTransaction[]>([]);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsLimit] = useState(20);
  const [txLoading, setTxLoading] = useState(false);
  const [collaborators, setCollaborators] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edição inline dos dados da empresa
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLogo, setEditLogo] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Adicionar colaborador
  const [addHandle, setAddHandle] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Distribuir SortCoins
  const [distribMode, setDistribMode] = useState<"equal" | "custom">("equal");
  const [distribTotal, setDistribTotal] = useState("");
  const [distribCustom, setDistribCustom] = useState<Record<string, string>>({});
  const [distributing, setDistributing] = useState(false);
  const [distribError, setDistribError] = useState<string | null>(null);
  const [distribSuccess, setDistribSuccess] = useState<string | null>(null);

  // Lista de destinatários da distribuição: dono (★) + colaboradores
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
    try {
      let companyData: Company | null = null;

      if (companyId) {
        // carrega empresa específica (colaborador)
        const res = await authFetch(api(`/companies/${companyId}`));
        companyData = await parseJsonSafe<Company>(res);
      } else {
        // carrega empresa do responsável autenticado + fallback de colaboração
        const [ownedRes, collabRes] = await Promise.all([
          authFetch(api("/companies/me")),
          authFetch(api("/companies/my-collaborations")),
        ]);

        const owned = await parseJsonSafe<Company>(ownedRes);
        const rawCollabs = await parseJsonSafe<Company[] | { items?: Company[] }>(collabRes);
        const collabs = normalizeCompanies(rawCollabs);

        companyData = owned ?? collabs[0] ?? null;
        if (!ownedRes.ok && ownedRes.status !== 404 && !companyData) {
          setError("Erro ao carregar empresa.");
        }
      }

      if (!companyData) {
        setLoading(false);
        return;
      }

      setCompany(companyData);
      setTxLoading(true);

      const [walletRes, collabRes, supportRes, txRes] = await Promise.all([
        authFetch(api(`/companies/${companyData.id}/wallet`)),
        authFetch(api(`/companies/${companyData.id}/members`)),
        authFetch(api(`/companies/${companyData.id}/support-summary`)),
        authFetch(
          api(
            `/companies/${companyData.id}/wallet/transactions?page=${transactionsPage}&limit=${transactionsLimit}`,
          ),
        ),
      ]);

      if (walletRes.ok) setWallet((await walletRes.json()) as CompanyWallet);
      if (collabRes.ok) setCollaborators((await collabRes.json()) as CompanyMember[]);
      if (supportRes.ok) {
        setSupportSummary((await supportRes.json()) as CompanySupportSummary);
      } else {
        setSupportSummary({
          totalSupportedReais: 0,
          supportCount: 0,
          monthsSupporting: 0,
        });
      }
      if (txRes.ok) {
        const txData = (await txRes.json()) as
          | CompanyTransactionsResponse
          | CompanyWalletTransaction[];
        if (Array.isArray(txData)) {
          setTransactions(txData);
          setTransactionsTotal(txData.length);
        } else {
          setTransactions(Array.isArray(txData.items) ? txData.items : []);
          setTransactionsTotal(txData.total ?? 0);
        }
      } else {
        setTransactions([]);
        setTransactionsTotal(0);
      }
    } catch {
      setError("Erro de conexão.");
      setTransactions([]);
      setTransactionsTotal(0);
    }
    setTxLoading(false);
    setLoading(false);
  }, [authFetch, isLoggedIn, companyId, api, transactionsPage, transactionsLimit]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = () => {
    if (!company) return;
    setEditName(company.name);
    setEditLogo(company.logoUrl ?? "");
    setEditWebsite(company.websiteUrl ?? "");
    setSaveError(null);
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!company) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch(api(`/companies/${company.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName || undefined,
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
    }
    setSaving(false);
  };

  const addCollaborator = async () => {
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
    }
    setAdding(false);
  };

  const removeCollaborator = async (memberId: string) => {
    if (!company) return;
    try {
      await authFetch(api(`/companies/${company.id}/members/${memberId}`), {
        method: "DELETE",
      });
      await load();
    } catch {
      // silencia — recarrega de qualquer forma
    }
  };

  const distributeCoins = async () => {
    if (!company || distribRecipients.length === 0) return;
    setDistributing(true);
    setDistribError(null);
    setDistribSuccess(null);
    try {
      let distributions: { githubHandle: string; amount: number }[];
      if (distribMode === "equal") {
        const total = Number.parseInt(distribTotal, 10);
        if (Number.isNaN(total) || total <= 0) {
          setDistribError("Informe um valor total positivo.");
          return;
        }
        const perPerson = Math.floor(total / distribRecipients.length);
        if (perPerson <= 0) {
          setDistribError("Valor por pessoa seria 0. Aumente o total.");
          return;
        }
        distributions = distribRecipients.map((r) => ({ githubHandle: r.memberId, amount: perPerson }));
      } else {
        distributions = distribRecipients
          .map((r) => ({ githubHandle: r.memberId, amount: Number.parseInt(distribCustom[r.id] ?? "0", 10) }))
          .filter((d) => d.amount > 0);
        if (distributions.length === 0) {
          setDistribError("Informe pelo menos um valor positivo.");
          return;
        }
      }
      const res = await authFetch(api(`/companies/${company.id}/wallet/distribute`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distributions }),
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
  };

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

  const isOwner = company.responsibleMemberId === user?.sub;
  const isActive = company.status === "active";
  const sortCoins = wallet?.balances?.["sort_coin"] ?? 0;
  const hasConfiguredRecurring = isActive && (company.subscriptionAmountCents ?? 0) > 0;
  const equalDistributionHint =
    distribTotal && !Number.isNaN(Number.parseInt(distribTotal, 10)) && distribRecipients.length > 0
      ? `≈ ${Math.floor(Number.parseInt(distribTotal, 10) / distribRecipients.length)} por pessoa`
      : undefined;

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!isActive && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Empresa <strong>{company.status === "pending" ? "aguardando ativação" : company.status}</strong> pelo administrador. Edições e distribuição de SortCoins estarão disponíveis após a ativação.
        </Alert>
      )}

      {/* ── Cabeçalho da empresa ── */}
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

      <Divider sx={{ mb: 2 }} />

      {/* ── Edição dos dados ── */}
      {editing ? (
        <Stack spacing={2} sx={{ mb: 3 }}>
          <TextField
            label="Nome da empresa"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="URL do logotipo"
            value={editLogo}
            onChange={(e) => setEditLogo(e.target.value)}
            size="small"
            fullWidth
          />
          <TextField
            label="Website"
            value={editWebsite}
            onChange={(e) => setEditWebsite(e.target.value)}
            size="small"
            fullWidth
          />
          {saveError && <Alert severity="error">{saveError}</Alert>}
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
              onClick={saveEdit}
              disabled={saving}
            >
              Salvar
            </Button>
            <Button size="small" onClick={() => setEditing(false)} disabled={saving}>
              Cancelar
            </Button>
          </Box>
        </Stack>
      ) : (
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
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} useFlexGap flexWrap="wrap">
          <Chip
            size="small"
            variant="outlined"
            label={`R$ ${supportSummary.totalSupportedReais.toLocaleString("pt-BR")} apoiados`}
          />
          <Chip
            size="small"
            variant="outlined"
            label={`${supportSummary.supportCount} apoio${supportSummary.supportCount === 1 ? "" : "s"}`}
          />
          <Chip
            size="small"
            variant="outlined"
            label={`${supportSummary.monthsSupporting} mês${supportSummary.monthsSupporting === 1 ? "" : "es"} apoiando`}
          />
        </Stack>
        <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={startEdit}
            sx={{ mt: 1, alignSelf: "flex-start", textTransform: "none" }}
            disabled={!isOwner || !isActive}
          >
            Editar dados
          </Button>
        </Box>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* ── Colaboradores ── */}
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        Colaboradores
      </Typography>
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
                <IconButton
                  size="small"
                  onClick={() => removeCollaborator(c.id)}
                  aria-label="remover colaborador"
                >
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

      {/* Adicionar colaborador — somente responsável ativo */}
      {isOwner && isActive && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <TextField
            label="GitHub handle do colaborador"
            value={addHandle}
            onChange={(e) => setAddHandle(e.target.value)}
            size="small"
            placeholder="ex: octocat"
            sx={{ flexGrow: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") addCollaborator();
            }}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={adding ? <CircularProgress size={14} /> : <PersonAddIcon />}
            onClick={addCollaborator}
            disabled={adding || !addHandle.trim()}
            sx={{ whiteSpace: "nowrap", mt: 0.5 }}
          >
            Adicionar
          </Button>
        </Box>
      )}
      {addError && <Alert severity="error" sx={{ mt: 1 }}>{addError}</Alert>}

      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>
        Histórico da carteira da empresa
      </Typography>
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
            onChange={(_, value) => setTransactionsPage(value)}
            color="primary"
            size="small"
          />
        </Box>
      )}

      {/* ── Distribuir SortCoins — somente responsável ativo ── */}
      {isOwner && isActive && distribRecipients.length > 0 && (
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
                label={`Total a dividir (${distribRecipients.length} pessoa(s))`}
                value={distribTotal}
                onChange={(e) => setDistribTotal(e.target.value)}
                size="small"
                type="number"
                placeholder="ex: 100"
                helperText={
                  equalDistributionHint
                }
                sx={{ flexGrow: 1 }}
              />
              <Button
                variant="contained"
                size="small"
                startIcon={distributing ? <CircularProgress size={14} /> : <SendIcon />}
                onClick={distributeCoins}
                disabled={distributing || !distribTotal.trim() || sortCoins === 0}
                sx={{ whiteSpace: "nowrap", mt: 0.5 }}
              >
                Distribuir
              </Button>
            </Box>
          ) : (
            <Stack spacing={1}>
              {distribRecipients.map((r) => (
                <Box key={r.id} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                  <Typography variant="body2" sx={{ minWidth: 120 }}>
                    {r.isOwner ? "★ " : ""}@{r.memberId}
                  </Typography>
                  <TextField
                    size="small"
                    type="number"
                    placeholder="coins"
                    value={distribCustom[r.id] ?? ""}
                    onChange={(e) => setDistribCustom((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    sx={{ width: 100 }}
                  />
                </Box>
              ))}
              <Button
                variant="contained"
                size="small"
                startIcon={distributing ? <CircularProgress size={14} /> : <SendIcon />}
                onClick={distributeCoins}
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
      )}
    </Box>
  );
}

function formatCnpj(cnpj: string): string {
  if (cnpj.length !== 14) return cnpj;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}
