import React, { useCallback, useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useAuth } from "../../hooks/useAuth";
import { parseAuthJson, extractErrorMessage } from "../../hooks/authFetchHelpers";
import ModalConfirm from "../ModalConfirm";

interface TemplateSummary {
  id: string;
  subject: string;
  isOverride: boolean;
  updatedAt: string | null;
}

interface TemplateDetail extends TemplateSummary {
  bodyMarkdown: string;
  variables: string[];
}

const TEMPLATE_LABELS: Record<string, string> = {
  "event-registration-confirmation": "Confirmação de inscrição",
  "event-reminder-d1": "Lembrete D-1",
  "event-post-event": "Pós-evento",
};

export default function EmailsTemplatesTab(): React.JSX.Element {
  const { authFetch } = useAuth();
  const [list, setList] = useState<TemplateSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<{ html: string; text: string } | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadList = useCallback(async () => {
    const res = await authFetch("/notifications/templates");
    const data = await parseAuthJson<TemplateSummary[]>(res, (msg) => setError(msg));
    if (data) setList(data);
  }, [authFetch]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(
    () => () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    },
    [],
  );

  const select = useCallback(
    async (id: string) => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
      setSelectedId(id);
      setError("");
      setFeedback("");
      setPreview(null);
      const res = await authFetch(`/notifications/templates/${id}`);
      const data = await parseAuthJson<TemplateDetail>(res, (msg) => setError(msg));
      if (!data) return;
      setDetail(data);
      setSubject(data.subject);
      setBody(data.bodyMarkdown);
    },
    [authFetch],
  );

  const requestPreview = useCallback(
    (nextSubject: string, nextBody: string) => {
      if (!selectedId) return;
      if (previewTimer.current) clearTimeout(previewTimer.current);
      previewTimer.current = setTimeout(async () => {
        const res = await authFetch(`/notifications/templates/${selectedId}/preview`, {
          method: "POST",
          body: JSON.stringify({ subject: nextSubject, bodyMarkdown: nextBody }),
        });
        const data = await parseAuthJson<{ html: string; text: string }>(res, () => undefined);
        if (data) setPreview(data);
      }, 400);
    },
    [authFetch, selectedId],
  );

  const save = async (): Promise<void> => {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    setFeedback("");
    try {
      const res = await authFetch(`/notifications/templates/${selectedId}`, {
        method: "PUT",
        body: JSON.stringify({ subject, bodyMarkdown: body }),
      });
      if (!res.ok) {
        setError(await extractErrorMessage(res, "Falha ao salvar."));
        return;
      }
      setFeedback("Template salvo.");
      await loadList();
    } catch {
      setError("Erro inesperado ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const restore = async (): Promise<void> => {
    if (!selectedId) return;
    setConfirmRestore(false);
    try {
      const res = await authFetch(`/notifications/templates/${selectedId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        setError(await extractErrorMessage(res, "Falha ao restaurar o padrão."));
        return;
      }
      setFeedback("Template restaurado para o padrão.");
      await loadList();
      await select(selectedId);
    } catch {
      setError("Erro inesperado ao restaurar o padrão.");
    }
  };

  const sendTest = async (): Promise<void> => {
    if (!selectedId) return;
    setFeedback("");
    setError("");
    try {
      const res = await authFetch(`/notifications/templates/${selectedId}/test`, { method: "POST" });
      if (!res.ok) {
        setError(await extractErrorMessage(res, "Falha ao enviar o teste."));
        return;
      }
      const data = await parseAuthJson<{ emailLogId: string }>(res, () => null);
      setFeedback(`E-mail de teste enviado (log ${data?.emailLogId ?? ""}).`);
    } catch {
      setError("Erro inesperado ao enviar o teste.");
    }
  };

  if (!list) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 4 }}>
        <Stack spacing={1}>
          {list.map((t) => (
            <Button
              key={t.id}
              variant={selectedId === t.id ? "contained" : "outlined"}
              onClick={() => select(t.id)}
              sx={{ justifyContent: "space-between", textTransform: "none" }}
            >
              <Stack alignItems="flex-start" textAlign="left">
                <span>{t.id}</span>
                {TEMPLATE_LABELS[t.id] ? (
                  <Typography variant="caption" component="span" sx={{ opacity: 0.8 }}>
                    {TEMPLATE_LABELS[t.id]}
                  </Typography>
                ) : null}
              </Stack>
              <Chip
                size="small"
                label={t.isOverride ? "Personalizado" : "Padrão"}
                color={t.isOverride ? "success" : "default"}
              />
            </Button>
          ))}
        </Stack>
      </Grid>
      <Grid size={{ xs: 12, md: 8 }}>
        {!detail ? (
          <Typography color="text.secondary">Selecione um template para editar.</Typography>
        ) : (
          <Stack spacing={2}>
            {error ? <Alert severity="error">{error}</Alert> : null}
            {feedback ? <Alert severity="success">{feedback}</Alert> : null}
            <TextField
              label="Assunto"
              value={subject}
              fullWidth
              onChange={(e) => {
                setSubject(e.target.value);
                requestPreview(e.target.value, body);
              }}
            />
            <TextField
              label="Corpo (Markdown)"
              value={body}
              fullWidth
              multiline
              minRows={10}
              slotProps={{ htmlInput: { sx: { fontFamily: "monospace" } } }}
              onChange={(e) => {
                setBody(e.target.value);
                requestPreview(subject, e.target.value);
              }}
            />
            <Box>
              <Typography variant="caption" color="text.secondary" component="div">
                Variáveis disponíveis:
              </Typography>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>
                {detail.variables.map((v) => (
                  <Chip key={v} size="small" variant="outlined" label={`{{${v}}}`} />
                ))}
              </Box>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={save} disabled={saving}>
                Salvar
              </Button>
              <Button variant="outlined" onClick={() => setConfirmRestore(true)} disabled={!detail.isOverride}>
                Restaurar padrão
              </Button>
              <Button variant="outlined" onClick={sendTest}>
                Enviar teste
              </Button>
            </Stack>
            {preview ? (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Preview (HTML)
                  </Typography>
                  {/* HTML já sanitizado server-side (sanitize-html no backend, Task 8) */}
                  <Box
                    component="div"
                    sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}
                    dangerouslySetInnerHTML={{ __html: preview.html }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Versão texto
                  </Typography>
                  <Box
                    component="pre"
                    sx={{ p: 2, border: 1, borderColor: "divider", borderRadius: 2, whiteSpace: "pre-wrap", m: 0 }}
                  >
                    {preview.text}
                  </Box>
                </Grid>
              </Grid>
            ) : null}
          </Stack>
        )}
      </Grid>
      <ModalConfirm
        open={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        title="Restaurar template padrão"
        description="O override personalizado será removido e o template padrão voltará a ser usado. Continuar?"
        confirmLabel="Restaurar"
        variant="warning"
        onConfirm={restore}
      />
    </Grid>
  );
}
