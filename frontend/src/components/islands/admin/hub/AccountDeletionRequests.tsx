import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PaginationControls from "../../ui/PaginationControls";
import ModalConfirm from "../ui/ModalConfirm";
import { useAuth } from "../../../../lib/use-auth";
import { extractErrorMessage, parseAuthJson } from "../../../../lib/auth-fetch-helpers";
import type { PaginatedResponse } from "../../../../lib/pagination";

type RequestStatus = "pending" | "completed" | "canceled";
type StatusFilter = RequestStatus | "all";

interface DeletionRequest {
  readonly id: string;
  readonly memberId: string;
  readonly status: RequestStatus;
  readonly requestedAt: string;
}

interface MemberSummary {
  readonly id: string;
  readonly name: string;
  readonly githubHandle: string;
}

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Pendente",
  completed: "Concluída",
  canceled: "Cancelada",
};

export default function AccountDeletionRequests({ members }: { readonly members: readonly MemberSummary[] }): React.JSX.Element {
  const { authFetch } = useAuth();
  const [data, setData] = useState<DeletionRequest[]>([]);
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [target, setTarget] = useState<DeletionRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completeError, setCompleteError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (status !== "all") params.set("status", status);
    const response = await authFetch(`/admin/members/deletion-requests?${params.toString()}`);
    const result = await parseAuthJson<PaginatedResponse<DeletionRequest>>(response, setError);
    if (result) {
      setData(result.data);
      setTotalPages(result.totalPages);
    }
    setLoading(false);
  }, [authFetch, page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const complete = async () => {
    if (!target) return;
    setSubmitting(true);
    setCompleteError("");
    try {
      const response = await authFetch(`/admin/members/deletion-requests/${target.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ reviewNote: reviewNote.trim() || undefined }),
      });
      if (!response.ok) {
        setCompleteError(await extractErrorMessage(response, "Não foi possível concluir a solicitação."));
        return;
      }
      setTarget(null);
      setReviewNote("");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card variant="outlined" sx={{ mt: 4 }}>
      <CardContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }}>
              Solicitações de exclusão
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Acompanhe a revisão e confirme somente após concluir o offboarding manual.
            </Typography>
          </Box>
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter);
              setPage(1);
            }}
            sx={{ maxWidth: 220 }}
          >
            <MenuItem value="pending">Pendentes</MenuItem>
            <MenuItem value="completed">Concluídas</MenuItem>
            <MenuItem value="canceled">Canceladas</MenuItem>
            <MenuItem value="all">Todas</MenuItem>
          </TextField>
          {error && (
            <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void load()}>Tentar novamente</Button>}>
              {error}
            </Alert>
          )}
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress aria-label="Carregando solicitações de exclusão" />
            </Box>
          ) : data.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nenhuma solicitação encontrada para o filtro atual.
            </Typography>
          ) : (
            <Stack spacing={1}>
              {data.map((item) => {
                const member = members.find((candidate) => candidate.id === item.memberId);
                return (
                  <Box key={item.id} sx={{ display: "flex", gap: 1, alignItems: { xs: "flex-start", sm: "center" }, justifyContent: "space-between", flexDirection: { xs: "column", sm: "row" }, border: 1, borderColor: "divider", borderRadius: 1, p: 1.5 }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {member ? `${member.name} (@${member.githubHandle})` : item.memberId}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(item.requestedAt).toLocaleString("pt-BR")}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Chip size="small" variant="outlined" label={STATUS_LABEL[item.status]} />
                      {item.status === "pending" && (
                        <Button size="small" variant="outlined" onClick={() => { setTarget(item); setReviewNote(""); setCompleteError(""); }}>
                          Concluir solicitação
                        </Button>
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
          <PaginationControls page={page} totalPages={totalPages} onChange={setPage} itemLabel="solicitações de exclusão" />
        </Stack>
      </CardContent>
      <ModalConfirm
        open={target !== null}
        onClose={() => setTarget(null)}
        title="Concluir solicitação de exclusão?"
        description={
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Confirme que o offboarding manual foi concluído. Esta ação altera somente o pedido, sem desativar ou anonimizar o membro automaticamente.
            </Typography>
            <TextField label="Nota da revisão" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 500 } }} />
          </Stack>
        }
        confirmLabel="Confirmar conclusão"
        loading={submitting}
        error={completeError}
        onConfirm={() => void complete()}
      />
    </Card>
  );
}
