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
import { formatBRL } from "../../../../lib/transaction";
import { certificateAvailability } from "./MemberCertificatesTab";
import type { Donation, EventRegistration, ReimbursementRequest, Subscription } from "./types";
import { getSubscriptionOwnerLabel, isUpcomingEvent } from "./types";

interface OverviewTabProps {
  readonly donations: Donation[];
  readonly txLoading: boolean;
  readonly subscriptions: Subscription[];
  readonly subsLoading: boolean;
  readonly reimbursements: ReimbursementRequest[];
  readonly reimbLoading: boolean;
  readonly registrations: EventRegistration[];
  readonly regsLoading: boolean;
  readonly onOpenDonationsTab: () => void;
  readonly onOpenSubscriptionsTab: () => void;
  readonly onOpenWalletTab: () => void;
}

export default function OverviewTab({
  donations,
  txLoading,
  subscriptions,
  subsLoading,
  reimbursements,
  reimbLoading,
  registrations,
  regsLoading,
  onOpenDonationsTab,
  onOpenSubscriptionsTab,
  onOpenWalletTab,
}: Readonly<OverviewTabProps>): React.JSX.Element {
  const activeSubscriptions = subscriptions.filter((s) => !s.cancelAtPeriodEnd);
  const activePersonalSubscriptions = activeSubscriptions.filter(
    (s) => getSubscriptionOwnerLabel(s) === "Pessoal",
  ).length;
  const activeBusinessSubscriptions = activeSubscriptions.filter(
    (s) => getSubscriptionOwnerLabel(s) === "Business",
  ).length;
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

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardActionArea href={buildMemberHref("participation", "future")}>
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

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
                Doações nesta página
              </Typography>
              {txLoading ? (
                <CircularProgress size={18} sx={{ mt: 0.5 }} />
              ) : (
                <Typography variant="h5" color="success.main" sx={{ fontWeight: 800 }}>
                  {formatBRL(donations.reduce((s, d) => s + d.amount, 0))}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
                Assinaturas ativas nesta página
              </Typography>
              {subsLoading ? (
                <CircularProgress size={18} sx={{ mt: 0.5 }} />
              ) : (
                <>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {activeSubscriptions.length}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {activePersonalSubscriptions} pessoal · {activeBusinessSubscriptions} business
                  </Typography>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
                Reembolsos pendentes
              </Typography>
              {reimbLoading ? (
                <CircularProgress size={18} sx={{ mt: 0.5 }} />
              ) : (
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {reimbursements.filter((r) => r.status === "pending").length}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Button variant="outlined" size="small" href="/clube">
          Minha carteira de moedas
        </Button>
        <Button variant="outlined" size="small" onClick={onOpenDonationsTab}>
          Ver histórico de doações
        </Button>
        <Button variant="outlined" size="small" onClick={onOpenSubscriptionsTab}>
          Ver assinaturas recorrentes
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
    </Box>
  );
}
