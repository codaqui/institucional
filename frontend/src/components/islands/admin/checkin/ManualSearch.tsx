/**
 * Busca manual de participantes (nome/e-mail) + lista de inscrições —
 * subcomponente da ilha de check-in. Port de
 * `src/pages/admin/eventos-checkin.tsx`.
 *
 * Internos: o backend filtra via `?query=` (feito no CheckinApp).
 * Externos: o backend não filtra — a lista é filtrada client-side no
 * CheckinApp antes de chegar aqui.
 */
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import SearchIcon from "@mui/icons-material/Search";
import type { EventRegistration } from "./types";
import { formatDateTime, formatOrderStatus } from "./checkin-utils";

interface ManualSearchProps {
  readonly registrations: EventRegistration[];
  readonly regsLoading: boolean;
  readonly searchQuery: string;
  readonly checkinLoading: boolean;
  readonly onSearchQueryChange: (query: string) => void;
  readonly onSearch: () => void;
  readonly onCheckin: (token: string) => void;
}

export default function ManualSearch({
  registrations,
  regsLoading,
  searchQuery,
  checkinLoading,
  onSearchQueryChange,
  onSearch,
  onCheckin,
}: Readonly<ManualSearchProps>): React.JSX.Element {
  return (
    <>
      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <PersonSearchIcon color="primary" />
        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 700 }}>
          Buscar participante
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="Nome ou e-mail"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onSearch();
          }}
        />
        <IconButton aria-label="Buscar participante" onClick={onSearch} disabled={regsLoading}>
          <SearchIcon />
        </IconButton>
      </Box>

      {regsLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={28} />
        </Box>
      )}
      {!regsLoading && registrations.length === 0 && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: "center", py: 3 }}
        >
          Nenhuma inscrição encontrada.
        </Typography>
      )}
      {!regsLoading && registrations.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {registrations.map((reg) => (
            <Card key={reg.id} variant="outlined">
              <CardContent sx={{ py: "12px !important" }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {reg.attendeeName ?? reg.member?.name ?? reg.attendeeEmail}
                      {reg.payer && reg.payer.id !== reg.member?.id && (
                        <Typography
                          component="span"
                          variant="caption"
                          color="primary.main"
                          sx={{ ml: 1 }}
                        >
                          (comprado por {reg.payer.name ?? reg.payer.githubHandle}
                          {reg.payer.githubHandle ? ` @${reg.payer.githubHandle}` : ""})
                        </Typography>
                      )}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      {reg.attendeeEmail}
                      {reg.member?.githubHandle ? ` · @${reg.member.githubHandle}` : ""}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block" }}
                    >
                      {reg.ticketType?.name ?? "Ingresso"}
                      {reg.order &&
                        ` · ${formatOrderStatus(reg.order.status)}${
                          reg.order.paidAt ? ` · ${formatDateTime(reg.order.paidAt)}` : ""
                        }`}
                    </Typography>
                  </Box>
                  {reg.checkedInAt ? (
                    <Chip
                      icon={<CheckCircleIcon />}
                      label={`Presente · ${formatDateTime(reg.checkedInAt)}`}
                      color="success"
                      size="small"
                      variant="outlined"
                    />
                  ) : (
                    <Button
                      size="small"
                      variant="contained"
                      disabled={checkinLoading}
                      onClick={() => onCheckin(reg.checkinToken)}
                    >
                      Confirmar presença
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </>
  );
}
