import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { formatPublicHours } from "./HoursSummary";

export interface PublicHourEntry {
  id: string;
  sourceType: string;
  sourceLabel: string;
  hours: number | string;
  description: string;
  occurredAt: string;
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

export default function ProfileTimeline({ entries }: Readonly<{ entries: PublicHourEntry[] }>) {
  if (entries.length === 0) return null;

  return (
    <Box component="section" aria-labelledby="public-hours-timeline-title" sx={{ mt: 3 }}>
      <Typography id="public-hours-timeline-title" variant="h6" component="h3" sx={{ fontWeight: 700 }}>
        Linha do tempo
      </Typography>
      <Stack
        component="ol"
        role="list"
        aria-label="Linha do tempo de horas"
        spacing={0}
        sx={{ p: 0, mt: 1, listStyle: "none" }}
      >
        {entries.map((entry, index) => (
          <Box component="li" key={entry.id}>
            {index > 0 && <Divider sx={{ my: 2 }} />}
            <Typography variant="body2" color="text.secondary" component="time" dateTime={entry.occurredAt}>
              {dateFormatter.format(new Date(entry.occurredAt))}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mt: 0.5 }}>
              {entry.sourceLabel}
            </Typography>
            <Typography variant="body2">{entry.description}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {formatPublicHours(entry.hours)}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
