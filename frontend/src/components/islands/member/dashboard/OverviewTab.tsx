/**
 * Aba "Visão Geral" do dashboard: métricas resumidas + ações rápidas.
 * Port do `TabPanel value={activeTab} index={0}` de `src/pages/membro/index.tsx`.
 */
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { formatBRL } from "../../../../lib/transaction";
import type { Donation, ReimbursementRequest, Subscription } from "./types";
import { getSubscriptionOwnerLabel } from "./types";

interface OverviewTabProps {
  readonly donations: Donation[];
  readonly txLoading: boolean;
  readonly subscriptions: Subscription[];
  readonly subsLoading: boolean;
  readonly reimbursements: ReimbursementRequest[];
  readonly reimbLoading: boolean;
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

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ py: "12px !important" }}>
              <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
                Total doado
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
            <CardContent sx={{ py: "12px !important" }}>
              <Typography variant="overline" color="text.secondary" sx={{ display: "block" }}>
                Assinaturas ativas
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
            <CardContent sx={{ py: "12px !important" }}>
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
