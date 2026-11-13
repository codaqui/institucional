import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../ui/PageContainer";
import PaginationControls from "../../ui/PaginationControls";
import {
  extractErrorMessage,
  parseAuthJson,
} from "../../../../lib/auth-fetch-helpers";
import { DEFAULT_PAGE_SIZE, rangeLabel, type PaginatedResponse } from "../../../../lib/pagination";
import { useAuth } from "../../../../lib/use-auth";
import type { ManageCall } from "./c4p-admin-types";

const STATUS_LABEL: Record<ManageCall["status"], string> = {
  draft: "Rascunho",
  open: "Aberta",
  closed: "Fechada",
};

function C4pAdminInner() {
  const { ready, isLoggedIn, authFetch } = useAuth();
  const [calls, setCalls] = useState<ManageCall[] | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: "success" | "error"; text: string } | null>(null);

  const load = useCallback(
    async (targetPage: number) => {
      setLoadError("");
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(DEFAULT_PAGE_SIZE),
      });
      const response = await authFetch(`/c4p/manage/calls?${params}`);
      const result = await parseAuthJson<PaginatedResponse<ManageCall>>(response, setLoadError);
      if (result) {
        setCalls(result.data);
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setPage(result.page);
      }
    },
    [authFetch],
  );

  useEffect(() => {
    if (ready && isLoggedIn) void load(1);
  }, [ready, isLoggedIn, load]);

  const create = async () => {
    setSaving(true);
    setFeedback(null);
    const response = await authFetch("/c4p/manage/calls", {
      method: "POST",
      body: JSON.stringify({ slug: slug.trim(), name: name.trim() }),
    });
    if (!response.ok) {
      setFeedback({
        severity: "error",
        text: await extractErrorMessage(response, "Não foi possível criar a campanha."),
      });
      setSaving(false);
      return;
    }
    setDialogOpen(false);
    setSlug("");
    setName("");
    setSaving(false);
    setFeedback({ severity: "success", text: "Campanha criada em rascunho." });
    await load(1);
  };

  if (!ready || !isLoggedIn) {
    return (
      <PageContainer>
        <CircularProgress aria-label="Carregando" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack spacing={3}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, flexWrap: "wrap" }}>
          <Typography variant="h5" component="h1">C4P — Chamadas de Trabalhos</Typography>
          <Button variant="contained" onClick={() => setDialogOpen(true)}>
            Nova campanha
          </Button>
        </Box>
        {loadError ? <Alert severity="error">{loadError}</Alert> : null}
        {feedback ? <Alert severity={feedback.severity}>{feedback.text}</Alert> : null}
        {calls === null ? (
          <CircularProgress aria-label="Carregando campanhas" />
        ) : calls.length === 0 ? (
          <Alert severity="info">Nenhuma campanha criada ainda.</Alert>
        ) : (
          <>
            <Stack spacing={2}>
              {calls.map((call) => (
                <Box
                  key={call.id}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    flexWrap: "wrap",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                  }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: "bold" }}>{call.name}</Typography>
                    <Typography color="text.secondary" variant="body2">
                      /c4p/{call.slug}
                      {typeof call.talksCount === "number"
                        ? ` · ${call.talksCount} propostas · ${call.evaluatorsActiveCount ?? 0} avaliadores`
                        : ""}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Chip
                      label={STATUS_LABEL[call.status]}
                      color={call.status === "open" ? "success" : call.status === "closed" ? "default" : "warning"}
                      size="small"
                    />
                    <Button
                      variant="outlined"
                      href={`/admin/c4p/detalhe?id=${encodeURIComponent(call.id)}`}
                    >
                      Gerenciar
                    </Button>
                  </Box>
                </Box>
              ))}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {rangeLabel(page, DEFAULT_PAGE_SIZE, total)}
            </Typography>
            <PaginationControls page={page} totalPages={totalPages} onChange={(next) => void load(next)} itemLabel="campanhas" />
          </>
        )}
      </Stack>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nova campanha C4P</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Slug (kebab-case, único)"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              helperText="Ex.: devpr-conf-2026. Não pode ser alterado depois."
              fullWidth
            />
            <TextField
              label="Nome da campanha"
              value={name}
              onChange={(event) => setName(event.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => void create()}
            disabled={saving || slug.trim().length < 2 || name.trim().length < 3}
          >
            {saving ? "Criando…" : "Criar"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}

export default function C4pAdminApp() {
  return (
    <MuiIslandProvider>
      <C4pAdminInner />
    </MuiIslandProvider>
  );
}
