import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

const milestones = [10, 50, 100];
const hoursFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPublicHours(value: number | string): string {
  return `${hoursFormatter.format(Number(value))} horas`;
}

export default function HoursSummary({ totalHours }: Readonly<{ totalHours: number }>) {
  return (
    <Box component="section" aria-labelledby="public-hours-title" sx={{ mt: 4 }}>
      <Typography id="public-hours-title" variant="h5" component="h2" sx={{ fontWeight: 700 }}>
        Horas aprovadas
      </Typography>
      <Typography variant="h4" color="primary.700" sx={{ fontWeight: 800, mt: 1 }}>
        {formatPublicHours(totalHours)}
      </Typography>
      <Stack
        component="ul"
        role="list"
        aria-label="Marcos de horas"
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ flexWrap: "wrap", p: 0, mt: 2, mb: 0, listStyle: "none" }}
      >
        {milestones.map((milestone) => {
          const achieved = totalHours >= milestone;
          return (
            <Box component="li" key={milestone}>
              <Chip
                label={`${milestone} horas — ${achieved ? "alcançado" : "ainda não alcançado"}`}
                color={achieved ? "success" : "default"}
                variant="outlined"
              />
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
