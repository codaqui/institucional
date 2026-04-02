import React, { useEffect, useCallback, useState } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import ModalConfirm from "../../components/ModalConfirm";
import { useAuth } from "../../hooks/useAuth";

type Role = "membro" | "finance-analyzer" | "admin";

interface Member {
  id: string;
  name: string;
  githubHandle: string;
  avatarUrl: string;
  role: Role;
  isActive: boolean;
  joinedAt: string;
}

const ALL_ROLES: Role[] = ["membro", "finance-analyzer", "admin"];

const ROLE_LABEL: Record<Role, string> = {
  membro: "Membro",
  "finance-analyzer": "Finance Analyzer",
  admin: "Admin",
};

const roleChipColor = (role: Role): "default" | "secondary" | "primary" => {
  if (role === "admin") return "primary";
  if (role === "finance-analyzer") return "secondary";
  return "default";
};

export default function AdminPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://api.localhost:8000";
  const history = useHistory();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── ModalConfirm state ────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  // Confirmação de troca de role
  const [roleTarget, setRoleTarget] = useState<{ member: Member; nextRole: Role } | null>(null);
  // Confirmação de toggle ativo/inativo
  const [activeTarget, setActiveTarget] = useState<Member | null>(null);

  const fetchMembers = useCallback(() => {
    authFetch(`${apiUrl}/admin/members`)
      .then((r) => r.json())
      .then((data) => { setMembers(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError("Não foi possível carregar os membros."); setLoading(false); });
  }, [apiUrl, authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !isAdmin) { history.replace("/"); return; }
    fetchMembers();
  }, [ready, isLoggedIn, isAdmin, history, fetchMembers]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleConfirmRole = async () => {
    if (!roleTarget) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await authFetch(`${apiUrl}/admin/members/${roleTarget.member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: roleTarget.nextRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.message ?? "Erro ao alterar role.");
        return;
      }
      setRoleTarget(null);
      fetchMembers();
    } catch {
      setActionError("Erro inesperado.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmActive = async () => {
    if (!activeTarget) return;
    setActionLoading(true);
    setActionError("");
    try {
      const res = await authFetch(`${apiUrl}/admin/members/${activeTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !activeTarget.isActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.message ?? "Erro ao alterar status.");
        return;
      }
      setActiveTarget(null);
      fetchMembers();
    } catch {
      setActionError("Erro inesperado.");
    } finally {
      setActionLoading(false);
    }
  };

  if (!ready || !isLoggedIn || !isAdmin) {
    return (
      <Layout title="Admin">
        <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout title="Painel Admin" description="Gestão de membros e finanças da Codaqui">
      <Container maxWidth="lg" sx={{ py: 6 }}>

        {/* ── Header ── */}
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 4, flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Painel Administrativo</Typography>
            <Typography variant="body2" color="text.secondary">
              Gerencie membros, roles e acesse os módulos financeiros.
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button variant="outlined" size="small" startIcon={<ReceiptLongIcon />} href="/admin/reembolsos">
              Reembolsos
            </Button>
            <Button variant="outlined" size="small" startIcon={<CompareArrowsIcon />} href="/admin/transferencias">
              Transferências
            </Button>
            <Button variant="outlined" size="small" startIcon={<AccountBalanceIcon />} href="/transparencia">
              Transparência
            </Button>
          </Box>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Typography variant="h6" fontWeight={700} gutterBottom>
          Membros ({members.length})
        </Typography>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Membro</TableCell>
                  <TableCell>GitHub</TableCell>
                  <TableCell>Role atual</TableCell>
                  <TableCell>Desde</TableCell>
                  <TableCell align="center">Ativo</TableCell>
                  <TableCell align="center">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id} sx={{ opacity: m.isActive ? 1 : 0.5 }}>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar src={m.avatarUrl} alt={m.name} sx={{ width: 32, height: 32 }} />
                        <Typography variant="body2" fontWeight={600}>{m.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">@{m.githubHandle}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={ROLE_LABEL[m.role]}
                        size="small"
                        color={roleChipColor(m.role)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(m.joinedAt).toLocaleDateString("pt-BR")}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title={m.isActive ? "Desativar membro" : "Reativar membro"}>
                        <Switch
                          checked={m.isActive}
                          onChange={() => { setActiveTarget(m); setActionError(""); }}
                          size="small"
                          color={m.isActive ? "success" : "default"}
                        />
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right" sx={{ minWidth: 180 }}>
                      <Select
                        value={m.role}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: "0.8rem", minWidth: 160 }}
                        onChange={(e) => {
                          const next = e.target.value as Role;
                          if (next !== m.role) {
                            setRoleTarget({ member: m, nextRole: next });
                            setActionError("");
                          }
                        }}
                      >
                        {ALL_ROLES.map((r) => (
                          <MenuItem key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Container>

      {/* ── Modal: Alterar Role ── */}
      <ModalConfirm
        open={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        title={`Alterar role de @${roleTarget?.member.githubHandle}?`}
        description={
          roleTarget && (
            <>
              Role atual: <strong>{ROLE_LABEL[roleTarget.member.role]}</strong>
              {" → "}
              Nova role: <strong>{ROLE_LABEL[roleTarget.nextRole]}</strong>
              {roleTarget.nextRole === "finance-analyzer" && (
                <> — concede acesso ao painel financeiro.</>
              )}
              {roleTarget.nextRole === "admin" && (
                <> — concede acesso administrativo total.</>
              )}
              {roleTarget.nextRole === "membro" && (
                <> — remove todos os privilégios administrativos.</>
              )}
            </>
          )
        }
        variant={
          roleTarget?.nextRole === "admin"
            ? "error"
            : roleTarget?.nextRole === "finance-analyzer"
            ? "warning"
            : "info"
        }
        confirmLabel="Alterar role"
        loading={actionLoading}
        error={actionError}
        onConfirm={handleConfirmRole}
      />

      {/* ── Modal: Ativar / Desativar ── */}
      <ModalConfirm
        open={!!activeTarget}
        onClose={() => setActiveTarget(null)}
        title={activeTarget?.isActive ? `Desativar @${activeTarget?.githubHandle}?` : `Reativar @${activeTarget?.githubHandle}?`}
        description={
          activeTarget?.isActive
            ? "O membro perderá acesso imediato à plataforma."
            : "O membro recuperará acesso à plataforma."
        }
        variant={activeTarget?.isActive ? "error" : "success"}
        confirmLabel={activeTarget?.isActive ? "Desativar" : "Reativar"}
        loading={actionLoading}
        error={actionError}
        onConfirm={handleConfirmActive}
      />
    </Layout>
  );
}
