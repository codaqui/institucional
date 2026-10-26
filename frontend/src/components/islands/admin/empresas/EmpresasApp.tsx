/**
 * /admin/empresas — Painel de gestão de empresas para administradores.
 *
 * Permite:
 *  - Listar todas as empresas cadastradas
 *  - Ver detalhes de cada empresa (CNPJ, status, responsável, colaboradores)
 *  - Alterar status da empresa (PENDING → ACTIVE → SUSPENDED)
 *  - Ver saldo da carteira de SortCoins de cada empresa
 *
 * Port de src/pages/admin/empresas.tsx (Docusaurus). No Astro o authFetch do
 * useAuth já prefixa a API_URL — as chamadas usam path relativo.
 */

import { useCallback, useEffect, useState } from "react";
import MuiIslandProvider from "../../MuiIslandProvider";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import BusinessIcon from "@mui/icons-material/Business";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useAuth } from "../../../../lib/use-auth";
import { parseAuthJson } from "../../../../lib/auth-fetch-helpers";
import {
  formatSupportCountLabel,
  formatSupportCurrency,
} from "../../../../lib/company-support";
import PageContainer from "../ui/PageContainer";

interface Company {
  id: string;
  name: string;
  cnpj: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  status: string;
  responsibleMemberId: string;
  responsibleGithubHandle: string | null;
  subscriptionAmountCents: number | null;
  sortCoinBalance: number;
  totalSupportedReais: number;
  supportCount: number;
  monthsSupporting: number;
  createdAt: string;
}

interface CompanyMember {
  id: string;
  memberId: string;
  addedAt: string;
}

interface CompanyWallet {
  balances: Record<string, number>;
  frozenTypes: string[];
}

interface AdminCompaniesResponse {
  items: Company[];
  total: number;
  page: number;
  limit: number;
}

const STATUS_COLORS: Record<string, "warning" | "success" | "error" | "default"> = {
  pending: "warning",
  active: "success",
  suspended: "error",
  cancelled: "default",
};

function formatCnpj(cnpj: string): string {
  if (cnpj.length !== 14) return cnpj;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12)}`;
}

function EmpresasInner() {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailCache, setDetailCache] = useState<Record<string, { members: CompanyMember[]; wallet: CompanyWallet | null }>>({});
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);

  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await parseAuthJson<AdminCompaniesResponse | Company[]>(
        await authFetch(`/companies/admin/list?page=${page}&limit=${limit}`),
        (msg) => setLoadError(msg),
      );
      if (data) {
        if (Array.isArray(data)) {
          setCompanies(data);
          setTotal(data.length);
        } else {
          setCompanies(Array.isArray(data.items) ? data.items : []);
          setTotal(data.total ?? 0);
        }
      }
    } catch {
      setLoadError("Não foi possível carregar as empresas.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, page, limit]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !isAdmin) {
      window.location.replace("/");
      return;
    }
    loadCompanies();
  }, [ready, isLoggedIn, isAdmin, loadCompanies]);

  if (!ready) {
    return (
      <span className="inline-block h-10 w-64 animate-pulse rounded-md bg-sunken" />
    );
  }

  if (!isLoggedIn || !isAdmin) {
    return null; // redirect para "/" em curso
  }

  const toggleExpand = async (company: Company) => {
    if (expandedId === company.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(company.id);
    if (detailCache[company.id]) return;

    try {
      const [membersRes, walletRes] = await Promise.all([
        authFetch(`/companies/${company.id}/members`),
        authFetch(`/companies/${company.id}/wallet`),
      ]);

      const members = membersRes.ok ? ((await membersRes.json()) as CompanyMember[]) : [];
      const wallet = walletRes.ok ? ((await walletRes.json()) as CompanyWallet) : null;
      setDetailCache((prev) => ({ ...prev, [company.id]: { members, wallet } }));
    } catch {
      setLoadError("Não foi possível carregar os detalhes da empresa.");
      setExpandedId(null);
    }
  };

  const updateStatus = async (companyId: string, status: string) => {
    try {
      const res = await authFetch(`/companies/${companyId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setLoadError(`Erro ao atualizar status da empresa (HTTP ${res.status}).`);
        return;
      }
      setLoadError(null);
      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? { ...c, status } : c)),
      );
    } catch {
      setLoadError("Erro inesperado ao atualizar status da empresa.");
    }
  };

  return (
    <PageContainer>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
        <BusinessIcon sx={{ fontSize: 32, color: "primary.main" }} />
        <Typography variant="h4" component="h2" sx={{ fontWeight: 800 }}>
          Empresas — CLUB Business
        </Typography>
      </Box>

      {loadError && <Alert severity="error" sx={{ mb: 3 }}>{loadError}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {companies.length === 0 && !loadError && (
            <Typography color="text.secondary">Nenhuma empresa cadastrada ainda.</Typography>
          )}

          <Stack spacing={2}>
            {companies.map((company) => {
              const isExpanded = expandedId === company.id;
              const detail = detailCache[company.id];
              const sortCoins = detail?.wallet?.balances?.["sort_coin"] ?? company.sortCoinBalance ?? 0;
              const hasConfiguredRecurring =
                company.status === "active" && (company.subscriptionAmountCents ?? 0) > 0;

              return (
                <Card key={company.id} variant="outlined" sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ pb: "12px !important" }}>
                    {/* Header row */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      {company.logoUrl ? (
                        <Avatar src={company.logoUrl} alt={company.name} sx={{ width: 40, height: 40 }} />
                      ) : (
                        <Avatar sx={{ width: 40, height: 40, bgcolor: "primary.main" }}>
                          <BusinessIcon fontSize="small" />
                        </Avatar>
                      )}

                      <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                          <Typography sx={{ fontWeight: 700 }}>{company.name}</Typography>
                          <Chip
                            label={company.status}
                            size="small"
                            color={STATUS_COLORS[company.status] ?? "default"}
                          />
                          {hasConfiguredRecurring && (
                            <Chip
                              label={`Recorrência: R$ ${((company.subscriptionAmountCents ?? 0) / 100).toFixed(0)}/mês`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          <Chip
                            label={`${formatSupportCurrency(company.totalSupportedReais)} em apoios`}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={formatSupportCountLabel(company.supportCount)}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={`${sortCoins} SortCoins`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          CNPJ: {formatCnpj(company.cnpj)} · Responsável: @{company.responsibleGithubHandle ?? company.responsibleMemberId}
                          {company.websiteUrl && (
                            <>
                              {" · "}
                              <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer">
                                {company.websiteUrl} <OpenInNewIcon sx={{ fontSize: 10, verticalAlign: "middle" }} />
                              </a>
                            </>
                          )}
                        </Typography>
                      </Box>

                      {/* Status changer */}
                      <Select
                        value={company.status}
                        size="small"
                        sx={{ minWidth: 130 }}
                        onChange={(e) => updateStatus(company.id, e.target.value)}
                        aria-label={`Status de ${company.name}`}
                      >
                        <MenuItem value="pending">Pendente</MenuItem>
                        <MenuItem value="active">Ativa</MenuItem>
                        <MenuItem value="suspended">Suspensa</MenuItem>
                        <MenuItem value="cancelled">Cancelada</MenuItem>
                      </Select>

                      <IconButton
                        size="small"
                        onClick={() => toggleExpand(company)}
                        aria-label={isExpanded ? "fechar detalhes" : "ver detalhes"}
                      >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </Box>

                    {/* Expanded details */}
                    <Collapse in={isExpanded}>
                      <Divider sx={{ my: 2 }} />
                      {detail ? (
                        <Box>
                          <Typography variant="subtitle2" component="h3" gutterBottom sx={{ fontWeight: 700 }}>
                            Colaboradores ({detail.members.length})
                          </Typography>
                          {detail.members.length === 0 ? (
                            <Typography variant="body2" color="text.secondary">Nenhum colaborador.</Typography>
                          ) : (
                            <List dense disablePadding>
                              {detail.members.map((m) => (
                                <ListItem key={m.id} disablePadding sx={{ py: 0.25 }}>
                                  <ListItemAvatar>
                                    <Avatar
                                      src={`https://avatars.githubusercontent.com/${m.memberId}?size=32`}
                                      alt={m.memberId}
                                      sx={{ width: 28, height: 28 }}
                                    />
                                  </ListItemAvatar>
                                  <ListItemText
                                    primary={`@${m.memberId}`}
                                    secondary={`Desde ${new Date(m.addedAt).toLocaleDateString("pt-BR")}`}
                                  />
                                </ListItem>
                              ))}
                            </List>
                          )}

                          {detail.wallet && (
                            <>
                              <Divider sx={{ my: 1.5 }} />
                              <Typography variant="subtitle2" component="h3" gutterBottom sx={{ fontWeight: 700 }}>
                                Carteira
                              </Typography>
                              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Tipo de moeda</TableCell>
                                      <TableCell align="right">Saldo</TableCell>
                                      <TableCell>Status</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {Object.entries(detail.wallet.balances).map(([coin, bal]) => (
                                      <TableRow key={coin}>
                                        <TableCell>{coin}</TableCell>
                                        <TableCell align="right">{bal}</TableCell>
                                        <TableCell>
                                          {detail.wallet!.frozenTypes.includes(coin) ? (
                                            <Chip label="Congelado" size="small" color="error" />
                                          ) : (
                                            <Chip label="Ativo" size="small" color="success" />
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </>
                          )}
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                          <CircularProgress size={24} />
                        </Box>
                      )}
                    </Collapse>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
          {total > limit && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Pagination
                page={page}
                count={Math.max(1, Math.ceil(total / limit))}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </>
      )}
    </PageContainer>
  );
}

export default function EmpresasApp() {
  return (
    <MuiIslandProvider>
      <EmpresasInner />
    </MuiIslandProvider>
  );
}
