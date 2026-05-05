import React, { useEffect, useState, useCallback } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddBusinessIcon from "@mui/icons-material/AddBusiness";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useAuth } from "../../hooks/useAuth";
import { parseAuthJson } from "../../hooks/authFetchHelpers";
import ModalConfirm from "../../components/ModalConfirm";
import { formatDocument, stripToDigits } from "../../utils/document";

interface Vendor {
  id: string;
  name: string;
  document: string | null;
  website: string | null;
  isActive: boolean;
  accountId: string;
  account?: { id: string; name: string; type: string };
  createdAt: string;
  paymentCount?: number;
  receiptCount?: number;
}

interface VendorForm {
  name: string;
  document: string;
  website: string;
}

const emptyForm: VendorForm = { name: "", document: "", website: "" };

export default function FornecedoresPage(): React.JSX.Element {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";
  const history = useHistory();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorForm>(emptyForm);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchVendors = useCallback(async () => {
    try {
      const res = await authFetch(`${apiUrl}/vendors/with-counters`);
      const data = await parseAuthJson<Vendor[]>(res, setError);
      if (!data) {
        setLoading(false);
        return;
      }
      setVendors(data);
      setError("");
    } catch {
      setError("Não foi possível carregar fornecedores.");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, authFetch]);

  useEffect(() => {
    if (!ready) return;
    if (!isLoggedIn || !isAdmin) {
      history.replace("/");
      return;
    }
    fetchVendors();
  }, [ready, isLoggedIn, isAdmin, history, fetchVendors]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSubmitError("");
    setDialogOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditingId(v.id);
    setForm({
      name: v.name,
      document: stripToDigits(v.document ?? ""),
      website: v.website ?? "",
    });
    setSubmitError("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setSubmitError("Nome é obrigatório.");
      return;
    }
    setSubmitLoading(true);
    setSubmitError("");

    const body: Record<string, string | undefined> = {
      name: form.name.trim(),
      document: form.document.trim() || undefined,
      website: form.website.trim() || undefined,
    };

    try {
      const url = editingId ? `${apiUrl}/vendors/${editingId}` : `${apiUrl}/vendors`;
      const method = editingId ? "PATCH" : "POST";
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao salvar.");
      }
      setDialogOpen(false);
      fetchVendors();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Erro desconhecido.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      await authFetch(`${apiUrl}/vendors/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      fetchVendors();
    } catch {
      setDeleteId(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!ready || loading) {
    return (
      <Layout title="Fornecedores">
        <Container maxWidth="md" sx={{ py: 6, textAlign: "center" }}>
          <CircularProgress />
        </Container>
      </Layout>
    );
  }

  return (
    <Layout title="Fornecedores" description="Gestão de fornecedores da Codaqui">
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" fontWeight={800}>
            <AddBusinessIcon sx={{ mr: 1, verticalAlign: "middle" }} />
            Fornecedores
          </Typography>
          <Button variant="contained" startIcon={<AddBusinessIcon />} onClick={openCreate}>
            Novo Fornecedor
          </Button>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {vendors.length === 0 && !error && (
          <Alert severity="info">Nenhum fornecedor cadastrado.</Alert>
        )}

        <Grid container spacing={2}>
          {vendors.map((v) => (
            <Grid key={v.id} size={{ xs: 12, sm: 6 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Box>
                      <Typography variant="h6" fontWeight={700}>
                        {v.name}
                      </Typography>
                      {v.document && (
                        <Typography variant="body2" color="text.secondary">
                          {formatDocument(v.document)}
                        </Typography>
                      )}
                    </Box>
                    <Box>
                      <IconButton size="small" aria-label="Editar" onClick={() => openEdit(v)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Desativar"
                        color="error"
                        onClick={() => setDeleteId(v.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  {v.website && (
                    <Chip
                      size="small"
                      icon={<OpenInNewIcon />}
                      label={v.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      component="a"
                      href={v.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      clickable
                      sx={{ mt: 1 }}
                    />
                  )}

                  {v.account && (
                    <Typography variant="caption" display="block" color="text.secondary" mt={1}>
                      Conta: {v.account.name}
                    </Typography>
                  )}

                  {(v.paymentCount !== undefined || v.receiptCount !== undefined) && (
                    <Box sx={{ display: "flex", gap: 0.75, mt: 1.5, flexWrap: "wrap" }}>
                      <Chip
                        size="small"
                        color={(v.paymentCount ?? 0) > 0 ? "secondary" : "default"}
                        variant="outlined"
                        label={`${v.paymentCount ?? 0} pagamento${(v.paymentCount ?? 0) === 1 ? "" : "s"}`}
                      />
                      <Chip
                        size="small"
                        color={(v.receiptCount ?? 0) > 0 ? "success" : "default"}
                        variant="outlined"
                        label={`${v.receiptCount ?? 0} recebimento${(v.receiptCount ?? 0) === 1 ? "" : "s"}`}
                      />
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Dialog de criação/edição */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingId ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Nome"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="CNPJ / CPF"
              value={formatDocument(form.document)}
              onChange={(e) => {
                const digits = stripToDigits(e.target.value).slice(0, 14);
                setForm({ ...form, document: digits });
              }}
              margin="normal"
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              helperText={
                form.document.length > 0 && form.document.length !== 11 && form.document.length !== 14
                  ? `${form.document.length} dígitos — CPF tem 11, CNPJ tem 14`
                  : undefined
              }
              inputProps={{ inputMode: "numeric" }}
            />
            <TextField
              fullWidth
              label="Website"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              margin="normal"
              placeholder="https://example.com"
            />
            {submitError && <Alert severity="error" sx={{ mt: 1 }}>{submitError}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)} disabled={submitLoading}>
              Cancelar
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={submitLoading}>
              {submitLoading ? <CircularProgress size={20} /> : "Salvar"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Confirmação de exclusão */}
        <ModalConfirm
          open={!!deleteId}
          title="Desativar fornecedor?"
          description="O fornecedor será desativado e não aparecerá mais nas listagens."
          onConfirm={handleDelete}
          onClose={() => setDeleteId(null)}
          loading={deleteLoading}
        />
      </Container>
    </Layout>
  );
}
