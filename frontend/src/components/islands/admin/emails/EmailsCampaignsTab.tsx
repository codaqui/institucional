import { useCallback, useEffect, useId, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Pagination from "@mui/material/Pagination";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useAuth } from "../../../../lib/use-auth";
import {
  extractErrorMessage,
  parseAuthJson,
} from "../../../../lib/auth-fetch-helpers";

export type CampaignPurpose = "transactional" | "promotional";
export type CampaignStatus =
  | "draft"
  | "preview"
  | "scheduled"
  | "sending"
  | "completed"
  | "completed_with_errors"
  | "failed"
  | "canceled";
export type CampaignSegmentType =
  | "all_opted_in_members"
  | "role"
  | "designation"
  | "community_governance"
  | "manual";

export interface CampaignMetrics {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  skipped: number;
  suppressed: number;
}

export interface CampaignRecipientItem {
  id: string;
  memberId: string | null;
  email: string | null;
  name: string | null;
  status: "pending" | "sending" | "sent" | "failed" | "skipped" | "suppressed";
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
}

export interface CampaignItem {
  id: string;
  name: string;
  subject: string;
  bodyMarkdown: string;
  templateId: string | null;
  purpose: CampaignPurpose;
  status: CampaignStatus;
  segmentType: CampaignSegmentType;
  segmentConfig: Record<string, unknown>;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  metrics: CampaignMetrics;
}

export interface CampaignDetail extends CampaignItem {
  recipients: CampaignRecipientItem[];
  renderedPreview: {
    subject: string;
    html: string;
    text: string;
  };
}

export interface CampaignPreviewResponse {
  campaignId: string;
  status: CampaignStatus;
  includedCount: number;
  excludedCount: number;
  included: Array<{
    memberId: string | null;
    email: string | null;
    name: string | null;
  }>;
  excluded: Array<{
    memberId: string | null;
    email: string | null;
    name: string | null;
    reason: string;
  }>;
  exclusionsByReason: {
    suppressed: number;
    inactiveRole: number;
    invalidEmail: number;
    noOptIn: number;
    duplicate: number;
  };
  rendered: {
    subject: string;
    html: string;
    text: string;
  };
}

interface CommunityOption {
  id: string;
  name: string;
  slug: string;
}

interface SuppressionItem {
  id: string;
  emailNormalized: string;
  reason: string;
  source: "unsubscribe" | "admin" | "complaint" | "bounce_manual";
  createdAt: string;
}

const STATUS_LABELS: Record<
  CampaignStatus,
  {
    label: string;
    color: "default" | "info" | "warning" | "success" | "error";
  }
> = {
  draft: { label: "Rascunho", color: "default" },
  preview: { label: "Em prévia", color: "info" },
  scheduled: { label: "Agendada", color: "info" },
  sending: { label: "Enviando", color: "warning" },
  completed: { label: "Concluída", color: "success" },
  completed_with_errors: { label: "Concluída com falhas", color: "warning" },
  failed: { label: "Falhou", color: "error" },
  canceled: { label: "Cancelada", color: "default" },
};

const ROLE_OPTIONS = [
  "membro",
  "admin",
  "finance-analyzer",
  "diretor",
  "voluntario",
  "mentor",
  "gestor_universitario",
  "event_organizer",
  "event_finance",
  "event_host",
  "event_checker",
] as const;

const TARGET_TYPE_OPTIONS = [
  "community",
  "directorate",
  "extension_project",
  "ies",
  "event",
  "company",
  "entity",
  "program",
] as const;

const DESIGNATION_OPTIONS = [
  "responsible",
  "director",
  "volunteer",
  "mentor",
  "ambassador",
  "organizer",
  "evaluator",
  "maintainer",
  "manager",
  "founder",
] as const;

function makeIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `camp-${crypto.randomUUID()}`;
  }
  return `camp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function EmailsCampaignsTab() {
  const { isAdmin, authFetch } = useAuth();
  const baseId = useId();

  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const [communities, setCommunities] = useState<CommunityOption[]>([]);
  const [suppressions, setSuppressions] = useState<SuppressionItem[]>([]);

  // Detalhe e prévia da campanha selecionada
  const [selectedCampaign, setSelectedCampaign] =
    useState<CampaignDetail | null>(null);
  const [previewResult, setPreviewResult] =
    useState<CampaignPreviewResponse | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Formulário de criação (Conteúdo -> Público)
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState<CampaignPurpose>("promotional");
  const [subject, setSubject] = useState("");
  const [bodyMarkdown, setBodyMarkdown] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [segmentType, setSegmentType] = useState<CampaignSegmentType>(
    "all_opted_in_members",
  );
  const [roleValue, setRoleValue] = useState<string>("membro");
  const [targetTypeValue, setTargetTypeValue] = useState<string>("community");
  const [designationValue, setDesignationValue] =
    useState<string>("responsible");
  const [targetIdValue, setTargetIdValue] = useState<string>("");
  const [communityIdValue, setCommunityIdValue] = useState<string>("");
  const [manualEmailsText, setManualEmailsText] = useState<string>("");
  const [consentEvidence, setConsentEvidence] = useState<string>("");
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    makeIdempotencyKey(),
  );

  // Formulário de supressão manual
  const [suppressionEmail, setSuppressionEmail] = useState("");
  const [suppressionReason, setSuppressionReason] = useState("");
  const [suppressionSource, setSuppressionSource] = useState<
    "admin" | "complaint" | "bounce_manual"
  >("admin");

  const pollingInFlightRef = useRef(false);

  const fetchCampaigns = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const res = await authFetch(`/campaigns?page=${page}&limit=20`);
        const data = await parseAuthJson<{
          data: CampaignItem[];
          total: number;
          page: number;
          totalPages: number;
        }>(res, (msg) => setFeedback({ kind: "error", message: msg }));
        if (data) {
          setCampaigns(Array.isArray(data.data) ? data.data : []);
          setTotal(data.total ?? 0);
          setTotalPages(data.totalPages ?? 1);
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [authFetch, page],
  );

  const fetchCampaignDetail = useCallback(
    async (campaignId: string, silent = false) => {
      if (!silent) setBusyAction("detail");
      try {
        const res = await authFetch(`/campaigns/${campaignId}`);
        if (!res.ok) return;
        const detail = (await res.json()) as CampaignDetail;
        setSelectedCampaign(detail);
      } finally {
        if (!silent) setBusyAction(null);
      }
    },
    [authFetch],
  );

  const fetchAuxData = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [commRes, supRes] = await Promise.all([
        authFetch("/communities/public"),
        authFetch("/campaigns/suppressions"),
      ]);
      if (commRes.ok) {
        const commData = (await commRes.json().catch(() => [])) as CommunityOption[];
        if (Array.isArray(commData)) {
          setCommunities(commData);
          if (commData[0]?.id && !communityIdValue) {
            setCommunityIdValue(commData[0].id);
          }
        }
      }
      if (supRes.ok) {
        const supData = (await supRes.json().catch(() => [])) as SuppressionItem[];
        if (Array.isArray(supData)) {
          setSuppressions(supData);
        }
      }
    } catch {
      // ignora erro auxiliar
    }
  }, [authFetch, isAdmin, communityIdValue]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  useEffect(() => {
    void fetchAuxData();
  }, [fetchAuxData]);

  // Polling somente quando o documento está visível e sem request concorrente
  const hasActiveCampaign =
    selectedCampaign?.status === "sending" ||
    selectedCampaign?.status === "scheduled" ||
    campaigns.some(
      (c) => c.status === "sending" || c.status === "scheduled",
    );

  useEffect(() => {
    if (!hasActiveCampaign) return;

    const tick = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      if (pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;
      try {
        await fetchCampaigns(true);
        if (selectedCampaign?.id) {
          await fetchCampaignDetail(selectedCampaign.id, true);
        }
      } finally {
        pollingInFlightRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void tick();
    }, 5000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [
    hasActiveCampaign,
    fetchCampaigns,
    fetchCampaignDetail,
    selectedCampaign?.id,
  ]);

  const buildSegmentConfig = (): Record<string, unknown> => {
    switch (segmentType) {
      case "all_opted_in_members":
        return {};
      case "role":
        return { role: roleValue };
      case "designation":
        return {
          targetType: targetTypeValue,
          designation: designationValue,
          targetId: targetIdValue.trim(),
        };
      case "community_governance":
        return { communityId: communityIdValue.trim() };
      case "manual":
        return {
          emails: manualEmailsText
            .split(/[\n,;]+/)
            .map((e) => e.trim())
            .filter(Boolean),
          consentEvidence: consentEvidence.trim(),
        };
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction("create");
    setFeedback(null);
    try {
      const payload = {
        name: name.trim(),
        purpose,
        subject: subject.trim(),
        bodyMarkdown,
        segmentType,
        segmentConfig: buildSegmentConfig(),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        idempotencyKey,
      };
      const res = await authFetch("/campaigns", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setFeedback({
          kind: "error",
          message: await extractErrorMessage(
            res,
            "Não foi possível criar a campanha.",
          ),
        });
        return;
      }
      const created = (await res.json()) as CampaignItem;
      setFeedback({
        kind: "success",
        message: `Rascunho "${created.name}" salvo. Gere a prévia congelada para revisar os destinatários.`,
      });
      setIdempotencyKey(makeIdempotencyKey());
      await fetchCampaigns();
      await fetchCampaignDetail(created.id);
    } finally {
      setBusyAction(null);
    }
  };

  const handlePreview = async (campaignId: string) => {
    setBusyAction("preview");
    setFeedback(null);
    try {
      const res = await authFetch(`/campaigns/${campaignId}/preview`, {
        method: "POST",
      });
      if (!res.ok) {
        setFeedback({
          kind: "error",
          message: await extractErrorMessage(
            res,
            "Não foi possível gerar a prévia.",
          ),
        });
        return;
      }
      const preview = (await res.json()) as CampaignPreviewResponse;
      setPreviewResult(preview);
      setFeedback({
        kind: "info",
        message: `Prévia congelada: ${preview.includedCount} destinatário(s) incluído(s) e ${preview.excludedCount} excluído(s).`,
      });
      await fetchCampaigns(true);
      await fetchCampaignDetail(campaignId, true);
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendTest = async (campaignId: string) => {
    setBusyAction("test");
    setFeedback(null);
    try {
      const res = await authFetch(`/campaigns/${campaignId}/test`, {
        method: "POST",
      });
      if (!res.ok) {
        setFeedback({
          kind: "error",
          message: await extractErrorMessage(
            res,
            "Falha ao enviar e-mail de teste.",
          ),
        });
        return;
      }
      const data = (await res.json()) as { to: string; status: string };
      setFeedback({
        kind: "success",
        message: `E-mail de teste disparado para ${data.to} (${data.status}).`,
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirm = async (campaignId: string) => {
    setBusyAction("confirm");
    setFeedback(null);
    try {
      const res = await authFetch(`/campaigns/${campaignId}/confirm`, {
        method: "POST",
        body: JSON.stringify({
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        setFeedback({
          kind: "error",
          message: await extractErrorMessage(
            res,
            "Não foi possível confirmar a campanha.",
          ),
        });
        return;
      }
      setFeedback({
        kind: "success",
        message: "Campanha confirmada e adicionada à fila de envio.",
      });
      await fetchCampaigns(true);
      await fetchCampaignDetail(campaignId, true);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCancel = async (campaignId: string) => {
    setBusyAction("cancel");
    setFeedback(null);
    try {
      const res = await authFetch(`/campaigns/${campaignId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        setFeedback({
          kind: "error",
          message: await extractErrorMessage(
            res,
            "Não foi possível cancelar a campanha.",
          ),
        });
        return;
      }
      setFeedback({
        kind: "info",
        message: "Campanha cancelada. Novos envios foram interrompidos.",
      });
      await fetchCampaigns(true);
      await fetchCampaignDetail(campaignId, true);
    } finally {
      setBusyAction(null);
    }
  };

  const handleRetryRecipient = async (
    campaignId: string,
    recipientId: string,
  ) => {
    setBusyAction(`retry-${recipientId}`);
    setFeedback(null);
    try {
      const res = await authFetch(
        `/campaigns/${campaignId}/recipients/${recipientId}/retry`,
        { method: "POST" },
      );
      if (!res.ok) {
        setFeedback({
          kind: "error",
          message: await extractErrorMessage(
            res,
            "Não foi possível reagendar o destinatário.",
          ),
        });
        return;
      }
      setFeedback({
        kind: "success",
        message: "Destinatário recolocado na fila para nova tentativa.",
      });
      await fetchCampaignDetail(campaignId, true);
      await fetchCampaigns(true);
    } finally {
      setBusyAction(null);
    }
  };

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction("suppression");
    setFeedback(null);
    try {
      const res = await authFetch("/campaigns/suppressions", {
        method: "POST",
        body: JSON.stringify({
          email: suppressionEmail.trim(),
          reason: suppressionReason.trim(),
          source: suppressionSource,
        }),
      });
      if (!res.ok) {
        setFeedback({
          kind: "error",
          message: await extractErrorMessage(
            res,
            "Não foi possível registrar a supressão.",
          ),
        });
        return;
      }
      setSuppressionEmail("");
      setSuppressionReason("");
      setFeedback({
        kind: "success",
        message: "Supressão registrada com sucesso.",
      });
      await fetchAuxData();
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteSuppression = async (id: string) => {
    setBusyAction(`del-sup-${id}`);
    setFeedback(null);
    try {
      const res = await authFetch(`/campaigns/suppressions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setFeedback({
          kind: "error",
          message: await extractErrorMessage(
            res,
            "Não foi possível remover a supressão.",
          ),
        });
        return;
      }
      setFeedback({
        kind: "info",
        message: "Supressão administrativa removida.",
      });
      await fetchAuxData();
    } finally {
      setBusyAction(null);
    }
  };

  const progressPercent = selectedCampaign
    ? selectedCampaign.metrics.total > 0
      ? Math.round(
          ((selectedCampaign.metrics.sent +
            selectedCampaign.metrics.failed +
            selectedCampaign.metrics.skipped +
            selectedCampaign.metrics.suppressed) /
            selectedCampaign.metrics.total) *
            100,
        )
      : 0
    : 0;

  return (
    <Stack spacing={3}>
      {feedback && (
        <Alert
          severity={feedback.kind}
          role="status"
          aria-live="polite"
          onClose={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      {isAdmin && (
        <Card variant="outlined">
          <CardContent>
            <Typography
              id={`${baseId}-form-heading`}
              variant="h6"
              component="h3"
              sx={{ fontWeight: 700, mb: 2 }}
            >
              Nova campanha (1. Conteúdo → 2. Público)
            </Typography>
            <Box
              component="form"
              aria-labelledby={`${baseId}-form-heading`}
              onSubmit={handleCreateCampaign}
            >
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    label="Nome interno da campanha"
                    name="name"
                    fullWidth
                    size="small"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id={`${baseId}-purpose-label`}>
                      Finalidade
                    </InputLabel>
                    <Select
                      labelId={`${baseId}-purpose-label`}
                      label="Finalidade"
                      value={purpose}
                      onChange={(e) =>
                        setPurpose(e.target.value as CampaignPurpose)
                      }
                    >
                      <MenuItem value="promotional">
                        Promocional (exige opt-in e descadastro)
                      </MenuItem>
                      <MenuItem value="transactional">
                        Transacional (relação existente)
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <TextField
                    label="Agendar para (opcional)"
                    name="scheduledAt"
                    type="datetime-local"
                    fullWidth
                    size="small"
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Assunto do e-mail"
                    name="subject"
                    fullWidth
                    size="small"
                    required
                    helperText="Variáveis suportadas: {{name}}, {{unsubscribeUrl}}"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Corpo em Markdown"
                    name="bodyMarkdown"
                    fullWidth
                    multiline
                    minRows={5}
                    required
                    helperText="Em campanhas promocionais, o link de descadastro é incluído automaticamente caso {{unsubscribeUrl}} não esteja no texto."
                    value={bodyMarkdown}
                    onChange={(e) => setBodyMarkdown(e.target.value)}
                  />
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id={`${baseId}-segment-label`}>
                      Segmento de destinatários
                    </InputLabel>
                    <Select
                      labelId={`${baseId}-segment-label`}
                      label="Segmento de destinatários"
                      value={segmentType}
                      onChange={(e) =>
                        setSegmentType(e.target.value as CampaignSegmentType)
                      }
                    >
                      <MenuItem value="all_opted_in_members">
                        Todos os membros ativos com opt-in promocional
                      </MenuItem>
                      <MenuItem value="role">Papel global (role)</MenuItem>
                      <MenuItem value="designation">
                        Designation específica
                      </MenuItem>
                      <MenuItem value="community_governance">
                        Governança de comunidade (vínculos explícitos)
                      </MenuItem>
                      <MenuItem value="manual">
                        Seleção manual de e-mails verificados
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {segmentType === "role" && (
                  <Grid size={{ xs: 12, md: 6 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel id={`${baseId}-role-label`}>
                        Role global
                      </InputLabel>
                      <Select
                        labelId={`${baseId}-role-label`}
                        label="Role global"
                        value={roleValue}
                        onChange={(e) => setRoleValue(e.target.value)}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <MenuItem key={r} value={r}>
                            {r}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}

                {segmentType === "designation" && (
                  <>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel id={`${baseId}-target-type-label`}>
                          Target Type
                        </InputLabel>
                        <Select
                          labelId={`${baseId}-target-type-label`}
                          label="Target Type"
                          value={targetTypeValue}
                          onChange={(e) => setTargetTypeValue(e.target.value)}
                        >
                          {TARGET_TYPE_OPTIONS.map((t) => (
                            <MenuItem key={t} value={t}>
                              {t}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel id={`${baseId}-designation-label`}>
                          Designation
                        </InputLabel>
                        <Select
                          labelId={`${baseId}-designation-label`}
                          label="Designation"
                          value={designationValue}
                          onChange={(e) => setDesignationValue(e.target.value)}
                        >
                          {DESIGNATION_OPTIONS.map((d) => (
                            <MenuItem key={d} value={d}>
                              {d}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <TextField
                        label="Target ID (UUID)"
                        name="targetId"
                        fullWidth
                        size="small"
                        required
                        slotProps={{
                          htmlInput: {
                            autoCorrect: "off",
                            autoCapitalize: "none",
                            spellCheck: false,
                          },
                        }}
                        value={targetIdValue}
                        onChange={(e) => setTargetIdValue(e.target.value)}
                      />
                    </Grid>
                  </>
                )}

                {segmentType === "community_governance" && (
                  <Grid size={{ xs: 12, md: 6 }}>
                    {communities.length > 0 ? (
                      <FormControl fullWidth size="small">
                        <InputLabel id={`${baseId}-community-label`}>
                          Comunidade
                        </InputLabel>
                        <Select
                          labelId={`${baseId}-community-label`}
                          label="Comunidade"
                          value={communityIdValue}
                          onChange={(e) => setCommunityIdValue(e.target.value)}
                        >
                          {communities.map((c) => (
                            <MenuItem key={c.id} value={c.id}>
                              {c.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    ) : (
                      <TextField
                        label="Community ID (UUID)"
                        name="communityId"
                        fullWidth
                        size="small"
                        required
                        value={communityIdValue}
                        onChange={(e) => setCommunityIdValue(e.target.value)}
                      />
                    )}
                  </Grid>
                )}

                {segmentType === "manual" && (
                  <>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        label="E-mails verificados (separados por vírgula ou quebra de linha)"
                        name="manualEmails"
                        fullWidth
                        multiline
                        minRows={2}
                        required
                        slotProps={{
                          htmlInput: {
                            autoCorrect: "off",
                            autoCapitalize: "none",
                            spellCheck: false,
                          },
                        }}
                        value={manualEmailsText}
                        onChange={(e) => setManualEmailsText(e.target.value)}
                      />
                    </Grid>
                    {purpose === "promotional" && (
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          label="Evidência de consentimento promocional"
                          name="consentEvidence"
                          fullWidth
                          size="small"
                          required
                          helperText="Obrigatório para segmento manual promocional (ex.: registro de opt-in ou referência de consentimento)."
                          value={consentEvidence}
                          onChange={(e) => setConsentEvidence(e.target.value)}
                        />
                      </Grid>
                    )}
                  </>
                )}

                <Grid size={{ xs: 12 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={busyAction === "create"}
                  >
                    {busyAction === "create"
                      ? "Salvando rascunho…"
                      : "Salvar rascunho da campanha"}
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Detalhe, Prévia, Teste, Confirmação e Acompanhamento da Campanha Selecionada */}
      {selectedCampaign && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 1,
                }}
              >
                <Box>
                  <Typography variant="h6" component="h3" sx={{ fontWeight: 700 }}>
                    Campanha: {selectedCampaign.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Assunto: {selectedCampaign.subject} · Finalidade:{" "}
                    {selectedCampaign.purpose} · Segmento:{" "}
                    {selectedCampaign.segmentType}
                  </Typography>
                </Box>
                <Chip
                  label={
                    STATUS_LABELS[selectedCampaign.status]?.label ??
                    selectedCampaign.status
                  }
                  color={
                    STATUS_LABELS[selectedCampaign.status]?.color ?? "default"
                  }
                  variant="outlined"
                />
              </Box>

              {/* Barra de progresso acessível */}
              <Box>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    mb: 0.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Progresso operacional ({progressPercent}%)
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Total: {selectedCampaign.metrics.total} · Enviados:{" "}
                    {selectedCampaign.metrics.sent} · Pendentes:{" "}
                    {selectedCampaign.metrics.pending +
                      selectedCampaign.metrics.sending}{" "}
                    · Falhas: {selectedCampaign.metrics.failed} · Ignorados:{" "}
                    {selectedCampaign.metrics.skipped} · Suprimidos:{" "}
                    {selectedCampaign.metrics.suppressed}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progressPercent}
                  aria-label="Progresso de envio da campanha"
                />
              </Box>

              {/* Resumo de exclusões da prévia congelada */}
              {previewResult &&
                previewResult.campaignId === selectedCampaign.id && (
                  <Alert severity="info">
                    <strong>Resumo da prévia congelada:</strong>{" "}
                    {previewResult.includedCount} incluído(s) ·{" "}
                    {previewResult.excludedCount} excluído(s) (suprimidos:{" "}
                    {previewResult.exclusionsByReason.suppressed}, papel
                    inativo: {previewResult.exclusionsByReason.inactiveRole},
                    e-mail inválido/não verificado:{" "}
                    {previewResult.exclusionsByReason.invalidEmail}, sem opt-in:{" "}
                    {previewResult.exclusionsByReason.noOptIn}, duplicados:{" "}
                    {previewResult.exclusionsByReason.duplicate}).
                  </Alert>
                )}

              {/* Ações da jornada (3. Prévia/Teste -> 4. Confirmação -> 5. Cancelamento) */}
              {isAdmin && (
                <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
                  {(selectedCampaign.status === "draft" ||
                    selectedCampaign.status === "preview") && (
                    <Button
                      type="button"
                      variant="outlined"
                      disabled={busyAction !== null}
                      onClick={() => handlePreview(selectedCampaign.id)}
                    >
                      Gerar prévia congelada
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outlined"
                    disabled={busyAction !== null}
                    onClick={() => handleSendTest(selectedCampaign.id)}
                  >
                    Enviar teste para mim
                  </Button>

                  {selectedCampaign.status === "preview" &&
                    selectedCampaign.metrics.pending > 0 && (
                      <Button
                        type="button"
                        variant="contained"
                        color="primary"
                        disabled={busyAction !== null}
                        onClick={() => handleConfirm(selectedCampaign.id)}
                      >
                        Confirmar disparo da campanha
                      </Button>
                    )}

                  {(selectedCampaign.status === "draft" ||
                    selectedCampaign.status === "preview" ||
                    selectedCampaign.status === "scheduled" ||
                    selectedCampaign.status === "sending") && (
                    <Button
                      type="button"
                      variant="outlined"
                      color="error"
                      disabled={busyAction !== null}
                      onClick={() => handleCancel(selectedCampaign.id)}
                    >
                      Cancelar campanha
                    </Button>
                  )}
                </Stack>
              )}

              <Divider />

              {/* Pré-visualização renderizada segura */}
              <Box>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, mb: 1 }}
                >
                  Prévia do conteúdo renderizado
                </Typography>
                <Card variant="outlined">
                  <CardContent>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, mb: 1 }}
                    >
                      Assunto: {selectedCampaign.renderedPreview.subject}
                    </Typography>
                    <Box
                      sx={{ fontSize: "0.875rem" }}
                      dangerouslySetInnerHTML={{
                        __html: selectedCampaign.renderedPreview.html,
                      }}
                    />
                  </CardContent>
                </Card>
              </Box>

              {/* Tabela de destinatários da campanha */}
              {selectedCampaign.recipients.length > 0 && (
                <TableContainer component={Card} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {isAdmin && <TableCell>Destinatário</TableCell>}
                        <TableCell>Status</TableCell>
                        <TableCell>Tentativas</TableCell>
                        <TableCell>Erro operacional</TableCell>
                        {isAdmin && <TableCell align="right">Ações</TableCell>}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedCampaign.recipients.map((rec) => (
                        <TableRow key={rec.id}>
                          {isAdmin && (
                            <TableCell>
                              {rec.name ? `${rec.name} (${rec.email ?? "anonimizado"})` : rec.email ?? "anonimizado"}
                            </TableCell>
                          )}
                          <TableCell>
                            <Chip
                              label={rec.status}
                              size="small"
                              variant="outlined"
                              color={
                                rec.status === "sent"
                                  ? "success"
                                  : rec.status === "failed"
                                    ? "error"
                                    : rec.status === "suppressed"
                                      ? "warning"
                                      : "default"
                              }
                            />
                          </TableCell>
                          <TableCell>{rec.attempts}</TableCell>
                          <TableCell>{rec.lastError ?? "—"}</TableCell>
                          {isAdmin && (
                            <TableCell align="right">
                              {(rec.status === "failed" ||
                                rec.status === "skipped") &&
                                selectedCampaign.status !== "canceled" && (
                                  <Button
                                    type="button"
                                    size="small"
                                    variant="outlined"
                                    disabled={busyAction !== null}
                                    onClick={() =>
                                      handleRetryRecipient(
                                        selectedCampaign.id,
                                        rec.id,
                                      )
                                    }
                                  >
                                    Tentar novamente
                                  </Button>
                                )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Lista de Campanhas */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 700, mb: 2 }}>
            Histórico de campanhas ({total})
          </Typography>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : campaigns.length === 0 ? (
            <Typography color="text.secondary">
              Nenhuma campanha registrada até o momento.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Nome</TableCell>
                    <TableCell>Finalidade</TableCell>
                    <TableCell>Segmento</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Métricas (Env / Fal / Sup / Total)</TableCell>
                    <TableCell align="right">Detalhes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {campaigns.map((camp) => (
                    <TableRow key={camp.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{camp.name}</TableCell>
                      <TableCell>{camp.purpose}</TableCell>
                      <TableCell>{camp.segmentType}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={
                            STATUS_LABELS[camp.status]?.label ?? camp.status
                          }
                          color={
                            STATUS_LABELS[camp.status]?.color ?? "default"
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {camp.metrics.sent} / {camp.metrics.failed} /{" "}
                        {camp.metrics.suppressed} / {camp.metrics.total}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          type="button"
                          size="small"
                          variant="text"
                          onClick={() => fetchCampaignDetail(camp.id)}
                        >
                          Inspecionar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Pagination
                page={page}
                count={totalPages}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Gestão de Supressões (Admin) */}
      {isAdmin && (
        <Card variant="outlined">
          <CardContent>
            <Typography
              id={`${baseId}-suppression-heading`}
              variant="h6"
              component="h3"
              sx={{ fontWeight: 700, mb: 2 }}
            >
              Lista de supressões (descadastro, reclamação e bounce manual)
            </Typography>
            <Box
              component="form"
              aria-labelledby={`${baseId}-suppression-heading`}
              onSubmit={handleAddSuppression}
              sx={{ mb: 2 }}
            >
              <Grid container spacing={2} sx={{ alignItems: "center" }}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="E-mail a suprimir"
                    name="suppressionEmail"
                    type="email"
                    size="small"
                    fullWidth
                    required
                    slotProps={{
                      htmlInput: {
                        autoCorrect: "off",
                        autoCapitalize: "none",
                        spellCheck: false,
                      },
                    }}
                    value={suppressionEmail}
                    onChange={(e) => setSuppressionEmail(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id={`${baseId}-sup-source-label`}>
                      Origem
                    </InputLabel>
                    <Select
                      labelId={`${baseId}-sup-source-label`}
                      label="Origem"
                      value={suppressionSource}
                      onChange={(e) =>
                        setSuppressionSource(
                          e.target.value as
                            | "admin"
                            | "complaint"
                            | "bounce_manual",
                        )
                      }
                    >
                      <MenuItem value="admin">Administrativa</MenuItem>
                      <MenuItem value="complaint">Reclamação</MenuItem>
                      <MenuItem value="bounce_manual">Bounce manual</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Motivo"
                    name="suppressionReason"
                    size="small"
                    fullWidth
                    required
                    value={suppressionReason}
                    onChange={(e) => setSuppressionReason(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <Button
                    type="submit"
                    variant="outlined"
                    fullWidth
                    disabled={busyAction === "suppression"}
                  >
                    Suprimir
                  </Button>
                </Grid>
              </Grid>
            </Box>

            {suppressions.length > 0 && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>E-mail</TableCell>
                      <TableCell>Origem</TableCell>
                      <TableCell>Motivo</TableCell>
                      <TableCell align="right">Ação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {suppressions.map((sup) => (
                      <TableRow key={sup.id}>
                        <TableCell>{sup.emailNormalized}</TableCell>
                        <TableCell>{sup.source}</TableCell>
                        <TableCell>{sup.reason}</TableCell>
                        <TableCell align="right">
                          {sup.source === "unsubscribe" ? (
                            <Typography variant="caption" color="text.secondary">
                              Apenas o titular pode reativar
                            </Typography>
                          ) : (
                            <Button
                              type="button"
                              size="small"
                              color="error"
                              disabled={busyAction !== null}
                              onClick={() => handleDeleteSuppression(sup.id)}
                            >
                              Remover
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
