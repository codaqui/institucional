import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { buildMemberHref } from "../../../../lib/member-navigation";
import type { EventRegistration, ReimbursementRequest } from "./types";
import { isUpcomingEvent } from "./types";
import { certificateAvailability } from "./MemberCertificatesTab";
import ProfileBadges from "../profile/ProfileBadges";

interface OverviewTabProps {
  readonly reimbursements: ReimbursementRequest[];
  readonly reimbLoading: boolean;
  readonly registrations: EventRegistration[];
  readonly regsLoading: boolean;
  readonly memberName: string;
  readonly githubHandle: string;
  readonly onOpenFinance: () => void;
  readonly onOpenWalletTab: () => void;
}

export default function OverviewTab({
  reimbursements,
  reimbLoading,
  registrations,
  regsLoading,
  memberName,
  githubHandle,
  onOpenFinance,
  onOpenWalletTab,
}: Readonly<OverviewTabProps>): React.JSX.Element {
  const upcoming = registrations.filter(
    (registration) =>
      registration.status === "confirmed" &&
      !registration.checkedInAt &&
      isUpcomingEvent(registration),
  ).length;
  const availableCertificates = registrations.filter(
    (registration) => certificateAvailability(registration) === "available",
  ).length;
  const pendingCertificates = registrations.filter(
    (registration) => certificateAvailability(registration) === "pending_account",
  ).length;
  const pendingReimbursements = reimbursements.filter((item) => item.status === "pending").length;

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardActionArea href={buildMemberHref("participation", "events", "future")}>
              <CardContent>
                <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
                  Próximos eventos
                </Typography>
                {regsLoading ? (
                  <CircularProgress size={18} sx={{ mt: 0.5 }} />
                ) : (
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{upcoming}</Typography>
                )}
                <Typography variant="body2" color="text.secondary">
                  Ver ingressos futuros
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardActionArea href={buildMemberHref("participation", "certificates")}>
              <CardContent>
                <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
                  Certificados
                </Typography>
                {regsLoading ? (
                  <CircularProgress size={18} sx={{ mt: 0.5 }} />
                ) : (
                  <>
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                      {availableCertificates} disponível{availableCertificates === 1 ? "" : "eis"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {pendingCertificates} pendente{pendingCertificates === 1 ? "" : "s"} de conta
                    </Typography>
                  </>
                )}
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardActionArea href="/membro/horas">
              <CardContent>
                <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
                  Minhas horas
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center" }}>
                  <ScheduleIcon color="primary" />
                  <Typography variant="body2" color="text.secondary">
                    Extrato e declaração de horas
                  </Typography>
                </Stack>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>

      {!reimbLoading && pendingReimbursements > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
              Reembolsos pendentes
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              {pendingReimbursements}
            </Typography>
          </CardContent>
        </Card>
      )}

      <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Button variant="outlined" size="small" href="/clube">
          Minha carteira de moedas
        </Button>
        <Button variant="outlined" size="small" onClick={onOpenFinance}>
          Abrir apoio e financeiro
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<ReceiptLongIcon />}
          onClick={onOpenWalletTab}
        >
          Solicitar Reembolso
        </Button>
      </Stack>
      {githubHandle && <ProfileBadges name={memberName} githubHandle={githubHandle} />}
    </Box>
  );
}
