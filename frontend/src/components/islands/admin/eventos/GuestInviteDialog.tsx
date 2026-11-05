import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { QRCodeSVG } from "qrcode.react";
import type { ManagedEvent } from "./types";

interface GuestInviteDialogProps {
  event: ManagedEvent | null;
  onClose: () => void;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

export default function GuestInviteDialog({ event, onClose, authFetch }: Readonly<GuestInviteDialogProps>) {
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!event) return;
    setInviteUrl("");
    setError("");
    setLoading(true);
    authFetch(`/events/${event.id}/guest-invites`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Não foi possível gerar o convite.");
        return res.json() as Promise<{ inviteUrl: string }>;
      })
      .then(({ inviteUrl }) => setInviteUrl(new URL(inviteUrl, window.location.origin).toString()))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [event, authFetch]);

  return (
    <Dialog open={Boolean(event)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Convidado — link e QR</DialogTitle>
      <DialogContent>
        {loading && <Typography>Gerando convite…</Typography>}
        {error && <Alert severity="error">{error}</Alert>}
        {inviteUrl && (
          <Box sx={{ display: "grid", justifyItems: "center", gap: 2, mt: 1 }}>
            <Box role="img" aria-label="QR Code do convite" sx={{ p: 2, bgcolor: "background.paper" }}>
              <QRCodeSVG value={inviteUrl} size={200} />
            </Box>
            <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{inviteUrl}</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {inviteUrl && (
          <Button onClick={() => void navigator.clipboard.writeText(inviteUrl)}>Copiar link</Button>
        )}
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
