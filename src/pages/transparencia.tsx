import React, { useCallback, useEffect, useState } from "react";
import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Alert from "@mui/material/Alert";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TablePagination from "@mui/material/TablePagination";
import Paper from "@mui/material/Paper";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import BalanceIcon from "@mui/icons-material/Balance";
import CloseIcon from "@mui/icons-material/Close";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import CodeIcon from "@mui/icons-material/Code";
import Link from "@docusaurus/Link";
import { communities } from "../data/communities";
import PageHero from "../components/PageHero";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CommunityBalance {
  id: string;
  projectKey: string;
  name: string;
  balance: number;
}

interface TransactionAccount {
  id: string;
  name: string;
}

interface Transaction {
  id: string;
  amount: number;
  description: string;
  createdAt: string;
  referenceId?: string;
  sourceAccount: TransactionAccount;
  destinationAccount: TransactionAccount;
}

interface PaginatedTransactions {
  data: Transaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// ---------------------------------------------------------------------------
// Transaction type detection
// ---------------------------------------------------------------------------
type TxType = "donation" | "reimbursement" | "transfer" | "other";

function detectTxType(tx: Transaction): TxType {
  if (tx.referenceId?.startsWith("reimbursement:")) return "reimbursement";
  if (tx.referenceId?.startsWith("transfer:")) return "transfer";
  if (tx.referenceId?.startsWith("cs_")) return "donation";
  if (tx.description?.toLowerCase().startsWith("doação")) return "donation";
  if (tx.description?.toLowerCase().startsWith("reembolso")) return "reimbursement";
  if (tx.description?.toLowerCase().startsWith("transfer")) return "transfer";
  return "other";
}

const TX_TYPE_CONFIG: Record<TxType, { label: string; color: "success" | "warning" | "info" | "default"; icon: React.ReactElement }> = {
  donation: { label: "Doação", color: "success", icon: <VolunteerActivismIcon fontSize="small" /> },
  reimbursement: { label: "Reembolso", color: "warning", icon: <ReceiptLongIcon fontSize="small" /> },
  transfer: { label: "Transferência Interna", color: "info", icon: <CompareArrowsIcon fontSize="small" /> },
  other: { label: "Movimentação", color: "default", icon: <InfoOutlinedIcon fontSize="small" /> },
};

const extractDonorHandle = (description: string) => {
  const match = /Doação de (@[\w.-]+)/.exec(description);
  return match?.[1] || null;
};

function extractReimbursementDesc(description: string): string {
  return description.replace(/^Reembolso aprovado:\s*/i, "").trim();
}

// ---------------------------------------------------------------------------
// Transaction Detail Dialog
// ---------------------------------------------------------------------------
interface ReimbursementPublicInfo {
  id: string;
  status: string;
  amount: number;
  description: string;
  receiptUrl: string;
  accountName: string | null;
  requester: { handle: string; name: string; avatarUrl: string } | null;
  approver: { handle: string; name: string; avatarUrl: string } | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

function TransactionDetailDialog({
  tx,
  accountId,
  apiUrl,
  onClose,
}: Readonly<{
  tx: Transaction | null;
  accountId: string;
  apiUrl: string;
  onClose: () => void;
}>) {
  const [reimbInfo, setReimbInfo] = useState<ReimbursementPublicInfo | null>(null);
  const [reimbLoading, setReimbLoading] = useState(false);

  const type = tx ? detectTxType(tx) : "other";
  const config = TX_TYPE_CONFIG[type];

  useEffect(() => {
    if (!tx) { setReimbInfo(null); return; }
    if (type !== "reimbursement") { setReimbInfo(null); return; }

    const reimbId = tx.referenceId?.replace("reimbursement:", "");
    if (!reimbId) return;

    setReimbLoading(true);
    fetch(`${apiUrl}/reimbursements/public/${reimbId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setReimbInfo(data))
      .catch(() => setReimbInfo(null))
      .finally(() => setReimbLoading(false));
  }, [tx, type, apiUrl]);

  if (!tx) return null;

  const isCredit = tx.destinationAccount?.id === accountId;
  const donorHandle = type === "donation" ? extractDonorHandle(tx.description) : null;
  const isSubscription = tx.description?.toLowerCase().includes("assinatura");
  const subscriptionInterval = tx.description?.toLowerCase().includes("anual") ? "anual" : "mensal";
  const paymentIntentId = tx.referenceId?.startsWith("pi_") ? tx.referenceId : null;
  const isTestMode = tx.description?.includes("cs_test_") || tx.description?.includes("in_");
  const stripeModePath = isTestMode ? "test/" : "";
  const stripeDashboardUrl = paymentIntentId
    ? `https://dashboard.stripe.com/${stripeModePath}payments/${paymentIntentId}`
    : null;
  const reimbDesc = type === "reimbursement" ? extractReimbursementDesc(tx.description) : null;
  const isTransfer = type === "transfer";
  const transferReason = isTransfer
    ? tx.description.replace(/^Transferência interna aprovada:\s*/i, "").trim()
    : null;

  return (
    <Dialog
      open={!!tx}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: { borderTop: 3, borderColor: `${config.color}.main` },
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip icon={config.icon} label={config.label} color={config.color} size="small" variant="outlined" />
          {isSubscription && type === "donation" && (
            <Chip label={`Recorrente ${subscriptionInterval}`} size="small" color="info" variant="outlined" />
          )}
          <Typography variant="h6" fontWeight={700}>
            {isCredit ? "+" : "−"} {formatBRL(Number(tx.amount))}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Fechar">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
          <Box>
            <Typography variant="caption" color="text.disabled">Data</Typography>
            <Typography variant="body2" fontWeight={600}>{formatDate(tx.createdAt)}</Typography>
          </Box>
          <Box sx={{ textAlign: "right" }}>
            <Typography variant="caption" color="text.disabled">ID da transação</Typography>
            <Tooltip title={tx.id}>
              <Typography variant="body2" fontWeight={600} sx={{ fontFamily: "monospace", fontSize: "0.7rem", color: "text.secondary" }}>
                {tx.id.slice(0, 16)}…
              </Typography>
            </Tooltip>
          </Box>
        </Box>
        <Box sx={{
          display: "flex", alignItems: "center", gap: 1.5, mb: 2, p: 1.5,
          borderRadius: 2, bgcolor: "action.hover", flexWrap: "wrap",
        }}>
          <Box sx={{ flex: 1, minWidth: 100 }}>
            <Typography variant="caption" color="text.disabled">De</Typography>
            <Typography variant="body2" fontWeight={700}>{tx.sourceAccount?.name}</Typography>
          </Box>
          <CompareArrowsIcon sx={{ color: "text.disabled", flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 100 }}>
            <Typography variant="caption" color="text.disabled">Para</Typography>
            <Typography variant="body2" fontWeight={700} color="primary.main">{tx.destinationAccount?.name}</Typography>
          </Box>
        </Box>
        {type === "donation" && (
          <>
            {donorHandle ? (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.disabled">Doador</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                  <Avatar
                    src={`https://github.com/${donorHandle.replace("@", "")}.png?size=32`}
                    alt={donorHandle}
                    sx={{ width: 28, height: 28, fontSize: "0.75rem" }}
                  />
                  <Button
                    size="small" variant="text"
                    endIcon={<OpenInNewIcon fontSize="small" />}
                    href={`https://github.com/${donorHandle.replace("@", "")}`}
                    target="_blank" rel="noopener noreferrer"
                    sx={{ fontWeight: 700, textTransform: "none" }}
                  >
                    {donorHandle}
                  </Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.disabled">Doador</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, fontStyle: "italic", color: "text.secondary" }}>
                  Doação anônima
                </Typography>
              </Box>
            )}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.disabled">Tipo</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {isSubscription
                  ? `Assinatura recorrente (${subscriptionInterval})`
                  : "Pagamento único"}
              </Typography>
            </Box>
          </>
        )}
        {type === "reimbursement" && (
          <>
            {reimbDesc && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.disabled">Finalidade do reembolso</Typography>
                <Typography variant="body2" sx={{ mt: 0.5, fontStyle: "italic" }}>"{reimbDesc}"</Typography>
              </Box>
            )}
            {reimbLoading && (
              <Box sx={{ mb: 2 }}>
                <Skeleton height={24} width="60%" />
                <Skeleton height={20} width="40%" />
              </Box>
            )}
            {reimbInfo && (
              <>
                {reimbInfo.requester && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.disabled">Solicitado por</Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                      <Avatar
                        src={reimbInfo.requester.avatarUrl}
                        alt={reimbInfo.requester.handle}
                        sx={{ width: 28, height: 28, fontSize: "0.75rem" }}
                      />
                      <Button
                        size="small" variant="text"
                        endIcon={<OpenInNewIcon fontSize="small" />}
                        href={`https://github.com/${reimbInfo.requester.handle}`}
                        target="_blank" rel="noopener noreferrer"
                        sx={{ fontWeight: 700, textTransform: "none" }}
                      >
                        @{reimbInfo.requester.handle}
                      </Button>
                    </Box>
                  </Box>
                )}
                {reimbInfo.approver && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.disabled">Aprovado por</Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                      <Avatar
                        src={reimbInfo.approver.avatarUrl}
                        alt={reimbInfo.approver.handle}
                        sx={{ width: 28, height: 28, fontSize: "0.75rem" }}
                      />
                      <Typography variant="body2" fontWeight={600}>
                        @{reimbInfo.approver.handle}
                      </Typography>
                      {reimbInfo.reviewedAt && (
                        <Typography variant="caption" color="text.secondary">
                          em {formatDate(reimbInfo.reviewedAt)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )}
                {reimbInfo.reviewNote && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.disabled">Nota do aprovador</Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, fontStyle: "italic", color: "text.secondary" }}>
                      "{reimbInfo.reviewNote}"
                    </Typography>
                  </Box>
                )}
                {reimbInfo.receiptUrl && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.disabled">Comprovante</Typography>
                    <Box sx={{ mt: 0.5 }}>
                      <Button
                        size="small" variant="outlined" color="warning"
                        startIcon={<ReceiptLongIcon />}
                        endIcon={<OpenInNewIcon fontSize="small" />}
                        href={reimbInfo.receiptUrl}
                        target="_blank" rel="noopener noreferrer"
                        sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem" }}
                      >
                        Ver comprovante original
                      </Button>
                    </Box>
                  </Box>
                )}
              </>
            )}
          </>
        )}
        {isTransfer && transferReason && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.disabled">Justificativa da transferência</Typography>
            <Typography variant="body2" sx={{ mt: 0.5, fontStyle: "italic" }}>"{transferReason}"</Typography>
          </Box>
        )}
        {type === "other" && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.disabled">Descrição</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {tx.description}
            </Typography>
          </Box>
        )}
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          {stripeDashboardUrl && paymentIntentId && (
            <Chip
              label={`Stripe: ${paymentIntentId.slice(0, 24)}…`}
              size="small" variant="outlined" color="success"
              icon={<OpenInNewIcon />}
              component="a"
              href={stripeDashboardUrl}
              target="_blank" rel="noopener noreferrer"
              clickable
              sx={{ fontFamily: "monospace", fontSize: "0.68rem" }}
            />
          )}
          {tx.referenceId && !paymentIntentId && (
            <Tooltip title={tx.referenceId}>
              <Chip
                label={tx.referenceId.slice(0, 30) + (tx.referenceId.length > 30 ? "…" : "")}
                size="small" variant="outlined"
                sx={{ fontFamily: "monospace", fontSize: "0.68rem" }}
              />
            </Tooltip>
          )}
          {!tx.referenceId && (
            <Typography variant="caption" color="text.disabled">Sem referência externa vinculada.</Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------
function KpiCard({
  icon,
  value,
  label,
  color = "primary.main",
}: Readonly<{
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  color?: string;
}>) {
  return (
    <Card
      variant="outlined"
      sx={{
        textAlign: "center",
        p: 3,
        transition: "box-shadow 0.2s",
        "&:hover": { boxShadow: 4 },
      }}
    >
      <Box sx={{ color, mb: 1 }}>{icon}</Box>
      <Typography variant="h4" fontWeight={800} color={color} sx={{ lineHeight: 1.2 }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {label}
      </Typography>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Transaction Table (server-side pagination)
// ---------------------------------------------------------------------------
function TransactionTable({
  accountId,
  accountName,
  apiUrl,
}: Readonly<{
  accountId: string;
  accountName: string;
  apiUrl: string;
}>) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [result, setResult] = useState<PaginatedTransactions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const fetchTransactions = useCallback(
    async (p: number, limit: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${apiUrl}/ledger/accounts/${accountId}/transactions?page=${p + 1}&limit=${limit}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: PaginatedTransactions = await res.json();
        setResult(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    },
    [accountId, apiUrl]
  );

  useEffect(() => {
    fetchTransactions(page, rowsPerPage);
  }, [fetchTransactions, page, rowsPerPage]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(Number.parseInt(e.target.value, 10));
    setPage(0);
  };

  if (error) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Não foi possível carregar as transações: <strong>{error}</strong>
      </Alert>
    );
  }

  const rows = result?.data ?? [];
  const total = result?.total ?? 0;

  return (
    <Box>
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ borderRadius: 2, mt: 2 }}
      >
        <Table size="small" aria-label={`Transações de ${accountName}`}>
          <TableHead>
            <TableRow sx={{ "& th": { fontWeight: 700, whiteSpace: "nowrap" } }}>
              <TableCell sx={{ width: 40 }} />
              <TableCell>Data</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>De → Para</TableCell>
              <TableCell align="right">Valor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(() => {
              if (loading) {
                return [1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell colSpan={6}>
                      <Skeleton variant="text" width="100%" height={30} />
                    </TableCell>
                  </TableRow>
                ));
              }

              if (rows.length === 0) {
                return (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      align="center"
                      sx={{ py: 4, color: "text.secondary" }}
                    >
                      Nenhuma movimentação registrada ainda.
                    </TableCell>
                  </TableRow>
                );
              }

              return rows.map((tx) => {
                const isCredit = tx.destinationAccount.id === accountId;
                const type = detectTxType(tx);
                const typeConfig = TX_TYPE_CONFIG[type];
                return (
                  <TableRow
                    key={tx.id}
                    hover
                    onClick={() => setSelectedTx(tx)}
                    sx={{
                      "&:last-child td": { border: 0 },
                      cursor: "pointer",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <TableCell sx={{ px: 1.5 }}>
                      <Tooltip
                        title={isCredit ? "Crédito (entrada)" : "Débito (saída)"}
                      >
                        {isCredit ? (
                          <ArrowUpwardIcon
                            fontSize="small"
                            sx={{ color: "success.main", display: "block" }}
                          />
                        ) : (
                          <ArrowDownwardIcon
                            fontSize="small"
                            sx={{ color: "error.main", display: "block" }}
                          />
                        )}
                      </Tooltip>
                    </TableCell>
                    <TableCell
                      sx={{ whiteSpace: "nowrap", fontSize: "0.75rem" }}
                    >
                      {formatDate(tx.createdAt)}
                    </TableCell>
                    <TableCell sx={{ minWidth: 110 }}>
                      <Chip
                        icon={typeConfig.icon}
                        label={typeConfig.label}
                        color={typeConfig.color}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: "0.68rem" }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: "0.8rem", maxWidth: 220 }}>
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{ display: "block", maxWidth: 220 }}
                      >
                        {tx.description}
                      </Typography>
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: "0.75rem",
                        color: "text.secondary",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tx.sourceAccount?.name} → {tx.destinationAccount?.name}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        color: isCredit ? "success.main" : "error.main",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {isCredit ? "+" : "−"} {formatBRL(Number(tx.amount))}
                    </TableCell>
                  </TableRow>
                );
              });
            })()}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25, 50]}
        labelRowsPerPage="Linhas:"
        labelDisplayedRows={({ from, to, count }) => {
          const totalStr = count === -1 ? `mais de ${to}` : count;
          return `${from}–${to} de ${totalStr}`;
        }}
        sx={{ mt: 0.5 }}
      />
      <TransactionDetailDialog
        tx={selectedTx}
        accountId={accountId}
        apiUrl={apiUrl}
        onClose={() => setSelectedTx(null)}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function TransparenciaPage(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://api.localhost:8000";

  const [balances, setBalances] = useState<CommunityBalance[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    fetch(`${apiUrl}/ledger/community-balances`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: CommunityBalance[]) => setBalances(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const totalBalance = balances?.reduce((sum, b) => sum + b.balance, 0) ?? 0;

  return (
    <Layout
      title="Transparência Financeira"
      description="Acompanhe em tempo real os saldos e movimentações financeiras de cada comunidade parceira da Codaqui."
    >
      <PageHero
        eyebrow="Portal de Transparência"
        title="Finanças Abertas"
        subtitle="Toda doação é registrada em contabilidade de dupla partida e visível aqui em tempo real. Sem segredos."
      />

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>

        {/* ── KPIs ── */}
        <Grid container spacing={3} sx={{ mb: 6 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <KpiCard
              icon={<AccountBalanceWalletIcon sx={{ fontSize: 40 }} />}
              value={loading ? <Skeleton width={120} sx={{ mx: "auto" }} /> : formatBRL(totalBalance)}
              label="Saldo total em carteiras comunitárias"
              color="primary.main"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <KpiCard
              icon={<BalanceIcon sx={{ fontSize: 40 }} />}
              value={loading ? <Skeleton width={40} sx={{ mx: "auto" }} /> : (balances?.length ?? "—")}
              label="Comunidades com conta ativa"
              color="secondary.main"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <KpiCard
              icon={<TrendingUpIcon sx={{ fontSize: 40 }} />}
              value="100%"
              label="Das transações auditáveis publicamente"
              color="success.main"
            />
          </Grid>
        </Grid>

        {/* ── Info ── */}
        <Alert severity="info" sx={{ mb: 4 }}>
          Os saldos são atualizados em tempo real pelo backend. Para contribuir, acesse{" "}
          <Link href="/participe/apoiar">a página de Apoio</Link>. A API completa está
          documentada em{" "}
          <Link href={`${apiUrl}/docs`} target="_blank" rel="noopener noreferrer">
            {apiUrl}/docs
          </Link>
          .
        </Alert>

        {/* ── Error state ── */}
        {error && (
          <Alert severity="warning" sx={{ mb: 4 }}>
            Não foi possível conectar ao backend:{" "}
            <strong>{error}</strong>. Em produção o backend estará disponível.
          </Alert>
        )}

        {/* ── Empty state ── */}
        {!loading && balances?.length === 0 && (
          <Alert severity="info">
            Nenhuma carteira comunitária foi encontrada ainda. Seja o primeiro a{" "}
            <Link href="/participe/apoiar">fazer uma doação</Link>!
          </Alert>
        )}

        {/* ── Tabs + Transaction Table ── */}
        {!loading && balances && balances.length > 0 && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            {/* Tab header */}
            <Box
              sx={{
                borderBottom: 1,
                borderColor: "divider",
                px: { xs: 0, sm: 2 },
                overflowX: "auto",
              }}
            >
              <Tabs
                value={activeTab}
                onChange={(_, v: number) => setActiveTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="Comunidades parceiras"
              >
                {balances.map((b, i) => {
                  const meta = communities.find((c) => c.id === b.projectKey);
                  return (
                    <Tab
                      key={b.id}
                      id={`tab-community-${i}`}
                      aria-controls={`tabpanel-community-${i}`}
                      label={
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Avatar
                            src={meta?.logo}
                            alt={meta?.name ?? b.projectKey}
                            sx={{ width: 22, height: 22, fontSize: "0.75rem" }}
                          >
                            {meta?.emoji ?? "💰"}
                          </Avatar>
                          <Box>
                            <Typography
                              variant="caption"
                              display="block"
                              fontWeight={700}
                              sx={{ lineHeight: 1.2 }}
                            >
                              {meta?.name ?? b.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              display="block"
                              color={b.balance > 0 ? "success.main" : "text.secondary"}
                              fontWeight={700}
                              sx={{ lineHeight: 1.2 }}
                            >
                              {formatBRL(b.balance)}
                            </Typography>
                          </Box>
                        </Box>
                      }
                      sx={{ textTransform: "none", minWidth: 140, alignItems: "flex-start" }}
                    />
                  );
                })}
              </Tabs>
            </Box>

            {/* Community detail + table */}
            {balances.map((b, i) => {
              const meta = communities.find((c) => c.id === b.projectKey);
              return (
                <Box
                  key={b.id}
                  role="tabpanel"
                  id={`tabpanel-community-${i}`}
                  aria-labelledby={`tab-community-${i}`}
                  hidden={activeTab !== i}
                  sx={{ p: { xs: 2, sm: 3 } }}
                >
                  {activeTab === i && (
                    <>
                      {/* Community header */}
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: { xs: "flex-start", sm: "center" },
                          flexDirection: { xs: "column", sm: "row" },
                          gap: 2,
                          mb: 3,
                        }}
                      >
                        <Avatar
                          src={meta?.logo}
                          alt={meta?.name ?? b.projectKey}
                          sx={{ width: 52, height: 52, fontSize: "1.5rem" }}
                        >
                          {meta?.emoji ?? "💰"}
                        </Avatar>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" fontWeight={800}>
                            {meta?.name ?? b.name}
                          </Typography>
                          {meta?.location && (
                            <Typography variant="caption" color="text.secondary">
                              {meta.location}
                            </Typography>
                          )}
                          {meta?.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mt: 0.5, maxWidth: 600 }}
                            >
                              {meta.description.slice(0, 160)}…
                            </Typography>
                          )}
                        </Box>
                        <Card
                          variant="outlined"
                          sx={{
                            px: 2,
                            py: 1.5,
                            textAlign: "center",
                            minWidth: 140,
                            borderColor: b.balance > 0 ? "success.main" : "divider",
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" display="block">
                            Saldo atual
                          </Typography>
                          <Typography
                            variant="h5"
                            fontWeight={800}
                            color={b.balance > 0 ? "success.main" : "text.primary"}
                          >
                            {formatBRL(b.balance)}
                          </Typography>
                        </Card>
                      </Box>

                      {/* Tags */}
                      {meta?.tags && meta.tags.length > 0 && (
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 2 }}>
                          {meta.tags.map((t) => (
                            <Chip
                              key={t}
                              label={t}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: "0.7rem" }}
                            />
                          ))}
                        </Box>
                      )}

                      <Divider sx={{ mb: 2 }} />

                      {/* Transactions table */}
                      <Typography variant="subtitle2" fontWeight={700} color="text.secondary" gutterBottom>
                        Movimentações
                      </Typography>
                      <TransactionTable
                        accountId={b.id}
                        accountName={meta?.name ?? b.name}
                        apiUrl={apiUrl}
                      />
                    </>
                  )}
                </Box>
              );
            })}
          </Card>
        )}

        {/* Skeleton for tabs while loading */}
        {loading && (
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <Box sx={{ p: 3 }}>
              <Skeleton height={40} width="60%" sx={{ mb: 2 }} />
              <Skeleton height={24} width="90%" />
              <Skeleton height={24} width="80%" />
              <Skeleton height={200} sx={{ mt: 2 }} />
            </Box>
          </Card>
        )}

        <Divider sx={{ my: 8 }} />

        {/* ── Metodologia ── */}
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              Como funciona
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              Usamos <strong>contabilidade de dupla partida</strong>: cada doação cria dois
              lançamentos — um débito na conta de entrada (Stripe Income) e um crédito na
              carteira virtual da comunidade escolhida. Isso garante que nenhum valor apareça
              ou desapareça sem rastreamento completo.
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              O backend NestJS valida cada pagamento diretamente com a API da Stripe via
              Webhook antes de registrar qualquer transação. Pagamentos não confirmados nunca
              chegam ao sistema.
            </Typography>
            <Box sx={{ display: "flex", gap: 2, mt: 2, flexWrap: "wrap" }}>
              <Link
                href="/participe/apoiar"
                style={{ fontWeight: 700, color: "inherit" }}
              >
                Fazer uma doação →
              </Link>
              <Link
                href="https://github.com/codaqui/institucional"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontWeight: 600,
                  color: "inherit",
                  opacity: 0.7,
                }}
              >
                Código aberto <OpenInNewIcon sx={{ fontSize: "1rem" }} />
              </Link>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Card
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 3,
                background: (t) =>
                  t.palette.mode === "dark"
                    ? "rgba(34,197,94,0.06)"
                    : "rgba(34,197,94,0.04)",
                borderColor: "primary.main",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <CodeIcon color="primary" />
                <Typography variant="subtitle1" fontWeight={700}>
                  API REST pública
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Todos os dados aqui exibidos estão disponíveis via API REST documentada.
                Qualquer pessoa pode consultar os saldos e transações programaticamente.
              </Typography>
              <Box component="pre" sx={{
                bgcolor: "action.hover",
                borderRadius: 1,
                p: 1.5,
                fontSize: "0.75rem",
                overflowX: "auto",
                mb: 2,
              }}>
                {"GET /ledger/community-balances\nGET /ledger/accounts/:id/transactions\n     ?page=1&limit=10"}
              </Box>
              <Link
                href={`${apiUrl}/docs`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontWeight: 700,
                  color: "inherit",
                }}
              >
                Ver documentação completa <OpenInNewIcon sx={{ fontSize: "1rem" }} />
              </Link>
            </Card>
          </Grid>
        </Grid>

      </Container>
    </Layout>
  );
}
