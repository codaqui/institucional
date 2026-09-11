import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import PaidIcon from "@mui/icons-material/Paid";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import HubIcon from "@mui/icons-material/Hub";
import SchoolIcon from "@mui/icons-material/School";
import CampaignIcon from "@mui/icons-material/Campaign";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import ForumIcon from "@mui/icons-material/Forum";
import CommunityImpactSection from "@site/comunidades/shared/components/CommunityImpactSection";
import CommunityExploreSection, { type FeatureCard } from "@site/comunidades/shared/components/CommunityExploreSection";
import CommunityChannelsSection from "@site/comunidades/shared/components/CommunityChannelsSection";
import CommunityHead from "@site/comunidades/shared/components/CommunityHead";
import community from "../../community.config";
import {
  EVENTS_MANIFEST_URL,
  type EventIndexFile,
  type EventSummary,
} from "@site/src/data/events";
import { getEventDetailPagePath } from "@site/src/utils/event-override";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;
const highlight = community.theme.accent;
const COMMUNITY_SOURCE_KEYS = community.eventSources ?? [];

function buildFeatureCards(): FeatureCard[] {
  const base = community.basePath;
  const cards: FeatureCard[] = [];
  if (community.features.docs) {
    cards.push({
      icon: <MenuBookIcon fontSize="large" />,
      title: "Quem Somos",
      description: "Conheça a comunidade, seus pilares e parceiros.",
      to: `${base}/docs`,
    });
  }
  cards.push({
    icon: <SchoolIcon fontSize="large" />,
    title: "Mentores",
    description: "Mentores voluntários que compartilham conhecimento com a comunidade.",
    to: `${base}/mentores`,
  });
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

const pilares = [
  {
    icon: <HubIcon fontSize="large" />,
    title: "Networking",
    description:
      "Conectamos você a profissionais experientes e instituições de apoio para que você possa desenvolver sua carreira ou seu negócio.",
  },
  {
    icon: <SchoolIcon fontSize="large" />,
    title: "Conhecimento",
    description:
      "Nossa comunidade produz muito conteúdo sobre tecnologia, desenvolvimento, testes, gestão de projetos, ux design, entre outros temas relevantes.",
  },
  {
    icon: <CampaignIcon fontSize="large" />,
    title: "Divulgação",
    description:
      "Nosso site, canais de comunicação e mídias sociais estarão sempre abertos para divulgar seus projetos, iniciativas e novidades.",
  },
];

function formatEventDate(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(new Date(date));
}

function UpcomingEventsSection(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const eventsHref =
    COMMUNITY_SOURCE_KEYS.length > 0
      ? `${siteConfig.url}/eventos?source=${encodeURIComponent(COMMUNITY_SOURCE_KEYS[0])}`
      : `${siteConfig.url}/eventos`;

  useEffect(() => {
    let active = true;

    async function loadEvents(): Promise<void> {
      try {
        const res = await fetch(EVENTS_MANIFEST_URL);
        if (!res.ok) {
          throw new Error("Não foi possível carregar a agenda de eventos.");
        }
        const payload = (await res.json()) as EventIndexFile;
        const upcoming = payload.events
          .filter(
            (event) =>
              COMMUNITY_SOURCE_KEYS.includes(event.sourceKey) && event.status !== "completed"
          )
          .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
          .slice(0, 3);

        if (active) {
          setEvents(upcoming);
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Erro ao carregar eventos.");
          setLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      active = false;
    };
  }, []);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 }, borderTop: 1, borderColor: "divider" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
            Próximos eventos
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Encontros presenciais e online organizados pela CamposTech.
          </Typography>
        </Box>
        <Button
          component="a"
          href={eventsHref}
          target="_blank"
          rel="noopener noreferrer"
          variant="outlined"
          sx={{ borderColor: accent, color: accent, textTransform: "none" }}
        >
          Ver todos os eventos
        </Button>
      </Stack>

      {loading && (
        <Grid container spacing={3}>
          {Array.from({ length: 3 }).map((_, index) => (
            <Grid key={`event-skeleton-${String(index)}`} size={{ xs: 12, md: 4 }}>
              <Skeleton variant="rounded" height={260} />
            </Grid>
          ))}
        </Grid>
      )}

      {!loading && error && (
        <Alert severity="warning" variant="outlined" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && events.length === 0 && (
        <Alert severity="info" variant="outlined">
          Nenhum evento próximo publicado no momento. Confira a agenda completa para ver eventos
          passados e futuras atualizações.
        </Alert>
      )}

      {!loading && !error && events.length > 0 && (
        <Grid container spacing={3}>
          {events.map((event) => (
            <Grid key={`${event.sourceKey}:${event.id}`} size={{ xs: 12, md: 4 }}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  transition: "all 0.2s",
                  "&:hover": { transform: "translateY(-4px)", boxShadow: 3, borderColor: accent },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5, color: accent }}>
                    <CalendarMonthIcon fontSize="small" />
                    <Typography variant="overline" fontWeight={700} sx={{ lineHeight: 1, mt: 0.5 }}>
                      {formatEventDate(event.startAt, event.timezone)}
                    </Typography>
                  </Stack>

                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    {event.title}
                  </Typography>

                  <Stack spacing={1} sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PlaceOutlinedIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {event.location}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <ForumIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {event.host}
                      </Typography>
                    </Stack>
                  </Stack>
                </CardContent>

                <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ width: "100%" }}>
                    <Button
                      component={Link}
                      to={getEventDetailPagePath(event)}
                      variant="contained"
                      size="small"
                      fullWidth
                      sx={{
                        bgcolor: accent,
                        color: "#fff",
                        "&:hover": { bgcolor: community.theme.primaryLight },
                      }}
                    >
                      Ver detalhes
                    </Button>
                    <Button
                      component="a"
                      href={event.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="outlined"
                      size="small"
                      fullWidth
                      endIcon={<OpenInNewIcon />}
                      sx={{ borderColor: accent, color: accent }}
                    >
                      Ver na Sympla
                    </Button>
                  </Stack>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}

export default function CamposTechHome(): React.JSX.Element {
  return (
    <Layout
      title={`${community.shortName} — Comunidade parceira`}
      description={community.description}
    >
      <CommunityHead
        community={community}
        title={`${community.shortName} — Comunidade parceira`}
        description={community.description}
      />
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
                  {community.tagline}
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
                      "&:hover": { bgcolor: "#ffd964" },
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
              <Box sx={{ width: { xs: 180, md: 260 }, height: "auto", mx: "auto" }}>
                <Box
                  component="img"
                  src={community.logoUrl}
                  alt={`Logo ${community.shortName}`}
                  sx={{ width: "100%", height: "auto", display: "block" }}
                />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container id="pilares" maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
          Como podemos <Box component="span" sx={{ color: accent }}>ajudar?</Box>
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Os três pilares que sustentam o nosso trabalho na região dos Campos Gerais.
        </Typography>
        <Grid container spacing={3}>
          {pilares.map((pilar) => (
            <Grid key={pilar.title} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: "100%", textAlign: "center", py: 3 }}>
                <CardContent>
                  <Box sx={{ color: accent, mb: 2 }}>{pilar.icon}</Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    {pilar.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {pilar.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      <UpcomingEventsSection />

      <CommunityImpactSection community={community} />
      <CommunityExploreSection community={community} featureCards={featureCards} />
      <CommunityChannelsSection community={community} />
    </Layout>
  );
}
