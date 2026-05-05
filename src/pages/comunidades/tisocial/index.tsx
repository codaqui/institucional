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
import ArticleIcon from "@mui/icons-material/Article";
import PaidIcon from "@mui/icons-material/Paid";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import community from "@site/comunidades/tisocial/community.config";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;

interface FeatureCard {
  icon: React.ReactElement;
  title: string;
  description: string;
  to: string;
}

function buildFeatureCards(): FeatureCard[] {
  const base = community.basePath;
  const cards: FeatureCard[] = [];
  if (community.features.blog) {
    cards.push({
      icon: <ArticleIcon fontSize="large" />,
      title: "Blog",
      description:
        "Prestações de contas, histórias e novidades das ações sociais da comunidade.",
      to: `${base}/blog`,
    });
  }
  if (community.features.docs) {
    cards.push({
      icon: <MenuBookIcon fontSize="large" />,
      title: "Documentação",
      description:
        "Cartilhas, guias e materiais de divulgação para parceiros e protetores.",
      to: `${base}/docs`,
    });
  }
  if (community.features.donations) {
    cards.push({
      icon: <VolunteerActivismIcon fontSize="large" />,
      title: "Apoiar",
      description: `Contribua com doações para campanhas da ${community.shortName}.`,
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

export default function TiSocialHome(): React.JSX.Element {
  return (
    <Layout
      title={`${community.shortName} — Comunidade parceira`}
      description={community.description}
    >
      <Box
        sx={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)`,
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
                  bgcolor: "#fff",
                  color: accentDark,
                  "&:hover": { bgcolor: "#f1f5f9" },
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

      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
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
            <Grid key={stat.label} size={{ xs: 12, sm: 6, md: 3 }}>
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
              <Grid key={feature.title} size={{ xs: 12, sm: 6, md: 3 }}>
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
