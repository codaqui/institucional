import { useEffect, useRef } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import type { EventRegistration } from "./types";
import { formatDateSafe } from "./types";

export function certificateAvailability(
  registration: EventRegistration,
  memberSub?: string,
): "available" | "pending_account" | "unavailable" {
  if (memberSub && (registration.isPayerOnly || registration.memberId !== memberSub)) {
    return "unavailable";
  }
  if (registration.status === "pending_match") return "pending_account";
  if (registration.status === "confirmed" && registration.certificateGrantedAt) {
    return "available";
  }
  return "unavailable";
}

interface MemberCertificatesTabProps {
  readonly registrations: EventRegistration[];
  readonly loading: boolean;
  readonly error: string;
  readonly selectedCertificateId?: string | null;
  readonly certLoadingId?: string | null;
  readonly memberSub?: string;
  readonly onEmitCertificate: (registrationId: string) => void;
}

export default function MemberCertificatesTab({
  registrations,
  loading,
  error,
  selectedCertificateId,
  certLoadingId,
  memberSub,
  onEmitCertificate,
}: Readonly<MemberCertificatesTabProps>): React.JSX.Element {
  const requestedCertificate = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedCertificateId) {
      requestedCertificate.current = null;
      return;
    }
    if (loading || requestedCertificate.current === selectedCertificateId) return;
    const registration = registrations.find(({ id }) => id === selectedCertificateId);
    requestedCertificate.current = selectedCertificateId;
    if (registration && certificateAvailability(registration, memberSub) === "available") {
      onEmitCertificate(selectedCertificateId);
    }
  }, [loading, memberSub, onEmitCertificate, registrations, selectedCertificateId]);

  return (
    <Box>
      <Typography component="h2" variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        Certificados
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Consulte a concessão e abra o certificado canônico de cada participação.
      </Typography>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {loading ? <CircularProgress aria-label="Carregando certificados" /> : null}
      {!loading && registrations.length === 0 ? (
        <Alert severity="info">
          Nenhuma participação com certificado foi encontrada. Seus eventos ficam na aba Eventos.
        </Alert>
      ) : null}
      <Stack component="ul" spacing={2} sx={{ p: 0, m: 0, listStyle: "none" }}>
        {registrations.map((registration) => {
          const availability = certificateAvailability(registration, memberSub);
          const eventTitle = registration.event?.title ?? registration.activation?.title ?? "Evento";
          const grantedAt = formatDateSafe(registration.certificateGrantedAt);
          return (
            <Card
              component="li"
              key={registration.id}
              variant="outlined"
              sx={{
                borderColor: selectedCertificateId === registration.id ? "primary.main" : undefined,
              }}
            >
              <CardContent>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{ justifyContent: "space-between" }}
                >
                  <Box>
                    <Typography component="h3" variant="h6">{eventTitle}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Participação: {registration.attendeeName}
                    </Typography>
                    {grantedAt ? (
                      <Typography variant="body2" color="text.secondary">
                        Concedido em {grantedAt}
                      </Typography>
                    ) : null}
                  </Box>
                  <Box>
                    {availability === "available" ? (
                      <Chip color="success" variant="outlined" label="Certificado disponível" />
                    ) : null}
                    {availability === "pending_account" ? (
                      <Chip color="warning" variant="outlined" label="Certificado aguardando vínculo da conta" />
                    ) : null}
                    {availability === "unavailable" ? (
                      <Chip variant="outlined" label="Certificado ainda não disponível" />
                    ) : null}
                  </Box>
                </Stack>
                {availability === "available" ? (
                  <Button
                    sx={{ mt: 2 }}
                    variant="contained"
                    startIcon={<WorkspacePremiumIcon />}
                    disabled={certLoadingId === registration.id}
                    onClick={() => onEmitCertificate(registration.id)}
                  >
                    {certLoadingId === registration.id ? "Abrindo…" : "Ver certificado"}
                  </Button>
                ) : null}
                {availability === "pending_account" ? (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    A concessão existe, mas a participação precisa ser vinculada a uma conta com o
                    e-mail verificado no GitHub. Abra o convite recebido para concluir esse vínculo.
                  </Alert>
                ) : null}
                {availability === "unavailable" ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    A organização ainda não concedeu este certificado ou a inscrição não está confirmada.
                  </Typography>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
