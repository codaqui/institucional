import React, { useEffect, useCallback, useMemo, useState } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import EditIcon from "@mui/icons-material/Edit";
import AdminDataTable from "../../components/AdminDataTable";
import ModalConfirm from "../../components/ModalConfirm";
import AdminNavbar from "../../components/AdminNavbar";
import { useAuth } from "../../hooks/useAuth";
import { parseAuthJson, extractErrorMessage } from "../../hooks/authFetchHelpers";

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
const PAGE_SIZE = 20;

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
  const { ready, isLoggedIn, isAdmin, isFinanceAnalyzer, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const history = useHistory();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  // ── ModalConfirm state ────────────────────────────────────────────────────
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  // Confirmação de troca de role
  const [roleTarget, setRoleTarget] = useState<{ member: Member; nextRole: Role } | null>(null);
  // Confirmação de toggle ativo/inativo
  const [activeTarget, setActiveTarget] = useState<Member | null>(null);
  // Edição de dados do membro
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editLinkedin, setEditLinkedin] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchMembers = useCallback(async () => {
    if (!isAdmin) {
      setMembers([]);
      setLoading(false);
      setError("");
      return;
    }
    try {
      const res = await authFetch(`${apiUrl}/admin/members`);
      const data = await parseAuthJson<Member[]>(res, setError);
      if (!data) {
        setLoading(false);
        return;
      }
      setMembers(data);
      setError("");
    } catch {
      setError("Não foi possível carregar os membros.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authFetch, isAdmin]);

  useEffect(() => {
    const canAccess = isAdmin || isFinanceAnalyzer;
    if (!ready) return;
    if (!isLoggedIn || !canAccess) { history.replace("/"); return; }
    fetchMembers();
  }, [ready, isLoggedIn, isAdmin, isFinanceAnalyzer, history, fetchMembers]);

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
        setActionError(await extractErrorMessage(res, "Erro ao alterar role."));
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
        setActionError(await extractErrorMessage(res, "Erro ao alterar status."));
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

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    setEditError("");
    try {
      const body: Record<string, string> = {};
      if (editName.trim()) body.name = editName.trim();
      if (editBio.trim()) body.bio = editBio.trim();
      if (editLinkedin.trim()) body.linkedinUrl = editLinkedin.trim();
      const res = await authFetch(`${apiUrl}/admin/members/${editTarget.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setEditError(await extractErrorMessage(res, "Erro ao salvar alterações."));
        return;
      }
      setEditTarget(null);
      fetchMembers();
    } catch {
      setEditError("Erro inesperado.");
    } finally {
      setEditSaving(false);
    }
  };

  const canAccess = isAdmin || isFinanceAnalyzer;
  const filteredMembers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return members;
    return members.filter((member) => {
      const roleLabel = ROLE_LABEL[member.role].toLowerCase();
      return (
        member.name.toLowerCase().includes(term) ||
        member.githubHandle.toLowerCase().includes(term) ||
        roleLabel.includes(term)
      );
    });
  }, [members, searchTerm]);
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const pagedMembers = filteredMembers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  if (!ready || !isLoggedIn || !canAccess) {
    return (
      <Layout title="Admin">
        <Box sx={{ display: "flex", justifyContent: "center", pt: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  let modalVariant: "error" | "warning" | "info" = "info";
  if (roleTarget?.nextRole === "admin") {
    modalVariant = "error";
  } else if (roleTarget?.nextRole === "finance-analyzer") {
    modalVariant = "warning";
  }

  return (
    <Layout title="Painel Admin" description="Gestão de membros e finanças da Codaqui">
      <Container maxWidth="lg" sx={{ py: 6 }}>

        {/* ── Header ── */}
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 2 }}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Painel Administrativo</Typography>
            <Typography variant="body2" color="text.secondary">
              Gerencie membros, roles e acesse os módulos financeiros.
            </Typography>
          </Box>
        </Box>

        <AdminNavbar active="/admin" />

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        <Typography variant="h6" fontWeight={700} gutterBottom>
          Membros ({filteredMembers.length})
        </Typography>

        {!isAdmin ? (
          <Alert severity="info" sx={{ mb: 3 }}>
            Seu perfil pode acessar os módulos financeiros do painel. A gestão de membros permanece restrita a administradores.
          </Alert>
        ) : loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Buscar por nome, @github ou role"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </Box>
            <AdminDataTable
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              table={(
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
                    {pagedMembers.map((m) => (
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
                        <TableCell align="center">
                          <Tooltip title="Editar nome / bio / LinkedIn">
                            <IconButton
                              size="small"
                              aria-label="editar membro"
                              onClick={() => {
                                setEditTarget(m);
                                setEditName(m.name ?? "");
                                setEditBio("");
                                setEditLinkedin("");
                                setEditError("");
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
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
                    {pagedMembers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                          Nenhum membro encontrado para o filtro atual.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            />
          </>
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
        variant={modalVariant}
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

      {/* ── Dialog: Editar dados do membro ── */}
      <Dialog open={!!editTarget} onClose={() => setEditTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Editar dados de @{editTarget?.githubHandle}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Nome"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              size="small"
              fullWidth
              helperText="Deixe em branco para não alterar"
            />
            <TextField
              label="Bio"
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              size="small"
              fullWidth
              multiline
              minRows={2}
              helperText="Deixe em branco para não alterar"
            />
            <TextField
              label="LinkedIn URL"
              value={editLinkedin}
              onChange={(e) => setEditLinkedin(e.target.value)}
              size="small"
              fullWidth
              placeholder="https://linkedin.com/in/..."
              helperText="Deixe em branco para não alterar"
            />
            {editError && <Alert severity="error">{editError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTarget(null)} disabled={editSaving}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={editSaving || (!editName.trim() && !editBio.trim() && !editLinkedin.trim())}
            startIcon={editSaving ? <CircularProgress size={14} /> : undefined}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
