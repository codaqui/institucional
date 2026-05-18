import React, { useEffect, useCallback, useState } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import BusinessIcon from "@mui/icons-material/Business";
import PersonIcon from "@mui/icons-material/Person";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useAuth } from "../../hooks/useAuth";
import { parseAuthJson } from "../../hooks/authFetchHelpers";
import AdminNavbar from "../../components/AdminNavbar";
import AdminPageContainer from "../../components/AdminPageContainer";

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

const SOURCE_LABEL: Record<string, string> = {
  stripe_invoice: "Stripe Invoice",
  manual_admin: "Ajuste Admin",
  raffle_entry: "Entrada Sorteio",
  raffle_refund: "Reembolso Sorteio",
  company_distribution: "Distribuição Empresa",
};

const SOURCE_COLOR: Record<string, "default" | "primary" | "secondary" | "success" | "error" | "warning" | "info"> = {
  stripe_invoice: "success",
  manual_admin: "warning",
  raffle_entry: "primary",
  raffle_refund: "info",
  company_distribution: "secondary",
};

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
            <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
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
                          label={SOURCE_LABEL[r.source] ?? r.source}
                          color={SOURCE_COLOR[r.source] ?? "default"}
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
                        <Tooltip title={new Date(r.createdAt).toLocaleString("pt-BR")}>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {new Date(r.createdAt).toLocaleString("pt-BR")}
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
            </TableContainer>

            <Dialog
              open={!!selectedRow}
              onClose={() => setSelectedRow(null)}
              maxWidth="sm"
              fullWidth
            >
              <DialogTitle>Detalhes da transação</DialogTitle>
              <DialogContent>
                {selectedRow && (
                  <Box sx={{ display: "grid", gap: 1 }}>
                    <Typography variant="body2"><strong>ID:</strong> {selectedRow.id}</Typography>
                    <Typography variant="body2"><strong>Titular:</strong> {selectedRow.ownerName}</Typography>
                    <Typography variant="body2"><strong>Tipo:</strong> {selectedRow.ownerType === "company" ? "Empresa" : "Membro"}</Typography>
                    <Typography variant="body2"><strong>Origem:</strong> {SOURCE_LABEL[selectedRow.source] ?? selectedRow.source}</Typography>
                    <Typography variant="body2"><strong>Coins:</strong> {selectedRow.amount} SC</Typography>
                    <Typography variant="body2"><strong>Descrição:</strong> {selectedRow.description ?? "—"}</Typography>
                    <Typography variant="body2"><strong>Referência:</strong> {selectedRow.referenceId ?? "—"}</Typography>
                    <Typography variant="body2"><strong>Data:</strong> {new Date(selectedRow.createdAt).toLocaleString("pt-BR")}</Typography>
                  </Box>
                )}
              </DialogContent>
            </Dialog>

            {totalPages > 1 && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, v) => setPage(v)}
                  color="primary"
                />
              </Box>
            )}
          </>
        )}
      </AdminPageContainer>
    </Layout>
  );
}
