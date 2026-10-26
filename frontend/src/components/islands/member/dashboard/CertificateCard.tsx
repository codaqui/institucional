/**
 * Cartão de certificado de participação (imprimível), exibido no dialog de
 * prévia antes da impressão. Port de `CertificateCard`/`EventDateWorkloadLine`
 * em `src/pages/membro/index.tsx`.
 */
import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { QRCodeSVG } from "qrcode.react";
import { communities } from "../../../../data/communities";
import type { CertificateData } from "./types";
import { formatDateSafe, formatWorkload } from "./types";

function EventDateWorkloadLine({
  startDate,
  endDate,
  workload,
  communityName,
}: {
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly workload: string | null;
  readonly communityName: string;
}): React.JSX.Element {
  const endPart = endDate ? ` a ${endDate}` : "";
  const datePart = startDate ? `realizado em ${startDate}${endPart}` : "evento da comunidade";
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
      {datePart}
      {workload ? (
        <>
          , com carga horária de <strong>{workload}</strong>
        </>
      ) : null}
      {", organizado por "}
      <strong>{communityName}</strong>
      {", em parceria com a Associação Codaqui."}
    </Typography>
  );
}

export default function CertificateCard({
  certificate,
  origin,
}: Readonly<{ certificate: CertificateData; origin: string }>): React.JSX.Element {
  const startDate = formatDateSafe(certificate.eventStartAt);
  const endDate = formatDateSafe(certificate.eventEndAt);
  const issuedDate = formatDateSafe(certificate.issuedAt);
  const workload =
    typeof certificate.workloadMinutes === "number" && certificate.workloadMinutes > 0
      ? formatWorkload(certificate.workloadMinutes)
      : null;
  const community = useMemo(
    () =>
      certificate.communityProjectKey
        ? (communities.find((c) => c.id === certificate.communityProjectKey) ?? null)
        : null,
    [certificate.communityProjectKey],
  );
  const communityName = community?.name ?? certificate.communityProjectKey ?? "Associação Codaqui";
  const verifyUrl = `${origin}/certificado/verificar?codigo=${encodeURIComponent(
    certificate.verificationCode,
  )}`;

  return (
    <Box
      className="certificate-print-area"
      sx={{
        p: 5,
        textAlign: "center",
        border: 8,
        borderColor: "primary.main",
        borderRadius: 1,
        bgcolor: "background.paper",
      }}
    >
      <Box component="img" src="/img/logo.png" alt="Codaqui" sx={{ height: 40, mb: 1 }} />
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 3 }}>
        Associação Codaqui — CNPJ 44.593.429/0001-05
      </Typography>
      <Typography variant="overline" color="primary.main" sx={{ fontWeight: 800, display: "block" }}>
        CERTIFICADO DE PARTICIPAÇÃO
      </Typography>
      <Typography variant="body1" sx={{ mt: 3 }}>
        Certificamos que
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
        Nome do participante
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {certificate.attendeeName}
      </Typography>
      {certificate.attendeeEmail && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            E-mail
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 500, mb: 2 }}>
            {certificate.attendeeEmail}
          </Typography>
        </>
      )}
      <Typography variant="body1">participou do evento</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        Evento
      </Typography>
      <Typography variant="h5" color="primary.main" sx={{ fontWeight: 800, mb: 1 }}>
        {certificate.eventTitle}
      </Typography>
      <EventDateWorkloadLine
        startDate={startDate}
        endDate={endDate}
        workload={workload}
        communityName={communityName}
      />
      <Box
        sx={{
          mt: 4,
          pt: 2,
          borderTop: 1,
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ bgcolor: "white", p: 1, borderRadius: 1, display: "inline-block" }}>
          <QRCodeSVG value={verifyUrl} size={72} level="M" marginSize={0} />
        </Box>
        <Box sx={{ textAlign: "left" }}>
          {issuedDate && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Emitido em {issuedDate}
            </Typography>
          )}
          <Typography
            variant="caption"
            sx={{ fontFamily: "monospace", display: "block" }}
            color="text.secondary"
          >
            Código de verificação: {certificate.verificationCode}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Verifique a autenticidade pelo QR code ou em {origin}/certificado/verificar
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
