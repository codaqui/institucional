import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";
import { extractErrorMessage } from "../../../lib/auth-fetch-helpers";
import type { MenteeMember } from "../../../lib/mentorship";

interface MenteeLinkDialogProps {
  sessionId: string;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onSaved: () => void;
}

export default function MenteeLinkDialog({ sessionId, authFetch, onClose, onSaved }: Readonly<MenteeLinkDialogProps>) {
  const [options, setOptions] = useState<MenteeMember[]>([]);
  const [selected, setSelected] = useState<MenteeMember | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadOptions = useCallback(async (search: string) => {
    setLoading(true);
    setError("");
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
    const response = await authFetch(`/mentorship/member-options${query}`);
    if (response.ok) {
      setOptions((await response.json()) as MenteeMember[]);
    } else {
      setError(await extractErrorMessage(response, "Não foi possível buscar membros."));
    }
    setLoading(false);
  }, [authFetch]);

  useEffect(() => {
    void loadOptions("");
  }, [loadOptions]);

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    setError("");
    const response = await authFetch(`/mentorship/sessions/${sessionId}/mentee`, {
      method: "POST",
      body: JSON.stringify({ memberId: selected.id }),
    });
    if (!response.ok) {
      setError(await extractErrorMessage(response, "Não foi possível vincular o participante."));
      setBusy(false);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="mentee-link-title">
      <DialogTitle id="mentee-link-title">Vincular participante</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Autocomplete
          options={options}
          value={selected}
          loading={loading}
          onChange={(_event, value) => setSelected(value)}
          onInputChange={(_event, value) => void loadOptions(value)}
          getOptionLabel={(option) => `${option.name} (@${option.githubHandle})`}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => <TextField {...params} label="Membro da plataforma" required />}
        />
      </DialogContent>
      <DialogActions>
        <Button type="button" disabled={busy} onClick={onClose}>Cancelar</Button>
        <Button type="button" variant="contained" disabled={busy || !selected} onClick={() => void save()}>
          Vincular participante
        </Button>
      </DialogActions>
    </Dialog>
  );
}
