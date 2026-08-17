import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import community from "../../community.config";
import { naEstrada2026, type ScheduleItem, type SponsorshipTier } from "../data/naestrada";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;

function ScheduleTable({ items }: { items: ScheduleItem[] }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.time + item.label}>
              <TableCell sx={{ fontWeight: 700, color: accent, width: 80 }}>{item.time}</TableCell>
              <TableCell>{item.label}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function SponsorshipTable({ tiers }: { tiers: SponsorshipTier[] }) {
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Cota</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Valor</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Benefícios</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tiers.map((tier) => (
            <TableRow key={tier.name}>
              <TableCell sx={{ fontWeight: 700 }}>{tier.name}</TableCell>
              <TableCell>{tier.value}</TableCell>
              <TableCell>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {tier.benefits.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function DevParanaNaEstrada(): React.JSX.Element {
  return (
    <Layout
      title={`DevParaná na Estrada — ${community.shortName}`}
      description="Conheça o evento itinerante DevParaná na Estrada: meetups e workshops em várias cidades do Paraná."
    >
      <Box
        sx={{
          bgcolor: (t) => (t.palette.mode === "dark" ? accentDark : accent),
          color: "#fff",
          py: { xs: 6, md: 8 },
        }}
      >
        <Container maxWidth="lg">
          <Stack spacing={2} maxWidth={760}>
            <Chip
              label={community.name}
              sx={{
                bgcolor: "rgba(255,255,255,0.18)",
                color: "#fff",
                width: "fit-content",
                fontWeight: 600,
              }}
            />
            <Typography variant="h2" component="h1" fontWeight={800}>
              DevParaná na Estrada
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400 }}>
              Levando o espírito da comunidade para várias cidades do Paraná.
            </Typography>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        <Stack spacing={{ xs: 4, md: 6 }}>
          <Box>
            <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
              Sobre o evento
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
              O DevParaná na Estrada é um dos principais eventos da comunidade.
              Iniciado em 2019, leva o espírito de comunidade para cidades de todo o
              estado, fortalecendo grupos locais e criando novas conexões. Já foram
              realizadas edições em 2019, 2022, 2024 e 2025.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
              Formatos
            </Typography>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ height: "100%" }}>
                  <CardContent>
                    <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: accent }}>
                      Meetup
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Para cidades sem encontros recorrentes. Uma noite com 3 slots de
                      50 minutos (palestra de 45 min + 5 min de perguntas).
                    </Typography>
                    <ScheduleTable items={naEstrada2026.formats.meetup.schedule} />
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ height: "100%" }}>
                  <CardContent>
                    <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: accent }}>
                      Workshop + Palestras
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Para cidades com eventos recorrentes. Sábado com workshops pela
                      manhã e palestras à tarde. Inscrição de {naEstrada2026.formats.workshop.price}.
                    </Typography>
                    <ScheduleTable items={naEstrada2026.formats.workshop.schedule} />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>

          <Box>
            <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
              Cidades previstas em {naEstrada2026.year}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              {naEstrada2026.period} — {naEstrada2026.cities.length} cidades.
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {naEstrada2026.cities.map((city) => (
                <Chip key={city} label={city} variant="outlined" />
              ))}
            </Box>
          </Box>

          <Box>
            <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
              Patrocínio local
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              Empresas podem apoiar uma cidade específica, com contrapartidas de
              divulgação e participação no evento.
            </Typography>
            <SponsorshipTable tiers={naEstrada2026.sponsorshipTiers} />
          </Box>

          <Card variant="outlined" sx={{ bgcolor: "action.hover" }}>
            <CardContent>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems={{ md: "center" }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Quer apoiar o DevParaná na Estrada?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Sua doação ajuda a levar o evento para mais cidades do Paraná.
                  </Typography>
                </Box>
                <Button
                  component={Link}
                  to={`${community.basePath}/apoiar`}
                  variant="contained"
                  size="large"
                  startIcon={<VolunteerActivismIcon />}
                  sx={{
                    bgcolor: accent,
                    fontWeight: 700,
                    textTransform: "none",
                    "&:hover": { bgcolor: accentDark },
                  }}
                >
                  Apoiar
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Layout>
  );
}
