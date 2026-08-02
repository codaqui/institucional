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
import PaidIcon from "@mui/icons-material/Paid";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PodcastsIcon from "@mui/icons-material/Podcasts";
import GroupsIcon from "@mui/icons-material/Groups";
import community from "../../community.config";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;
const accentLight = community.theme.primaryLight;
const highlight = community.theme.accent;

interface FeatureCard {
  icon: React.ReactElement;
  title: string;
  description: string;
  to: string;
}

function buildFeatureCards(): FeatureCard[] {
  const base = community.basePath;
  const cards: FeatureCard[] = [];
  if (community.features.docs) {
    cards.push({
      icon: <MenuBookIcon fontSize="large" />,
      title: "Documentação",
      description: "Conheça nossas áreas de atuação e como participar.",
      to: `${base}/docs`,
    });
  }
  if (community.features.donations) {
    cards.push({
      icon: <VolunteerActivismIcon fontSize="large" />,
      title: "Apoiar",
      description: `Contribua com doações para a ${community.shortName}.`,
      to: `${base}/apoiar`,
    });
  }
  if (community.features.transparency) {
    cards.push({
      icon: <PaidIcon fontSize="large" />,
      title: "Transparência",
      description: `Veja saldo, entradas e saídas da conta da ${community.shortName} no ledger Codaqui.`,
      to: `${base}/transparencia`,
    });
  }
  return cards;
}

const featureCards = buildFeatureCards();
const stats = community.impact?.stats ?? [];

const actions = [
  {
    icon: <PodcastsIcon fontSize="large" />,
    title: "Podcast Elas no Código",
    status: "Em breve",
    description: "Disponível no seu agregador de streamings.",
  },
  {
    icon: <MenuBookIcon fontSize="large" />,
    title: "Cursos de JavaScript e Java",
    status: "Matrículas encerradas",
    description: "Estudo personalizado e direcionado às suas necessidades.",
  },
  {
    icon: <GroupsIcon fontSize="large" />,
    title: "Encontros e lives",
    status: "3 encontros",
    description: "Conteúdo gratuito e colaborativo, disponível no YouTube.",
  },
];

export default function ElasNoCodigoHome(): React.JSX.Element {
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
          <Grid container spacing={4} alignItems="center">
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={3} maxWidth={700}>
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
                  Olá, nós somos <Box component="span" sx={{ color: highlight }}>{community.shortName}</Box>
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400 }}>
                  Apoiamos e incentivamos <Box component="span" sx={{ color: highlight, fontWeight: 700 }}>mulheres</Box> na tecnologia.
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  {community.description}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Button
                    component={Link}
                    to={community.hero.ctaPrimary.to}
                    variant="contained"
                    size="large"
                    sx={{
                      bgcolor: highlight,
                      color: accentDark,
                      fontWeight: 700,
                      "&:hover": { bgcolor: "#ffca28" },
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
            </Grid>
            <Grid size={{ xs: 12, md: 5 }} sx={{ textAlign: "center" }}>
              <Box sx={{ position: "relative", width: { xs: 180, md: 260 }, height: "auto", mx: "auto" }}>
                <Box
                  component="img"
                  src={community.logoUrl}
                  alt={`Logo ${community.shortName}`}
                  className="community-logo-light"
                  sx={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                  }}
                />
                {community.logoUrlDark && (
                  <Box
                    component="img"
                    src={community.logoUrlDark}
                    alt={`Logo ${community.shortName}`}
                    className="community-logo-dark"
                    sx={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "auto",
                      display: "none",
                    }}
                  />
                )}
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container id="acoes" maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
          Nossas <Box component="span" sx={{ color: accent }}>ações</Box>
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Conheça nosso trabalho de inclusão de mulheres na tecnologia.
        </Typography>
        <Grid container spacing={3}>
          {actions.map((action) => (
            <Grid key={action.title} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: "100%", textAlign: "center", py: 3 }}>
                <CardContent>
                  <Box sx={{ color: accent, mb: 2 }}>{action.icon}</Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    {action.title}
                  </Typography>
                  <Chip label={action.status} size="small" sx={{ mb: 1.5, bgcolor: highlight, color: accentDark, fontWeight: 600 }} />
                  <Typography variant="body2" color="text.secondary">
                    {action.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 }, borderTop: 1, borderColor: "divider" }}>
        <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
          {community.impact?.title ?? "Impacto recente"}
        </Typography>
        {community.impact?.subtitle && (
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            {community.impact.subtitle}
          </Typography>
        )}
        <Grid container spacing={3}>
          {stats.map((stat) => (
            <Grid key={stat.label} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: "100%", textAlign: "center", py: 3 }}>
                <CardContent>
                  <Typography
                    variant="h3"
                    fontWeight={800}
                    sx={{ color: accent, mb: 1 }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {stat.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <Box sx={{ bgcolor: "action.hover", py: { xs: 5, md: 8 } }}>
        <Container maxWidth="lg">
          <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
            {community.exploreSection?.title ?? "Explore a comunidade"}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            {community.exploreSection?.subtitle
              ?? `Tudo que a ${community.shortName} oferece dentro do portal Codaqui.`}
          </Typography>
          <Grid container spacing={3}>
            {featureCards.map((feature) => (
              <Grid key={feature.title} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  sx={{
                    height: "100%",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    "&:hover": { transform: "translateY(-4px)", boxShadow: 6 },
                  }}
                >
                  <CardActionArea component={Link} to={feature.to} sx={{ height: "100%" }}>
                    <CardContent>
                      <Box sx={{ color: accent, mb: 2 }}>{feature.icon}</Box>
                      <Typography variant="h6" fontWeight={700} gutterBottom>
                        {feature.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {feature.description}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 }, textAlign: "center" }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {community.channelsSection?.title ?? "Quer saber mais?"}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {community.channelsSection?.subtitle
            ?? `Acesse os canais oficiais da ${community.name}.`}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
          {community.externalLinks.map((link) => (
            <Button
              key={link.href}
              component="a"
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              endIcon={<OpenInNewIcon />}
            >
              {link.label}
            </Button>
          ))}
        </Stack>
      </Container>
    </Layout>
  );
}
