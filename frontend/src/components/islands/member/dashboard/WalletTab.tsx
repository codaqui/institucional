/**
 * Aba "Carteira" do dashboard: solicitações de reembolso do membro.
 * Port do `ReimbursementList` + `TabPanel index={3}` de `src/pages/membro/index.tsx`.
 */
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { formatBRL } from "../../../../lib/transaction";
import type { ReimbursementRequest } from "./types";

const reimbursementStatusConfig = {
  pending: {
    label: "Pendente",
    color: "warning" as const,
    icon: <HourglassEmptyIcon fontSize="small" />,
  },
  approved: {
    label: "Aprovado",
    color: "success" as const,
    icon: <CheckCircleIcon fontSize="small" />,
  },
  rejected: {
    label: "Rejeitado",
    color: "error" as const,
    icon: <CancelIcon fontSize="small" />,
  },
};

interface ReimbursementListProps {
  loading: boolean;
  reimbursements: ReimbursementRequest[];
}

function ReimbursementList({
  loading,
  reimbursements,
}: Readonly<ReimbursementListProps>): React.JSX.Element {
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (reimbursements.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Nenhuma solicitação ainda.
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 4 }}>
      {reimbursements.map((r) => {
        const sc = reimbursementStatusConfig[r.status];
        return (
          <Card key={r.id} variant="outlined">
            <CardContent sx={{ py: "12px !important" }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 1,
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {r.description}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {r.account?.name} · {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Chip
                    icon={sc.icon}
                    label={sc.label}
                    color={sc.color}
                    size="small"
                    variant="outlined"
                  />
                  <Typography variant="body1" color="primary.main" sx={{ fontWeight: 700 }}>
                    {formatBRL(r.amount)}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap", alignItems: "center" }}>
                <Button
                  size="small"
                  variant="text"
                  endIcon={<OpenInNewIcon />}
                  href={r.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Comprovante
                </Button>
              </Box>
              {r.reviewNote && (
                <Alert severity={r.status === "approved" ? "success" : "error"} sx={{ mt: 1 }}>
                  {r.reviewNote}
                </Alert>
              )}
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}

interface WalletTabProps {
  readonly loading: boolean;
  readonly reimbursements: ReimbursementRequest[];
  readonly onRequestReimbursement: () => void;
}

export default function WalletTab({
  loading,
  reimbursements,
  onRequestReimbursement,
}: Readonly<WalletTabProps>): React.JSX.Element {
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
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Minhas Solicitações de Reembolso
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<ReceiptLongIcon />}
          onClick={onRequestReimbursement}
        >
          Solicitar Reembolso
        </Button>
      </Box>
      <ReimbursementList loading={loading} reimbursements={reimbursements} />
    </Box>
  );
}
