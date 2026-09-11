import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Link,
  Typography,
} from "@mui/material";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { QRCodeSVG } from "qrcode.react";
import { useAuth } from "../../hooks/useAuth";

interface MyRegistration {
  id: string;
  status: string;
  checkedInAt: string | null;
  checkinToken: string;
  attendeeName: string;
  isPayerOnly?: boolean;
  event: { id: string } | null;
  activation: { eventKey: string } | null;
}

interface EventMyRegistrationProps {
  readonly apiUrl: string;
  readonly eventId?: string;
  readonly eventKey?: string;
  readonly eventStartAt: string;
  readonly eventEndAt?: string | null;
  readonly onOwnRegistration?: (hasOwn: boolean) => void;
}

const CERTIFICATE_CHECKIN_MESSAGE =
  "O certificado só pode ser emitido após a confirmação de presença (check-in) no evento.";

export default function EventMyRegistration({
  apiUrl,
  eventId,
  eventKey,
  eventStartAt,
  eventEndAt,
  onOwnRegistration,
}: EventMyRegistrationProps): React.JSX.Element | null {
  const { ready, isLoggedIn, authFetch } = useAuth();
  const [registration, setRegistration] = useState<MyRegistration | null>(null);
  const [certLoading, setCertLoading] = useState(false);
  const [certCode, setCertCode] = useState<string | null>(null);
  const [certError, setCertError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !isLoggedIn) {
      setRegistration(null);
      return;
    }
    let active = true;
    authFetch(`${apiUrl}/events/my-registrations`)
      .then(async (res) => {
        if (!active || !res.ok) return;
        const list = (await res.json()) as MyRegistration[];
        const found = list.find(
          (reg) =>
            reg.status === "confirmed" &&
            (eventId
              ? reg.event?.id === eventId
              : reg.activation?.eventKey === eventKey)
        );
        setRegistration(found ?? null);
      })
      .catch(() => {
        // Backend fora do ar → card fica escondido silenciosamente.
      });
    return () => {
      active = false;
    };
  }, [ready, isLoggedIn, apiUrl, eventId, eventKey, authFetch]);

  useEffect(() => {
    onOwnRegistration?.(Boolean(registration && !registration.isPayerOnly));
  }, [registration, onOwnRegistration]);

  if (!registration) return null;

  const referenceEnd = new Date(eventEndAt ?? eventStartAt).getTime();
  const eventFinished = Date.now() >= referenceEnd;

  // Evento passado sem check-in: nada a oferecer (sem QR, sem certificado).
  if (eventFinished && !registration.checkedInAt) return null;

  const handleEmitCertificate = async (): Promise<void> => {
    setCertLoading(true);
    setCertError(null);
    try {
      const res = await authFetch(
        `${apiUrl}/events/registrations/${registration.id}/certificate`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setCertError(
          res.status === 403
            ? CERTIFICATE_CHECKIN_MESSAGE
            : ((data as { message?: string } | null)?.message ??
                "Não foi possível emitir o certificado. Tente novamente.")
        );
        return;
      }
      const data = (await res.json()) as { verificationCode: string };
      setCertCode(data.verificationCode);
    } catch {
      setCertError("Não foi possível emitir o certificado. Tente novamente.");
    } finally {
      setCertLoading(false);
    }
  };

  const verifyUrl =
    certCode && typeof window !== "undefined"
      ? `${window.location.origin}/certificado/verificar?codigo=${encodeURIComponent(certCode)}`
      : null;

  return (
    <Card variant="outlined" sx={{ mb: 4, borderColor: "success.main" }}>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {registration.isPayerOnly
            ? `Você comprou ingresso para ${registration.attendeeName}.`
            : "Você está inscrito(a)!"}
        </Typography>

        {!eventFinished ? (
          registration.checkedInAt ? (
            <Alert severity="success">
              Check-in realizado em{" "}
              {new Date(registration.checkedInAt).toLocaleString("pt-BR")}.
            </Alert>
          ) : (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
                mt: 2,
              }}
            >
              <Box
                sx={{
                  bgcolor: "white",
                  p: 2,
                  borderRadius: 2,
                  display: "inline-block",
                }}
              >
                <QRCodeSVG
                  value={registration.checkinToken}
                  size={180}
                  level="M"
                  includeMargin={false}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" textAlign="center">
                Apresente este QR Code na entrada do evento
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontFamily: "monospace", wordBreak: "break-all" }}
              >
                {registration.checkinToken}
              </Typography>
            </Box>
          )
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Este evento já aconteceu.
            </Typography>
            {certCode && verifyUrl ? (
              <Alert severity="success">
                Certificado emitido! Código: <strong>{certCode}</strong> —{" "}
                <Link href={verifyUrl} target="_blank" rel="noopener noreferrer">
                  Verificar autenticidade
                </Link>
              </Alert>
            ) : (
              <Button
                variant="outlined"
                onClick={handleEmitCertificate}
                disabled={certLoading}
                startIcon={
                  certLoading ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    <WorkspacePremiumIcon />
                  )
                }
              >
                Emitir meu certificado
              </Button>
            )}
            {certError ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {certError}
              </Alert>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
