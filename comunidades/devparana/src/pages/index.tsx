import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import GroupsIcon from "@mui/icons-material/Groups";
import ArticleIcon from "@mui/icons-material/Article";
import PaidIcon from "@mui/icons-material/Paid";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CommunityImpactSection from "@site/comunidades/shared/components/CommunityImpactSection";
import CommunityExploreSection, { type FeatureCard } from "@site/comunidades/shared/components/CommunityExploreSection";
import CommunityChannelsSection from "@site/comunidades/shared/components/CommunityChannelsSection";
import community from "../../community.config";
import { naEstrada2026 } from "../data/naestrada";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;

function buildFeatureCards(): FeatureCard[] {
  const base = community.basePath;
  const cards: FeatureCard[] = [];

  if (community.features.docs) {
    cards.push({
      icon: <MenuBookIcon fontSize="large" />,
      title: "Documentação",
      description: "Conheça a história, propósito e links do DevParaná.",
      to: `${base}/docs`,
    });
  }

  cards.push({
    icon: <GroupsIcon fontSize="large" />,
    title: "Equipe",
    description: "Conheça as pessoas que coordenam a comunidade.",
    to: `${base}/equipe`,
  });

  cards.push({
    icon: <ArticleIcon fontSize="large" />,
    title: "Embaixadores",
    description: "Conheça as regiões do Paraná e os embaixadores da comunidade.",
    to: `${base}/embaixadores`,
  });

  cards.push({
    icon: <CalendarMonthIcon fontSize="large" />,
    title: "Na Estrada",
    description: "Informações sobre o evento itinerante DevParaná na Estrada.",
    to: `${base}/na-estrada`,
  });

  if (community.features.donations) {
    cards.push({
      icon: <VolunteerActivismIcon fontSize="large" />,
      title: "Apoiar",
      description: `Contribua com doações para manter os eventos do ${community.shortName}.`,
      to: `${base}/apoiar`,
    });
  }

  if (community.features.transparency) {
    cards.push({
      icon: <PaidIcon fontSize="large" />,
      title: "Transparência",
      description: `Veja saldo, entradas e saídas da conta do ${community.shortName} no ledger Codaqui.`,
      to: `${base}/transparencia`,
    });
  }

  return cards;
}

const featureCards = buildFeatureCards();

export default function DevParanaHome(): React.JSX.Element {
  return (
    <Layout
      title={`${community.shortName} — Comunidade parceira`}
      description={community.description}
    >
      <Box
        sx={{
          bgcolor: (t) => (t.palette.mode === "dark" ? accentDark : accent),
          color: "#fff",
          py: { xs: 6, md: 10 },
        }}
      >
        <Container maxWidth="lg">
          <Stack spacing={3} maxWidth={760}>
            <Chip
              label="Comunidade parceira da Codaqui"
              sx={{
                bgcolor: "rgba(255,255,255,0.15)",
                color: "#fff",
                width: "fit-content",
                fontWeight: 600,
              }}
            />
            <Typography variant="h2" component="h1" fontWeight={800}>
              {community.hero.title}
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400 }}>
              {community.hero.subtitle}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Button
                component={Link}
                to={community.hero.ctaPrimary.to}
                variant="contained"
                size="large"
                sx={{
                  bgcolor: (t) => (t.palette.mode === "dark" ? accent : "#fff"),
                  color: (t) => (t.palette.mode === "dark" ? "#fff" : accentDark),
                  "&:hover": {
                    bgcolor: (t) => (t.palette.mode === "dark" ? community.theme.primaryLight : "#f1f5f9"),
                  },
                }}
                startIcon={<VolunteerActivismIcon />}
              >
                {community.hero.ctaPrimary.label}
              </Button>
              {community.hero.ctaSecondary && (
                <Button
                  component="a"
                  href={community.hero.ctaSecondary.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  size="large"
                  sx={{
                    color: "#fff",
                    borderColor: "rgba(255,255,255,0.6)",
                    "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
                  }}
                  endIcon={<OpenInNewIcon />}
                >
                  {community.hero.ctaSecondary.label}
                </Button>
              )}
            </Stack>
          </Stack>
        </Container>
      </Box>

      <CommunityImpactSection community={community} />

      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 }, borderTop: 1, borderColor: "divider" }}>
        <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
          Próximo evento
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          {naEstrada2026.period}: o DevParaná na Estrada passa por {naEstrada2026.cities.length} cidades do Paraná.
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              variant="outlined"
              sx={{
                height: "100%",
                transition: "transform 0.2s",
                "&:hover": { transform: "translateY(-4px)", borderColor: accent },
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, color: accent }}>
                  <CalendarMonthIcon fontSize="small" />
                  <Typography
                    variant="overline"
                    fontWeight={700}
                    sx={{ lineHeight: 1, mt: 0.5 }}
                  >
                    {naEstrada2026.period}
                  </Typography>
                </Stack>
                <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                  DevParaná na Estrada {naEstrada2026.year}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Meetups e workshops em várias cidades do estado. Conheça os formatos,
                  cronograma e como apoiar.
                </Typography>
                <Button
                  component={Link}
                  to={`${community.basePath}/na-estrada`}
                  variant="outlined"
                  sx={{ borderColor: accent, color: accent, textTransform: "none" }}
                >
                  Saiba mais
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      <CommunityExploreSection community={community} featureCards={featureCards} />
      <CommunityChannelsSection community={community} />
    </Layout>
  );
}
