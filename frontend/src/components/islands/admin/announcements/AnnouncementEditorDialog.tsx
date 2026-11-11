import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Announcement, AnnouncementInput } from "./types";

interface AnnouncementEditorDialogProps {
  readonly open: boolean;
  readonly announcement: Announcement | null;
  readonly saving: boolean;
  readonly error: string;
  readonly onClose: () => void;
  readonly onSave: (input: AnnouncementInput) => Promise<void>;
}

const EMPTY_FORM: AnnouncementInput = {
  text: "",
  severity: "info",
  linkUrl: "",
  linkLabel: "",
  startsAt: "",
  endsAt: "",
  active: true,
};

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function validateText(text: string): string {
  const labelEnd = text.indexOf("](");
  const hasMarkdownLink = labelEnd > 0 && text.slice(0, labelEnd).includes("[") && text.indexOf(")", labelEnd + 2) > labelEnd + 2;
  return text.length < 3 || text.length > 280 || /[<>]/.test(text) || hasMarkdownLink
    ? "Use 3–280 caracteres, sem HTML ou Markdown."
    : "";
}

function validateLink(form: AnnouncementInput): string {
  if (form.linkUrl && !form.linkLabel?.trim()) return "Informe um rótulo para o link.";
  if (!form.linkUrl && form.linkLabel?.trim()) return "Remova o rótulo ou informe um link.";
  if (!form.linkUrl) return "";
  if (!form.linkUrl.includes("://") && !form.linkUrl.startsWith("//")) {
    return form.linkUrl.startsWith("/") ? "" : "Use um caminho interno iniciado por / ou uma URL HTTPS.";
  }
  let url: URL;
  try {
    url = new URL(form.linkUrl);
  } catch {
    return "Informe uma URL HTTPS válida.";
  }
  return url.protocol === "https:" && !url.username && !url.password
    ? ""
    : "O link externo deve usar HTTPS e não conter credenciais.";
}

function validateForm(form: AnnouncementInput, text: string): string {
  if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
    return "O fim da exibição deve ser posterior ao início.";
  }
  return validateText(text) || validateLink(form);
}

export default function AnnouncementEditorDialog({
  open,
  announcement,
  saving,
  error,
  onClose,
  onSave,
}: Readonly<AnnouncementEditorDialogProps>) {
  const [form, setForm] = useState<AnnouncementInput>(EMPTY_FORM);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(announcement ? {
      text: announcement.text,
      severity: announcement.severity,
      linkUrl: announcement.linkUrl ?? "",
      linkLabel: announcement.linkLabel ?? "",
      startsAt: toDateTimeLocal(announcement.startsAt),
      endsAt: toDateTimeLocal(announcement.endsAt),
      active: announcement.active,
    } : EMPTY_FORM);
    setValidationError("");
  }, [open, announcement]);

  const update = <K extends keyof AnnouncementInput>(key: K, value: AnnouncementInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = form.text.trim();
    const validation = validateForm(form, text);
    if (validation) {
      setValidationError(validation);
      return;
    }
    setValidationError("");
    await onSave({
      ...form,
      text,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : "",
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : "",
    });
  };

  let submitLabel = announcement ? "Salvar alterações" : "Criar anúncio";
  if (saving) submitLabel = "Salvando…";

  return (
    <Dialog open={open} onClose={() => !saving && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>{announcement ? "Editar anúncio" : "Novo anúncio"}</DialogTitle>
      <DialogContent>
        <Stack component="form" id="announcement-editor" onSubmit={submit} spacing={2} sx={{ mt: 1 }}>
          {(validationError || error) && <Alert severity="error">{validationError || error}</Alert>}
          <TextField
            label="Texto do anúncio"
            value={form.text}
            onChange={(event) => update("text", event.target.value)}
            required
            multiline
            minRows={3}
            fullWidth
            slotProps={{ htmlInput: { minLength: 3, maxLength: 280 } }}
            helperText="Texto simples, sem HTML ou Markdown."
          />
          <TextField
            select
            label="Severidade"
            value={form.severity}
            onChange={(event) => update("severity", event.target.value as AnnouncementInput["severity"])}
            fullWidth
          >
            <MenuItem value="info">Informação</MenuItem>
            <MenuItem value="success">Sucesso</MenuItem>
            <MenuItem value="warning">Atenção</MenuItem>
            <MenuItem value="error">Erro</MenuItem>
          </TextField>
          <TextField
            label="Link (opcional)"
            value={form.linkUrl}
            onChange={(event) => update("linkUrl", event.target.value)}
            fullWidth
            helperText="Caminho interno (/pagina) ou URL HTTPS."
          />
          <TextField
            label="Rótulo do link"
            value={form.linkLabel}
            onChange={(event) => update("linkLabel", event.target.value)}
            fullWidth
            slotProps={{ htmlInput: { maxLength: 60 } }}
          />
          <TextField
            label="Início da exibição (opcional)"
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) => update("startsAt", event.target.value)}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Fim da exibição (opcional)"
            type="datetime-local"
            value={form.endsAt}
            onChange={(event) => update("endsAt", event.target.value)}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControlLabel
            control={<Checkbox checked={form.active} onChange={(event) => update("active", event.target.checked)} />}
            label="Anúncio ativo"
          />
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2 }}>
            <Typography variant="overline" color="text.secondary">Prévia do anúncio</Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1, mb: 1 }}>
              <Chip size="small" variant="outlined" label={form.severity} />
              <Chip size="small" variant="outlined" label={form.active ? "Ativo" : "Inativo"} />
            </Box>
            <Typography>{form.text || "O texto do anúncio aparecerá aqui."}</Typography>
            {form.linkUrl && form.linkLabel ? (
              <Button size="small" href={form.linkUrl} target={form.linkUrl.includes("://") ? "_blank" : undefined} rel={form.linkUrl.includes("://") ? "noopener noreferrer" : undefined}>
                {form.linkLabel}
              </Button>
            ) : null}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button type="button" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button type="submit" form="announcement-editor" variant="contained" disabled={saving}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
