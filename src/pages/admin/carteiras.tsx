import React, { useEffect, useCallback, useState } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
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
import { useAuth } from "../../hooks/useAuth";
import { parseAuthJson } from "../../hooks/authFetchHelpers";
import AdminDataTable from "../../components/AdminDataTable";
import AdminNavbar from "../../components/AdminNavbar";
import AdminPageContainer from "../../components/AdminPageContainer";
import WalletTransactionDetailDialog from "../../components/WalletTransactionDetailDialog";
import { WALLET_SOURCE_COLOR, formatWalletDate, resolveWalletSourceLabel } from "../../utils/wallet-transactions";

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

export default function AdminCarteirasPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const history = useHistory();

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
        `${apiUrl}/club/admin/wallet/all-transactions?type=${type}&page=${pg}&limit=${LIMIT}`
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
  }, [apiUrl, authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !isAdmin) { history.replace("/"); return; }
    fetchData(filterType, page);
  }, [ready, isLoggedIn, isAdmin, history, fetchData, filterType, page]);

  const handleFilterChange = (newType: FilterType) => {
    setFilterType(newType);
    setPage(1);
  };

  const totalPages = Math.ceil(total / LIMIT);

  if (!ready || !isLoggedIn || !isAdmin) {
    return (
      <Layout title="Admin — Carteiras">
        <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Admin — Carteiras" description="Histórico unificado de carteiras de SortCoins">
      <AdminPageContainer>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Histórico de Carteiras</Typography>
            <Typography variant="body2" color="text.secondary">
              Todas as movimentações de SortCoins — membros e empresas.
            </Typography>
          </Box>
        </Box>

        <AdminNavbar active="/admin/carteiras" />

        {/* Filtros */}
        <Box sx={{ display: "flex", gap: 2, mb: 3, alignItems: "center", flexWrap: "wrap" }}>
          <Typography variant="body2" color="text.secondary">Tipo:</Typography>
          <Select
            value={filterType}
            size="small"
            onChange={(e) => handleFilterChange(e.target.value as FilterType)}
            sx={{ minWidth: 160 }}
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
            <AdminDataTable
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
                              <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>
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
                            fontWeight={700}
                            color={r.amount >= 0 ? "success.main" : "error.main"}
                          >
                            {r.amount >= 0 ? "+" : ""}{r.amount} SC
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
      </AdminPageContainer>
    </Layout>
  );
}
