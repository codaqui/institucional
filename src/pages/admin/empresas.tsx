/**
 * /admin/empresas — Painel de gestão de empresas para administradores.
 *
 * Permite:
 *  - Listar todas as empresas cadastradas
 *  - Ver detalhes de cada empresa (CNPJ, status, responsável, colaboradores)
 *  - Alterar status da empresa (PENDING → ACTIVE → SUSPENDED)
 *  - Ver saldo da carteira de SortCoins de cada empresa
 */

import React, { useCallback, useEffect, useState } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import BusinessIcon from "@mui/icons-material/Business";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Pagination from "@mui/material/Pagination";
import { useAuth } from "../../hooks/useAuth";
import AdminNavbar from "../../components/AdminNavbar";
import { parseAuthJson } from "../../hooks/authFetchHelpers";
import { resolveApiUrl } from "../../lib/api-url";
import {
  formatSupportCountLabel,
  formatSupportCurrency,
} from "../../utils/company-support";

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

export default function AdminEmpresasPage(): React.JSX.Element {
  const history = useHistory();
  const { siteConfig } = useDocusaurusContext();
  const configuredApiUrl = (siteConfig.customFields?.apiUrl as string) ?? "";
  const apiUrl = resolveApiUrl(configuredApiUrl, siteConfig.url);

  const { isLoggedIn, isAdmin, ready, authFetch } = useAuth();

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
    const data = await parseAuthJson<AdminCompaniesResponse | Company[]>(
      await authFetch(`${apiUrl}/companies/admin/list?page=${page}&limit=${limit}`),
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
    setLoading(false);
  }, [authFetch, apiUrl, page, limit]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !isAdmin) {
      history.push("/");
      return;
    }
    loadCompanies();
  }, [ready, isLoggedIn, isAdmin, history, loadCompanies]);

  const toggleExpand = async (company: Company) => {
    if (expandedId === company.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(company.id);
    if (detailCache[company.id]) return;

    const [membersRes, walletRes] = await Promise.all([
      authFetch(`${apiUrl}/companies/${company.id}/members`),
      authFetch(`${apiUrl}/companies/${company.id}/wallet`),
    ]);

    const members = membersRes.ok ? ((await membersRes.json()) as CompanyMember[]) : [];
    const wallet = walletRes.ok ? ((await walletRes.json()) as CompanyWallet) : null;
    setDetailCache((prev) => ({ ...prev, [company.id]: { members, wallet } }));
  };

  const updateStatus = async (companyId: string, status: string) => {
    await authFetch(`${apiUrl}/companies/${companyId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setCompanies((prev) =>
      prev.map((c) => (c.id === companyId ? { ...c, status } : c)),
    );
  };

  if (!ready || loading) {
    return (
      <Layout title="Admin — Empresas">
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Admin — Empresas" description="Gestão de empresas cadastradas no CLUB Business">
      <Container maxWidth="lg" sx={{ py: 6 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <BusinessIcon sx={{ fontSize: 32, color: "primary.main" }} />
          <Typography variant="h4" fontWeight={800}>
            Empresas — CLUB Business
          </Typography>
        </Box>

        <AdminNavbar active="/admin/empresas" />

        {loadError && <Alert severity="error" sx={{ mb: 3 }}>{loadError}</Alert>}

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
                        <Typography fontWeight={700}>{company.name}</Typography>
                        <Chip
                          label={company.status}
                          size="small"
                          color={STATUS_COLORS[company.status] ?? "default"}
                        />
                        {hasConfiguredRecurring && (
                          <Chip
                            label={`Recorrência: R$ ${(company.subscriptionAmountCents / 100).toFixed(0)}/mês`}
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
                    {!detail ? (
                      <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : (
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
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
                            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
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
      </Container>
    </Layout>
  );
}
