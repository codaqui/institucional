import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import MuiIslandProvider from "../../MuiIslandProvider";
import PageContainer from "../ui/PageContainer";
import PaginationControls from "../../ui/PaginationControls";
import { useAuth } from "../../../../lib/use-auth";
import { extractErrorMessage, parseAuthJson } from "../../../../lib/auth-fetch-helpers";
import { DEFAULT_PAGE_SIZE, rangeLabel } from "../../../../lib/pagination";
import type { PaginatedResponse } from "../../../../lib/pagination";
import AnnouncementEditorDialog from "./AnnouncementEditorDialog";
import type { Announcement, AnnouncementInput } from "./types";

function AnnouncementsAdminInner() {
  const { ready, isLoggedIn, isAdmin, authFetch } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [feedback, setFeedback] = useState<{ severity: "success" | "error"; message: string } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [editorError, setEditorError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(DEFAULT_PAGE_SIZE) });
      const response = await authFetch(`/announcements/admin?${params.toString()}`);
      const result = await parseAuthJson<PaginatedResponse<Announcement>>(response, setLoadError);
      if (!result) return;
      setItems(Array.isArray(result.data) ? result.data : []);
      setTotal(result.total ?? 0);
      setTotalPages(result.totalPages ?? 0);
    } finally {
      setLoading(false);
    }
  }, [authFetch, page]);

  useEffect(() => {
    if (ready && isLoggedIn && isAdmin) void load();
  }, [ready, isLoggedIn, isAdmin, load]);

  const save = async (input: AnnouncementInput) => {
    setSaving(true);
    setEditorError("");
    try {
      const payload = {
        ...input,
        linkUrl: input.linkUrl.trim() || null,
        linkLabel: input.linkLabel.trim() || null,
        startsAt: input.startsAt || null,
        endsAt: input.endsAt || null,
      };
      const path = editing ? `/announcements/admin/${editing.id}` : "/announcements/admin";
      const response = await authFetch(path, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setEditorError(await extractErrorMessage(response, "Não foi possível salvar o anúncio."));
        return;
      }
      setEditorOpen(false);
      setFeedback({ severity: "success", message: editing ? "Anúncio atualizado." : "Anúncio criado." });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (announcement: Announcement) => {
    if (!window.confirm(`Desativar o anúncio “${announcement.text}”?`)) return;
    setBusyId(announcement.id);
    setFeedback(null);
    try {
      const response = await authFetch(`/announcements/admin/${announcement.id}`, { method: "DELETE" });
      if (!response.ok) {
        setFeedback({ severity: "error", message: await extractErrorMessage(response, "Erro ao desativar.") });
        return;
      }
      setFeedback({ severity: "success", message: "Anúncio desativado. O histórico foi preservado." });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageContainer>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, flexWrap: "wrap", mb: 3 }}>
        <Box>
          <Typography component="h1" variant="h4" sx={{ fontWeight: 800 }}>Anúncios</Typography>
          <Typography color="text.secondary">
            Crie avisos institucionais exibidos no portal por snapshot público.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditing(null);
            setEditorError("");
            setEditorOpen(true);
          }}
        >
          Novo anúncio
        </Button>
      </Box>

      {loadError && <Alert severity="error" sx={{ mb: 2 }}>{loadError}</Alert>}
      {feedback && <Alert severity={feedback.severity} sx={{ mb: 2 }}>{feedback.message}</Alert>}
      {loading ? <CircularProgress aria-label="Carregando anúncios" /> : null}
      {!loading && items.length === 0 ? (
        <Alert severity="info">Nenhum anúncio cadastrado. Crie o primeiro para orientar os visitantes.</Alert>
      ) : null}
      <Stack spacing={2}>
        {items.map((announcement) => (
          <Card key={announcement.id} variant="outlined">
            <CardContent>
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
                <Chip size="small" variant="outlined" label={announcement.severity} />
                <Chip size="small" variant="outlined" label={announcement.active ? "Ativo" : "Inativo"} />
                {announcement.endsAt && new Date(announcement.endsAt) <= new Date() ? (
                  <Chip size="small" variant="outlined" label="Janela encerrada" />
                ) : null}
              </Box>
              <Typography sx={{ overflowWrap: "anywhere" }}>{announcement.text}</Typography>
              {announcement.linkUrl && announcement.linkLabel ? (
                <Button
                  size="small"
                  href={announcement.linkUrl}
                  target={announcement.linkUrl.includes("://") ? "_blank" : undefined}
                  rel={announcement.linkUrl.includes("://") ? "noopener noreferrer" : undefined}
                >
                  {announcement.linkLabel}
                </Button>
              ) : null}
              <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setEditing(announcement);
                    setEditorError("");
                    setEditorOpen(true);
                  }}
                >
                  Editar
                </Button>
                {announcement.active ? (
                  <Button
                    size="small"
                    color="warning"
                    disabled={busyId === announcement.id}
                    onClick={() => void deactivate(announcement)}
                  >
                    {busyId === announcement.id ? "Desativando…" : "Desativar"}
                  </Button>
                ) : null}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Stack>
      {total > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 2 }}>
          {rangeLabel(page, DEFAULT_PAGE_SIZE, total)}
        </Typography>
      )}
      <PaginationControls page={page} totalPages={totalPages} onChange={setPage} itemLabel="anúncios" />
      <AnnouncementEditorDialog
        open={editorOpen}
        announcement={editing}
        saving={saving}
        error={editorError}
        onClose={() => setEditorOpen(false)}
        onSave={save}
      />
    </PageContainer>
  );
}

export default function AnnouncementsAdminApp() {
  return (
    <MuiIslandProvider>
      <AnnouncementsAdminInner />
    </MuiIslandProvider>
  );
}
