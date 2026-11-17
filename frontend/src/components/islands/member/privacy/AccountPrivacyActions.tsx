import { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ModalConfirm from "../../admin/ui/ModalConfirm";
import { extractErrorMessage } from "../../../../lib/auth-fetch-helpers";
import { useAuth } from "../../../../lib/use-auth";

interface DeletionRequest {
  readonly id: string;
  readonly status: "pending" | "completed" | "canceled";
  readonly requestedAt: string;
}

export default function AccountPrivacyActions(): React.JSX.Element {
  const { ready, isLoggedIn, authFetch } = useAuth();
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const [confirmAction, setConfirmAction] = useState<"request" | "cancel" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!ready || !isLoggedIn) return;
    let active = true;
    void authFetch("/members/me/deletion-request")
      .then(async (response) => {
        if (!response.ok) throw new Error(await extractErrorMessage(response, "Não foi possível carregar a solicitação."));
        return response.json() as Promise<DeletionRequest | null>;
      })
      .then((value) => {
        if (active) setDeletionRequest(value);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar a solicitação.");
      })
      .finally(() => {
        if (active) setLoadingRequest(false);
      });
    return () => { active = false; };
  }, [ready, isLoggedIn, authFetch]);

  const exportData = async () => {
    setExporting(true);
    setError("");
    setSuccess("");
    try {
      const response = await authFetch("/members/me/export");
      if (!response.ok) throw new Error(await extractErrorMessage(response, "Não foi possível exportar seus dados."));
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? "codaqui-dados.json";
      const url = URL.createObjectURL(blob);
      try {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
      } finally {
        URL.revokeObjectURL(url);
      }
      setSuccess("Exportação preparada com sucesso.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível exportar seus dados.");
    } finally {
      setExporting(false);
    }
  };

  const confirmDeletionAction = async () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (!action) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await authFetch(
        action === "request" ? "/members/me/deletion-request" : "/members/me/deletion-request/cancel",
        { method: "POST" },
      );
      if (!response.ok) throw new Error(await extractErrorMessage(response, "Não foi possível atualizar a solicitação."));
      const updated = await response.json() as DeletionRequest;
      setDeletionRequest(updated);
      setSuccess(action === "request" ? "" : "Solicitação cancelada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a solicitação.");
    } finally {
      setSubmitting(false);
    }
  };

  function renderDeletionContent(): React.JSX.Element {
    if (loadingRequest) {
      return <CircularProgress size={20} aria-label="Carregando solicitação de exclusão" />;
    }
    if (deletionRequest?.status === "pending") {
      return (
        <Stack spacing={1} sx={{ alignItems: "flex-start" }}>
          <Alert severity="info">Solicitação pendente de revisão pela diretoria.</Alert>
          <Button color="error" variant="outlined" onClick={() => setConfirmAction("cancel")}>
            Cancelar solicitação
          </Button>
        </Stack>
      );
    }
    return (
      <Button color="error" variant="outlined" onClick={() => setConfirmAction("request")}>
        Solicitar exclusão
      </Button>
    );
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <BoxContent />
          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Button variant="outlined" disabled={exporting} onClick={() => void exportData()}>
              {exporting ? "Preparando exportação…" : "Exportar meus dados"}
            </Button>
            <Button variant="outlined" href="#preferencias-email">Preferências de e-mail</Button>
          </Stack>
          {renderDeletionContent()}
        </Stack>
      </CardContent>
      <ModalConfirm
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction === "cancel" ? "Cancelar solicitação de exclusão?" : "Solicitar exclusão da conta?"}
        description={confirmAction === "cancel"
          ? "A solicitação será marcada como cancelada e não seguirá para revisão."
          : "A diretoria revisará o pedido antes de qualquer exclusão ou anonimização. Registros financeiros e de governança podem ser preservados conforme as obrigações legais."}
        variant="error"
        confirmLabel={confirmAction === "cancel" ? "Confirmar cancelamento" : "Enviar solicitação"}
        loading={submitting}
        onConfirm={() => void confirmDeletionAction()}
      />
    </Card>
  );
}

function BoxContent(): React.JSX.Element {
  return (
    <Typography variant="body2" color="text.secondary">
      Baixe uma cópia dos seus dados ou solicite revisão de exclusão. Nenhuma exclusão é executada imediatamente.
    </Typography>
  );
}
