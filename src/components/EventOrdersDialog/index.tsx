import React, { useCallback, useEffect, useState } from "react";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import RefreshIcon from "@mui/icons-material/Refresh";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import KeyboardReturnIcon from "@mui/icons-material/KeyboardReturn";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SearchIcon from "@mui/icons-material/Search";
import Link from "@docusaurus/Link";
import { useAuth } from "../../hooks/useAuth";
import { parseAuthJson, extractErrorMessage } from "../../hooks/authFetchHelpers";
import {
  type PaginatedTransactions,
  type Transaction,
  TX_TYPE_CONFIG,
  detectTxType,
  formatBRL,
  formatDate,
} from "../../utils/transaction";
import ModalConfirm from "../ModalConfirm";
import TransactionDetailDialog from "../TransactionDetailDialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderStatus = "pending" | "paid" | "refunded" | "expired" | "cancelled";

interface OrderItem {
  id: string;
  status: OrderStatus;
  quantity: number;
  totalCents: number;
  paidAt: string | null;
  createdAt: string;
  stripePaymentIntentId: string | null;
  member: {
    id: string;
    name: string | null;
    email: string | null;
    handle: string | null;
  } | null;
  attendees: Array<{ name: string; email: string }>;
  ticketType: {
    id: string;
    name: string;
    kind: string;
    priceCents: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatBRLFromCents = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

const formatDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: "default" | "success" | "error" | "warning" | "info" }
> = {
  pending: { label: "Pendente", color: "warning" },
  paid: { label: "Pago", color: "success" },
  refunded: { label: "Reembolsado", color: "error" },
  expired: { label: "Expirado", color: "default" },
  cancelled: { label: "Cancelado", color: "default" },
};

const TX_TYPE_FILTER_OPTIONS = [
  { value: "", label: "Todos os tipos" },
  { value: "event-ticket", label: "Ingressos de Evento" },
  { value: "event-ticket-refund", label: "Reembolsos de Ingresso" },
  { value: "donation", label: "Doações" },
  { value: "reimbursement", label: "Reembolsos" },
  { value: "vendor-payment", label: "Pagamentos a Fornecedor" },
  { value: "transfer", label: "Transferências" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface EventOrdersDialogProps {
  open: boolean;
  onClose: () => void;
  /** Evento interno: passar eventId. Externo: passar eventKey no formato source:sourceId:eventId. */
  eventId?: string;
  eventKey?: string;
  eventTitle: string;
  apiUrl: string;
}

export default function EventOrdersDialog({
  open,
  onClose,
  eventId,
  eventKey,
  eventTitle,
  apiUrl,
}: EventOrdersDialogProps): React.JSX.Element {
  const { authFetch } = useAuth();

  const [tab, setTab] = useState(0);

  // ── Pedidos ──
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [refundTarget, setRefundTarget] = useState<OrderItem | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [refundSuccess, setRefundSuccess] = useState("");

  // ── Caixa (ledger) ──
  const [ledgerResult, setLedgerResult] = useState<PaginatedTransactions | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState("");
  const [ledgerPage, setLedgerPage] = useState(0);
  const [ledgerRowsPerPage, setLedgerRowsPerPage] = useState(10);
  const [ledgerTypeFilter, setLedgerTypeFilter] = useState("");
  const [ledgerSearchInput, setLedgerSearchInput] = useState("");
  const [ledgerSearchFilter, setLedgerSearchFilter] = useState("");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!open) return;
    setOrdersLoading(true);
    setOrdersError("");
    try {
      const url = eventId
        ? `${apiUrl}/events/${eventId}/orders`
        : `${apiUrl}/events/external/${encodeURIComponent(eventKey ?? "")}/orders`;
      const res = await authFetch(url);
      const data = await parseAuthJson<OrderItem[]>(res, setOrdersError);
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrdersError("Erro inesperado ao carregar pedidos.");
    } finally {
      setOrdersLoading(false);
    }
  }, [open, eventId, eventKey, apiUrl, authFetch]);

  const fetchLedger = useCallback(async () => {
    if (!open) return;
    setLedgerLoading(true);
    setLedgerError("");
    try {
      const baseUrl = eventId
        ? `${apiUrl}/events/${eventId}/ledger`
        : `${apiUrl}/events/external/${encodeURIComponent(eventKey ?? "")}/ledger`;
      const params = new URLSearchParams({
        page: String(ledgerPage + 1),
        limit: String(ledgerRowsPerPage),
      });
      if (ledgerTypeFilter) params.set("type", ledgerTypeFilter);
      if (ledgerSearchFilter) params.set("search", ledgerSearchFilter);
      const res = await authFetch(`${baseUrl}?${params}`);
      const data = await parseAuthJson<PaginatedTransactions>(res, setLedgerError);
      setLedgerResult(data ?? null);
    } catch {
      setLedgerError("Erro inesperado ao carregar caixa.");
    } finally {
      setLedgerLoading(false);
    }
  }, [
    open,
    eventId,
    eventKey,
    apiUrl,
    authFetch,
    ledgerPage,
    ledgerRowsPerPage,
    ledgerTypeFilter,
    ledgerSearchFilter,
  ]);

  useEffect(() => {
    if (!open) return;
    fetchOrders();
    setLedgerPage(0);
    setLedgerSearchFilter("");
    setLedgerSearchInput("");
    setLedgerTypeFilter("");
  }, [open, fetchOrders]);

  useEffect(() => {
    if (!open || tab !== 1) return;
    fetchLedger();
  }, [fetchLedger, tab]);

  useEffect(() => {
    setLedgerPage(0);
  }, [ledgerTypeFilter, ledgerSearchFilter]);

  const handleRefund = async () => {
    if (!refundTarget) return;
    setRefundLoading(true);
    setRefundError("");
    setRefundSuccess("");
    try {
      const res = await authFetch(`${apiUrl}/events/orders/${refundTarget.id}/refund`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setRefundError(await extractErrorMessage(res, "Erro ao reembolsar pedido."));
        return;
      }
      setRefundSuccess(`Pedido ${refundTarget.id.slice(0, 8)} reembolsado com sucesso.`);
      setRefundTarget(null);
      fetchOrders();
    } catch {
      setRefundError("Erro inesperado ao reembolsar.");
    } finally {
      setRefundLoading(false);
    }
  };

  const totalRevenue = orders
    .filter((o) => o.status === "paid")
    .reduce((sum, o) => sum + o.totalCents, 0);

  const ledgerTotalIn =
    ledgerResult?.data
      .filter((tx) => detectTxType(tx) === "event-ticket")
      .reduce((sum, tx) => sum + Number(tx.amount), 0) ?? 0;

  const ledgerTotalOut =
    ledgerResult?.data
      .filter((tx) => detectTxType(tx) === "event-ticket-refund")
      .reduce((sum, tx) => sum + Number(tx.amount), 0) ?? 0;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          {eventTitle}
        </Typography>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 1 }}>
          <Tab label="Pedidos" />
          <Tab label="Caixa" />
        </Tabs>
      </DialogTitle>
      <DialogContent>
        {refundSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setRefundSuccess("")}>
            {refundSuccess}
          </Alert>
        )}
        {ordersError && tab === 0 && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setOrdersError("")}>
            {ordersError}
          </Alert>
        )}
        {ledgerError && tab === 1 && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLedgerError("")}>
            {ledgerError}
          </Alert>
        )}

        {tab === 0 && (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary">
                {orders.length} pedido(s) · Receita confirmada:{" "}
                <strong>{formatBRLFromCents(totalRevenue)}</strong>
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                disabled={ordersLoading}
                onClick={fetchOrders}
              >
                Atualizar
              </Button>
            </Box>

            {ordersLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : orders.length === 0 ? (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                Nenhum pedido encontrado para este evento.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Comprador</TableCell>
                      <TableCell>Participante(s)</TableCell>
                      <TableCell>Ingresso</TableCell>
                      <TableCell align="right">Qtd</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Pago em</TableCell>
                      <TableCell>Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {order.member?.name ?? "—"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {order.member?.handle
                              ? `@${order.member.handle}`
                              : order.member?.email ?? "—"}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {order.attendees && order.attendees.length > 0 ? (
                            order.attendees.map((a, i) => (
                              <Typography key={i} variant="body2">
                                {a.name} <Typography component="span" variant="caption" color="text.secondary">({a.email})</Typography>
                              </Typography>
                            ))
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              {order.member?.name ?? "—"}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{order.ticketType?.name ?? "—"}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {order.ticketType ? formatBRLFromCents(order.ticketType.priceCents) : "—"} / un
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{order.quantity}</TableCell>
                        <TableCell align="right">
                          {formatBRLFromCents(order.totalCents)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={STATUS_CONFIG[order.status].label}
                            color={STATUS_CONFIG[order.status].color}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{formatDateTime(order.paidAt)}</TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", gap: 0.5 }}>
                            {(order.status === "paid" || order.status === "refunded") && (
                              <IconButton
                                size="small"
                                component={Link}
                                href={`/eventos/comprovante?order=${order.id}`}
                                aria-label="comprovante"
                              >
                                <ReceiptLongIcon fontSize="small" />
                              </IconButton>
                            )}
                            {order.status === "paid" && (
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setRefundTarget(order);
                                  setRefundError("");
                                }}
                                aria-label="reembolsar"
                              >
                                <KeyboardReturnIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}

        {tab === 1 && (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
              <Typography variant="body2" color="text.secondary">
                Entradas: <strong>{formatBRL(ledgerTotalIn)}</strong> · Saídas:{" "}
                <strong>{formatBRL(ledgerTotalOut)}</strong> · Saldo:{" "}
                <strong>{formatBRL(ledgerTotalIn - ledgerTotalOut)}</strong>
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Select
                value={ledgerTypeFilter}
                onChange={(e) => setLedgerTypeFilter(e.target.value)}
                size="small"
                displayEmpty
                sx={{ minWidth: 170 }}
              >
                {TX_TYPE_FILTER_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
              <Box sx={{ display: "flex", gap: 0.5 }}>
                <TextField
                  size="small"
                  placeholder="Buscar descrição"
                  value={ledgerSearchInput}
                  onChange={(e) => setLedgerSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setLedgerSearchFilter(ledgerSearchInput);
                  }}
                />
                <IconButton onClick={() => setLedgerSearchFilter(ledgerSearchInput)} aria-label="buscar">
                  <SearchIcon fontSize="small" />
                </IconButton>
              </Box>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                disabled={ledgerLoading}
                onClick={fetchLedger}
              >
                Atualizar
              </Button>
            </Box>

            {ledgerLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : !ledgerResult || ledgerResult.data.length === 0 ? (
              <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                Nenhuma transação encontrada para este evento.
              </Typography>
            ) : (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Data</TableCell>
                        <TableCell>Tipo</TableCell>
                        <TableCell>Descrição</TableCell>
                        <TableCell align="right">Valor</TableCell>
                        <TableCell align="center">Ações</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ledgerResult.data.map((tx) => {
                        const type = detectTxType(tx);
                        const config = TX_TYPE_CONFIG[type];
                        return (
                          <TableRow key={tx.id}>
                            <TableCell>{formatDate(tx.createdAt)}</TableCell>
                            <TableCell>
                              <Chip
                                icon={config.icon}
                                label={config.label}
                                color={config.color}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>{tx.description}</TableCell>
                            <TableCell align="right">{formatBRL(Number(tx.amount))}</TableCell>
                            <TableCell align="center">
                              <IconButton
                                size="small"
                                onClick={() => setSelectedTx(tx)}
                                aria-label="ver detalhes"
                              >
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <TablePagination
                  component="div"
                  count={ledgerResult.total}
                  page={ledgerPage}
                  onPageChange={(_, p) => setLedgerPage(p)}
                  rowsPerPage={ledgerRowsPerPage}
                  onRowsPerPageChange={(e) => {
                    setLedgerRowsPerPage(Number.parseInt(e.target.value, 10));
                    setLedgerPage(0);
                  }}
                  rowsPerPageOptions={[5, 10, 25, 50]}
                  labelRowsPerPage="Linhas"
                  labelDisplayedRows={({ from, to, count }) =>
                    `${from}–${to} de ${count}`
                  }
                />
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>

      <ModalConfirm
        open={!!refundTarget}
        onClose={() => setRefundTarget(null)}
        onConfirm={handleRefund}
        title="Reembolsar pedido"
        description={`Confirma o reembolso total do pedido ${refundTarget?.id.slice(0, 8)}? O valor será devolvido ao comprador via Stripe e as inscrições vinculadas serão marcadas como reembolsadas.`}
        confirmLabel={refundLoading ? "Processando..." : "Reembolsar"}
        variant="error"
        loading={refundLoading}
        error={refundError}
      />

      {selectedTx && (
        <TransactionDetailDialog
          tx={selectedTx}
          onClose={() => setSelectedTx(null)}
          accountId={selectedTx.destinationAccount?.id ?? selectedTx.sourceAccount?.id ?? ""}
          apiUrl={apiUrl}
        />
      )}
    </Dialog>
  );
}
