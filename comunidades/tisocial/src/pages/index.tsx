import React from "react";
import Layout from "@theme/Layout";
import {
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import ArticleIcon from "@mui/icons-material/Article";
import PaidIcon from "@mui/icons-material/Paid";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CommunityImpactSection from "@site/comunidades/shared/components/CommunityImpactSection";
import CommunityExploreSection, { type FeatureCard } from "@site/comunidades/shared/components/CommunityExploreSection";
import CommunityChannelsSection from "@site/comunidades/shared/components/CommunityChannelsSection";
import CommunityTextHero from "@site/comunidades/shared/components/CommunityTextHero";
import community from "../../community.config";
import upcoming from "../data/upcoming.json";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;

function buildFeatureCards(): FeatureCard[] {
  const base = community.basePath;
  const cards: FeatureCard[] = [];
  if (community.features.blog) {
    cards.push({
      icon: <ArticleIcon fontSize="large" />,
      title: "Campanhas",
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

export default function TiSocialHome(): React.JSX.Element {
  return (
    <Layout
      title={`${community.shortName} — Comunidade parceira`}
      description={community.description}
    >
      <CommunityTextHero community={community} />

      <CommunityImpactSection community={community} />

      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 }, borderTop: 1, borderColor: "divider" }}>
        <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
          Próximas Campanhas
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Confira o cronograma de ações sociais planejadas para os próximos meses.
        </Typography>
        <Grid container spacing={2}>
          {upcoming.map((item) => (
            <Grid key={item.action} size={{ xs: 12, sm: 6, md: 3 }}>
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
                      {item.date}
                    </Typography>
                  </Stack>
                  <Typography variant="body1" fontWeight={700} sx={{ lineHeight: 1.3 }}>
                    {item.action}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <CommunityExploreSection community={community} featureCards={featureCards} />
      <CommunityChannelsSection community={community} />
    </Layout>
  );
}
