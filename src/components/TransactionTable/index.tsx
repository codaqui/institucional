import React, { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import {
  type PaginatedTransactions,
  type Transaction,
  TX_TYPE_CONFIG,
  detectTxType,
  formatBRL,
  formatDate,
} from "../../utils/transaction";
import TransactionDetailDialog from "../TransactionDetailDialog";

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

const TX_TYPE_FILTER_OPTIONS = [
  { value: "", label: "Todos os tipos" },
  { value: "donation", label: "Doações" },
  { value: "reimbursement", label: "Reembolsos" },
  { value: "vendor-payment", label: "Pagamentos a Fornecedor" },
  { value: "transfer", label: "Transferências" },
];

const PERIOD_FILTER_OPTIONS = [
  { value: 0, label: "Todos os períodos" },
  { value: 30, label: "Último mês" },
  { value: 90, label: "Últimos 3 meses" },
  { value: 365, label: "Último ano" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TransactionTableProps {
  accountId: string;
  accountName: string;
  apiUrl: string;
}

export default function TransactionTable({
  accountId,
  accountName,
  apiUrl,
}: Readonly<TransactionTableProps>) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [result, setResult] = useState<PaginatedTransactions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState("");
  const [daysFilter, setDaysFilter] = useState(0);
  const [searchFilter, setSearchFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchTransactions = useCallback(
    async (p: number, limit: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(p + 1),
          limit: String(limit),
        });
        if (typeFilter) params.set("type", typeFilter);
        if (daysFilter > 0) params.set("days", String(daysFilter));
        if (searchFilter) params.set("search", searchFilter);

        const res = await fetch(
          `${apiUrl}/ledger/accounts/${accountId}/transactions?${params}`
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
    [accountId, apiUrl, typeFilter, daysFilter, searchFilter]
  );

  useEffect(() => {
    fetchTransactions(page, rowsPerPage);
  }, [fetchTransactions, page, rowsPerPage]);

  useEffect(() => {
    setPage(0);
  }, [typeFilter, daysFilter, searchFilter]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(Number.parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleSearch = () => {
    setSearchFilter(searchInput);
  };

  const handleExportCSV = () => {
    if (!result?.data.length) return;
    const header = "Data,Tipo,Descrição,De,Para,Valor,Direção\n";
    const rows = result.data.map((tx) => {
      const isCredit = tx.destinationAccount.id === accountId;
      const type = detectTxType(tx);
      return [
        formatDate(tx.createdAt),
        TX_TYPE_CONFIG[type].label,
        `"${tx.description.replaceAll('"', '""')}"`,
        tx.sourceAccount?.name,
        tx.destinationAccount?.name,
        Number(tx.amount).toFixed(2),
        isCredit ? "Crédito" : "Débito",
      ].join(",");
    });
    const csv = header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transacoes-${accountName.toLowerCase().replaceAll(" ", "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
  const hasActiveFilters = typeFilter !== "" || daysFilter > 0 || searchFilter !== "";

  return (
    <Box>
      {/* Filters bar */}
      <Box sx={{
        display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center",
        mb: 2, p: 1.5, borderRadius: 2, bgcolor: "action.hover",
      }}>
        <Select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          size="small"
          displayEmpty
          sx={{ minWidth: 170, fontSize: "0.8rem" }}
        >
          {TX_TYPE_FILTER_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.85rem" }}>
              {o.label}
            </MenuItem>
          ))}
        </Select>

        <Select
          value={daysFilter}
          onChange={(e) => setDaysFilter(Number(e.target.value))}
          size="small"
          sx={{ minWidth: 160, fontSize: "0.8rem" }}
        >
          {PERIOD_FILTER_OPTIONS.map((o) => (
            <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.85rem" }}>
              {o.label}
            </MenuItem>
          ))}
        </Select>

        <TextField
          size="small"
          placeholder="Buscar na descrição…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          slotProps={{
            input: {
              endAdornment: (
                <IconButton size="small" onClick={handleSearch} aria-label="Buscar">
                  <SearchIcon fontSize="small" />
                </IconButton>
              ),
              sx: { fontSize: "0.8rem" },
            },
          }}
          sx={{ flex: 1, minWidth: 140 }}
        />

        <Tooltip title="Exportar CSV da página atual">
          <IconButton
            size="small"
            onClick={handleExportCSV}
            disabled={rows.length === 0}
            aria-label="Exportar CSV"
          >
            <DownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        {hasActiveFilters && (
          <Button
            size="small"
            variant="text"
            onClick={() => {
              setTypeFilter("");
              setDaysFilter(0);
              setSearchFilter("");
              setSearchInput("");
            }}
            sx={{ fontSize: "0.75rem", textTransform: "none" }}
          >
            Limpar filtros
          </Button>
        )}
      </Box>

      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{ borderRadius: 2 }}
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
