/**
 * /admin/carteiras — Histórico unificado de carteiras de SortCoins.
 *
 * Lista paginada de todas as movimentações (membros e empresas) com filtro
 * por tipo de titular e diálogo de detalhes por transação.
 *
 * Port de src/pages/admin/carteiras.tsx (Docusaurus).
 */

import { useEffect, useCallback, useState } from "react";
import MuiIslandProvider from "../../MuiIslandProvider";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import BusinessIcon from "@mui/icons-material/Business";
import PersonIcon from "@mui/icons-material/Person";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useAuth } from "../../../../lib/use-auth";
import { parseAuthJson } from "../../../../lib/auth-fetch-helpers";
import {
  WALLET_SOURCE_COLOR,
  formatWalletDate,
  resolveWalletSourceLabel,
} from "../../../../lib/wallet-transactions";
import WalletTransactionDetailDialog from "../../WalletTransactionDetailDialog";
import PageContainer from "../ui/PageContainer";
import DataTable from "../ui/DataTable";

type OwnerType = "member" | "company";
type FilterType = "all" | "member" | "company";

interface WalletTxRow {
  id: string;
  ownerType: OwnerType;
  ownerHandle: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
  coinType: string;
  amount: number;
  source: string;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

const LIMIT = 50;

function CarteirasInner() {
  const { ready, isLoggedIn, isAdmin, isFinanceAnalyzer, authFetch } = useAuth();

  const canAccess = isAdmin || isFinanceAnalyzer;

  const [rows, setRows] = useState<WalletTxRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<WalletTxRow | null>(null);

  const fetchData = useCallback(async (type: FilterType, pg: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(
        `/club/admin/wallet/all-transactions?type=${type}&page=${pg}&limit=${LIMIT}`,
      );
      const data = await parseAuthJson<{ data: WalletTxRow[]; total: number }>(res, setError);
      if (data) {
        setRows(data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !canAccess) {
      window.location.replace("/");
      return;
    }
    fetchData(filterType, page);
  }, [ready, isLoggedIn, canAccess, fetchData, filterType, page]);

  if (!ready) {
    return (
      <span className="inline-block h-10 w-64 animate-pulse rounded-md bg-sunken" />
    );
  }

  if (!isLoggedIn || !canAccess) {
    return null; // redirect para "/" em curso
  }

  const handleFilterChange = (newType: FilterType) => {
    setFilterType(newType);
    setPage(1);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <PageContainer>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>Histórico de Carteiras</Typography>
          <Typography variant="body2" color="text.secondary">
            Todas as movimentações de SortCoins — membros e empresas.
          </Typography>
        </Box>
      </Box>

      {/* Filtros */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, alignItems: "center", flexWrap: "wrap" }}>
        <Typography variant="body2" color="text.secondary">Tipo:</Typography>
        <Select
          value={filterType}
          size="small"
          onChange={(e) => handleFilterChange(e.target.value as FilterType)}
          sx={{ minWidth: 160 }}
          aria-label="Tipo de titular"
        >
          <MenuItem value="all">Todos</MenuItem>
          <MenuItem value="member">Somente membros</MenuItem>
          <MenuItem value="company">Somente empresas</MenuItem>
        </Select>
        <Typography variant="caption" color="text.secondary">
          {total} transação(ões) encontrada(s)
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <DataTable
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            tableContainerSx={{ overflowX: "auto" }}
            paginationMarginTop={3}
            table={(
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Titular</TableCell>
                    <TableCell align="right">Coins</TableCell>
                    <TableCell>Origem</TableCell>
                    <TableCell>Descrição / Referência</TableCell>
                    <TableCell>Data</TableCell>
                    <TableCell align="right">Detalhe</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        Nenhuma transação encontrada.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => (
                    <TableRow key={r.id} sx={{ "&:hover": { bgcolor: "action.hover" } }}>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={r.ownerType === "company" ? <BusinessIcon /> : <PersonIcon />}
                          label={r.ownerType === "company" ? "Empresa" : "Membro"}
                          color={r.ownerType === "company" ? "secondary" : "default"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Avatar
                            src={r.ownerAvatarUrl ?? undefined}
                            alt={r.ownerName}
                            sx={{ width: 28, height: 28, bgcolor: r.ownerType === "company" ? "secondary.main" : "primary.main" }}
                          >
                            {r.ownerType === "company" ? <BusinessIcon sx={{ fontSize: 16 }} /> : <PersonIcon sx={{ fontSize: 16 }} />}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ lineHeight: 1.2, fontWeight: 600 }}>
                              {r.ownerName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {r.ownerType === "member" ? `@${r.ownerHandle}` : r.ownerHandle}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={r.amount >= 0 ? "success.main" : "error.main"}
                          sx={{ fontWeight: 700 }}
                        >
                          {r.amount >= 0 ? "+" : ""}{r.amount} SortCoins
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={resolveWalletSourceLabel(r.source)}
                          color={WALLET_SOURCE_COLOR[r.source] ?? "default"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 240 }}>
                        {r.description && (
                          <Tooltip title={r.description}>
                            <Typography variant="body2" noWrap>
                              {r.description}
                            </Typography>
                          </Tooltip>
                        )}
                        {r.referenceId && (
                          <Tooltip title={r.referenceId}>
                            <Typography variant="caption" color="text.disabled" noWrap>
                              {r.referenceId}
                            </Typography>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <Tooltip title={formatWalletDate(r.createdAt)}>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {formatWalletDate(r.createdAt)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          aria-label="Ver detalhes da transação"
                          onClick={() => setSelectedRow(r)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          />

          <WalletTransactionDetailDialog tx={selectedRow} onClose={() => setSelectedRow(null)} />
        </>
      )}
    </PageContainer>
  );
}

export default function CarteirasApp() {
  return (
    <MuiIslandProvider>
      <CarteirasInner />
    </MuiIslandProvider>
  );
}
