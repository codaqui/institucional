import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Container,
  Grid,
  Skeleton,
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
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import ForumIcon from "@mui/icons-material/Forum";
import CommunityExploreSection, { type FeatureCard } from "@site/comunidades/shared/components/CommunityExploreSection";
import CommunityChannelsSection from "@site/comunidades/shared/components/CommunityChannelsSection";
import community from "../../community.config";
import CommunityHero from "@site/comunidades/shared/components/CommunityHero";
import {
  EVENTS_MANIFEST_URL,
  type EventIndexFile,
  type EventSummary,
} from "@site/src/data/events";
import { getEventDetailPagePath } from "@site/src/utils/event-override";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;
const COMMUNITY_SOURCE_KEYS = community.eventSources ?? [];

function buildFeatureCards(): FeatureCard[] {
  const base = community.basePath;

  const allCards: Array<FeatureCard & { readonly required?: boolean }> = [
    {
      icon: <MenuBookIcon fontSize="large" />,
      title: "Documentação",
      description: "Conheça a história, propósito, RFCs e links do DevParaná.",
      to: `${base}/docs`,
    },
    {
      icon: <GroupsIcon fontSize="large" />,
      title: "Equipe",
      description: "Conheça as pessoas que coordenam a comunidade.",
      to: `${base}/equipe`,
      required: true,
    },
    {
      icon: <ArticleIcon fontSize="large" />,
      title: "Embaixadores",
      description: "Conheça as regiões do Paraná e os embaixadores da comunidade.",
      to: `${base}/embaixadores`,
      required: true,
    },
    {
      icon: <CalendarMonthIcon fontSize="large" />,
      title: "Eventos",
      description: "Veja os próximos encontros do DevParaná e eventos das comunidades parceiras.",
      to: "/eventos",
      required: true,
    },
    {
      icon: <VolunteerActivismIcon fontSize="large" />,
      title: "Apoiar",
      description: `Contribua com doações para manter os eventos do ${community.shortName}.`,
      to: `${base}/apoiar`,
    },
    {
      icon: <PaidIcon fontSize="large" />,
      title: "Transparência",
      description: `Veja saldo, entradas e saídas da conta do ${community.shortName} no ledger Codaqui.`,
      to: `${base}/transparencia`,
    },
  ];

  return allCards.filter((card) => {
    if (card.required) return true;
    if (card.title === "Documentação") return community.features.docs;
    if (card.title === "Apoiar") return community.features.donations;
    if (card.title === "Transparência") return community.features.transparency;
    return true;
  });
}

const featureCards = buildFeatureCards();

function formatEventDate(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(new Date(date));
}

function UpcomingEventsSection(): React.JSX.Element {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            Encontros presenciais e online organizados pelo DevParaná.
          </Typography>
        </Box>
        <Button
          component="a"
          href={
            COMMUNITY_SOURCE_KEYS.length > 0
              ? `https://codaqui.dev/eventos?source=${encodeURIComponent(COMMUNITY_SOURCE_KEYS[0])}`
              : "https://codaqui.dev/eventos"
          }
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
                      to={getEventDetailPagePath(event.source, event.sourceId, event.id)}
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
                      Ver no Meetup
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

export default function DevParanaHome(): React.JSX.Element {
  return (
    <Layout
      title={`${community.shortName} — Comunidade parceira`}
      description={community.description}
    >
      {community.heroVisual ? (
        <CommunityHero community={community} />
      ) : (
        <Box
          sx={{
            bgcolor: (t) => (t.palette.mode === "dark" ? accentDark : accent),
            color: "#fff",
            py: { xs: 6, md: 10 },
          }}
        >
          <Container maxWidth="lg">
            <Stack spacing={3} maxWidth={760}>
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
                      bgcolor: (t) =>
                        t.palette.mode === "dark" ? community.theme.primaryLight : "#f1f5f9",
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
      )}

      <UpcomingEventsSection />

      <CommunityExploreSection community={community} featureCards={featureCards} />
      <CommunityChannelsSection community={community} />
    </Layout>
  );
}
