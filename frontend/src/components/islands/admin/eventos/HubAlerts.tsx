/**
 * Alertas de feedback do hub (snapshot, publicação e salvamento de evento).
 * Port de `src/pages/admin/eventos.tsx` (Docusaurus) — `Link` virou `<a>`.
 */

import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { ManagedEvent, SnapshotResult } from "./types";
import { publicEventUrl } from "./types";

interface HubAlertsProps {
  snapshotResult: SnapshotResult | null;
  snapshotError: string;
  publishSuccess: ManagedEvent | null;
  saveSuccess: { event: ManagedEvent; mode: "create" | "edit" } | null;
  onCloseSnapshotError: () => void;
  onCloseSnapshotResult: () => void;
  onClosePublishSuccess: () => void;
  onCloseSaveSuccess: () => void;
}

export default function HubAlerts({
  snapshotResult,
  snapshotError,
  publishSuccess,
  saveSuccess,
  onCloseSnapshotError,
  onCloseSnapshotResult,
  onClosePublishSuccess,
  onCloseSaveSuccess,
}: Readonly<HubAlertsProps>): React.JSX.Element {
  return (
    <>
      {snapshotError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={onCloseSnapshotError}>
          {snapshotError}
        </Alert>
      )}
      {snapshotResult === "skipped" && (
        <Alert severity="info" sx={{ mb: 3 }} onClose={onCloseSnapshotResult}>
          Nada a sincronizar — o snapshot de eventos próprios já está atualizado.
        </Alert>
      )}
      {snapshotResult && snapshotResult !== "skipped" && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          onClose={onCloseSnapshotResult}
          action={
            <Button
              color="inherit"
              size="small"
              endIcon={<OpenInNewIcon />}
              href={snapshotResult.prUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {snapshotResult.prNumber ? `PR #${snapshotResult.prNumber}` : "Abrir PR"}
            </Button>
          }
        >
          Snapshot enviado via Pull Request — o merge é automático e a página de eventos
          leva alguns minutos para rebuildar.
        </Alert>
      )}
      {publishSuccess && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          onClose={onClosePublishSuccess}
          action={
            <Button
              component="a"
              href={publicEventUrl(publishSuccess.slug)}
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
              size="small"
              endIcon={<OpenInNewIcon />}
            >
              Ver página pública
            </Button>
          }
        >
          Evento <strong>{publishSuccess.title}</strong> publicado com sucesso.
        </Alert>
      )}
      {saveSuccess && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          onClose={onCloseSaveSuccess}
          action={
            <Button
              component="a"
              href={publicEventUrl(saveSuccess.event.slug)}
              target="_blank"
              rel="noopener noreferrer"
              color="inherit"
              size="small"
              endIcon={<OpenInNewIcon />}
            >
              Ver página do evento
            </Button>
          }
        >
          Evento <strong>{saveSuccess.event.title}</strong>{" "}
          {saveSuccess.mode === "create" ? "criado" : "atualizado"} com sucesso.
        </Alert>
      )}
    </>
  );
}
