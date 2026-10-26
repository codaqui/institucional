/**
 * Aba "Assinaturas Recorrentes" do dashboard.
 * Port do `SubscriptionList` + `TabPanel index={2}` de `src/pages/membro/index.tsx`.
 */
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Pagination from "@mui/material/Pagination";
import Typography from "@mui/material/Typography";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import CancelIcon from "@mui/icons-material/Cancel";
import { formatBRL } from "../../../../lib/transaction";
import type { Subscription } from "./types";
import { getSubscriptionOwnerLabel } from "./types";

interface SubscriptionListProps {
  loading: boolean;
  subscriptions: Subscription[];
  onCancelClick: (id: string) => void;
}

function SubscriptionList({
  loading,
  subscriptions,
  onCancelClick,
}: Readonly<SubscriptionListProps>): React.JSX.Element {
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (subscriptions.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 3, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Nenhuma assinatura ativa.
        </Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 4 }}>
      {subscriptions.map((sub) => (
        <Card
          key={sub.id}
          variant="outlined"
          sx={{
            borderColor: sub.cancelAtPeriodEnd ? "warning.main" : "primary.main",
            borderWidth: 1,
          }}
        >
          <CardContent sx={{ py: "12px !important" }}>
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
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  <AutorenewIcon fontSize="small" color={sub.cancelAtPeriodEnd ? "warning" : "info"} />
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {sub.communityId === "tesouro-geral" ? "Tesouro Codaqui" : sub.communityId}
                  </Typography>
                  <Chip
                    label={sub.interval === "month" ? "Mensal" : "Anual"}
                    size="small"
                    color="info"
                    variant="outlined"
                  />
                  <Chip
                    label={getSubscriptionOwnerLabel(sub)}
                    size="small"
                    color={getSubscriptionOwnerLabel(sub) === "Business" ? "secondary" : "default"}
                    variant="outlined"
                  />
                  {sub.cancelAtPeriodEnd && (
                    <Chip label="Encerra em breve" size="small" color="warning" variant="outlined" />
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {sub.cancelAtPeriodEnd
                    ? `Ativa até ${new Date(sub.currentPeriodEnd * 1000).toLocaleDateString("pt-BR")}`
                    : `Próxima cobrança: ${new Date(sub.currentPeriodEnd * 1000).toLocaleDateString("pt-BR")}`}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Typography variant="body1" color="primary.main" sx={{ fontWeight: 700 }}>
                  {formatBRL(sub.amount / 100)}/{sub.interval === "month" ? "mês" : "ano"}
                </Typography>
                {!sub.cancelAtPeriodEnd && (
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    startIcon={<CancelIcon />}
                    onClick={() => onCancelClick(sub.id)}
                  >
                    Cancelar
                  </Button>
                )}
              </Box>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

interface SubscriptionsTabProps {
  readonly loading: boolean;
  readonly subscriptions: Subscription[];
  readonly page: number;
  readonly total: number;
  readonly limit: number;
  readonly onPageChange: (page: number) => void;
  readonly onCancelClick: (id: string) => void;
}

export default function SubscriptionsTab({
  loading,
  subscriptions,
  page,
  total,
  limit,
  onPageChange,
  onCancelClick,
}: Readonly<SubscriptionsTabProps>): React.JSX.Element {
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AutorenewIcon color="info" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Assinaturas Recorrentes
          </Typography>
        </Box>
        <Button variant="outlined" size="small" href="/participe/apoiar">
          + Nova assinatura
        </Button>
      </Box>
      <SubscriptionList
        loading={loading}
        subscriptions={subscriptions}
        onCancelClick={onCancelClick}
      />
      {total > limit && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Pagination
            page={page}
            count={Math.max(1, Math.ceil(total / limit))}
            onChange={(_, value) => onPageChange(value)}
            color="primary"
            size="small"
          />
        </Box>
      )}
    </Box>
  );
}
