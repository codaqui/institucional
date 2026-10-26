/**
 * Aba "Histórico de Doações" do dashboard.
 * Port do `DonationList` + `TabPanel index={1}` de `src/pages/membro/index.tsx`.
 */
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Pagination from "@mui/material/Pagination";
import Typography from "@mui/material/Typography";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { formatBRL } from "../../../../lib/transaction";
import type { Donation } from "./types";
import { getDonationOwnerLabel } from "./types";

interface DonationListProps {
  loading: boolean;
  donations: Donation[];
}

function DonationList({ loading, donations }: Readonly<DonationListProps>): React.JSX.Element {
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }
  if (donations.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Nenhuma doação registrada ainda.
        </Typography>
        <Button variant="contained" href="/participe/apoiar">
          Fazer uma doação
        </Button>
      </Box>
    );
  }
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {donations.map((tx) => (
        <Card key={tx.id} variant="outlined">
          <CardContent
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              py: "12px !important",
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {tx.community}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Chip
                label={getDonationOwnerLabel(tx)}
                size="small"
                color={getDonationOwnerLabel(tx) === "Business" ? "secondary" : "default"}
                variant="outlined"
              />
              <ArrowUpwardIcon fontSize="small" sx={{ color: "success.main" }} />
              <Typography variant="body1" color="success.main" sx={{ fontWeight: 700 }}>
                {formatBRL(tx.amount)}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

interface DonationsTabProps {
  readonly loading: boolean;
  readonly donations: Donation[];
  readonly page: number;
  readonly total: number;
  readonly limit: number;
  readonly onPageChange: (page: number) => void;
}

export default function DonationsTab({
  loading,
  donations,
  page,
  total,
  limit,
  onPageChange,
}: Readonly<DonationsTabProps>): React.JSX.Element {
  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>
        Doações avulsas
      </Typography>
      <DonationList loading={loading} donations={donations} />
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
