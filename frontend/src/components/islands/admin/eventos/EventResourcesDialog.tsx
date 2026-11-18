import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { extractErrorMessage } from "../../../../lib/auth-fetch-helpers";
import { slugifyTag } from "../../../../lib/slugify-tag";
import { FEATURE_LABEL, type HubRow } from "./types";

interface EventResourcesDialogProps {
  open: boolean;
  row: HubRow | null;
  onClose: () => void;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onCreated?: (call: { id: string }) => void;
}

export default function EventResourcesDialog({
  open,
  row,
  onClose,
  authFetch,
  onCreated,
}: Readonly<EventResourcesDialogProps>) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [communityProjectKey, setCommunityProjectKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState("");

  useEffect(() => {
    if (!open || !row) return;
    const baseSlug = row.kind === "internal" ? row.event.slug : slugifyTag(row.event.title);
    setSlug(`${baseSlug}-c4p`);
    setName(`C4P — ${row.event.title}`);
    setCommunityProjectKey(
      row.kind === "internal"
        ? row.event.communityProjectKey
        : (row.communityProjectKey ?? ""),
    );
    setSaving(false);
    setError("");
    setCreatedId("");
  }, [open, row]);

  if (!row) return null;

  const activate = async () => {
    setSaving(true);
    setError("");
    const eventKey = row.kind === "external" ? `${row.event.sourceKey}:${row.event.id}` : "";
    const path = row.kind === "internal"
      ? `/events/${row.event.id}/c4p`
      : `/events/external/${eventKey}/c4p`;
    const payload: Record<string, string> = { slug: slug.trim(), name: name.trim() };
    if (row.kind === "external") {
      payload.communityProjectKey = communityProjectKey.trim();
      payload.title = row.event.title;
      payload.startAt = row.event.startAt;
    }
    const response = await authFetch(path, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      setError(await extractErrorMessage(response, "Não foi possível configurar o C4P."));
      setSaving(false);
      return;
    }
    const call = await response.json() as { id: string };
    setCreatedId(call.id);
    setSaving(false);
    onCreated?.(call);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Recursos — {row.event.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Configure capacidades opcionais sem duplicar os fluxos existentes da atividade.
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {row.kind === "internal" ? (
              <>
                <Chip label={`${row.event.ticketTypes.length} tipos de ingresso`} variant="outlined" />
                <Chip label={`${row.event.staff.length} ${row.event.staff.length === 1 ? "pessoa" : "pessoas"} na equipe`} variant="outlined" />
              </>
            ) : row.features.length > 0 ? (
              row.features.map((feature) => (
                <Chip key={feature} label={FEATURE_LABEL[feature] ?? feature} variant="outlined" />
              ))
            ) : (
              <Chip label="Nenhum recurso ativo" variant="outlined" />
            )}
          </Stack>
          {row.kind === "internal" ? (
            <Button
              size="small"
              variant="text"
              href={`/admin/eventos-checkin?event=${encodeURIComponent(`internal:${row.event.id}`)}`}
              sx={{ alignSelf: "flex-start" }}
            >
              Abrir check-in e certificados existentes
            </Button>
          ) : (
            <Button
              size="small"
              variant="text"
              href={`/admin/overrides?tab=2&sourceKey=${encodeURIComponent(row.event.sourceKey)}&eventId=${encodeURIComponent(row.event.id)}`}
              sx={{ alignSelf: "flex-start" }}
            >
              Configurar demais recursos
            </Button>
          )}
          <Divider />
          <Typography variant="h6" component="h2">Chamada de trabalhos (C4P)</Typography>
          {createdId ? (
            <Alert
              severity="success"
              action={
                <Button color="inherit" href={`/admin/c4p/detalhe?id=${createdId}`}>
                  Abrir curadoria
                </Button>
              }
            >
              C4P configurado. Uma chamada existente é reutilizada quando aplicável, sem duplicação.
            </Alert>
          ) : (
            <>
              <TextField
                label="Slug da chamada"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                size="small"
                fullWidth
                required
              />
              <TextField
                label="Nome da chamada"
                value={name}
                onChange={(event) => setName(event.target.value)}
                size="small"
                fullWidth
                required
              />
              {row.kind === "external" && !row.communityProjectKey && (
                <TextField
                  label="Comunidade (project key)"
                  value={communityProjectKey}
                  onChange={(event) => setCommunityProjectKey(event.target.value)}
                  size="small"
                  fullWidth
                  required
                />
              )}
              {error && <Alert severity="error">{error}</Alert>}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
        {!createdId && (
          <Button
            variant="contained"
            onClick={() => void activate()}
            disabled={saving || slug.trim().length < 2 || name.trim().length < 3 || (row.kind === "external" && !communityProjectKey.trim())}
          >
            {saving ? "Ativando…" : "Ativar C4P"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
