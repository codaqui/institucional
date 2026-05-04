import React, { useEffect, useMemo, useState } from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
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
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ForumIcon from "@mui/icons-material/Forum";
import GroupsIcon from "@mui/icons-material/Groups";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import RepeatIcon from "@mui/icons-material/Repeat";
import PageHero from "../components/PageHero";
import DiscordServerWidget from "../components/DiscordServerWidget";
import {
  EVENTS_MANIFEST_URL,
  type EventIndexFile,
  type EventSourceSummary,
  type EventSummary,
} from "../data/events";

function formatEventDate(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(new Date(date));
}

function getStatusLabel(status?: string): string | null {
  switch (status) {
    case "scheduled":
      return "Agendado";
    case "active":
      return "Ao vivo";
    case "completed":
      return "Concluido";
    case "canceled":
      return "Cancelado";
    default:
      return null;
  }
}

function getStatusColor(status?: string): "default" | "success" | "warning" | "error" {
  switch (status) {
    case "active":
      return "success";
    case "completed":
      return "default";
    case "canceled":
      return "error";
    default:
      return "warning";
  }
}

function EventCard({
  event,
  sourceMeta,
}: {
  readonly event: EventSummary;
  readonly sourceMeta?: EventSourceSummary;
}): React.JSX.Element {
  const isExternal = event.href.startsWith("http");
  const statusLabel = getStatusLabel(event.status);

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.2s",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: 3,
          borderColor: "primary.main",
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 2 }}>
          <Chip
            label={`${sourceMeta?.emoji ?? "📌"} ${sourceMeta?.label ?? event.source}`}
            size="small"
            color={sourceMeta?.type === "discord" ? "primary" : "default"}
            variant="outlined"
          />
          {statusLabel ? (
            <Chip label={statusLabel} size="small" color={getStatusColor(event.status)} />
          ) : null}
          {event.featured ? <Chip label="Destaque" size="small" color="success" /> : null}
          {event.recurrenceLabel ? (
            <Chip
              icon={<RepeatIcon />}
              label={event.recurrenceLabel}
              size="small"
              variant="outlined"
            />
          ) : null}
        </Stack>

        {event.imageUrl ? (
          <Box
            sx={{
              mb: 2,
              borderRadius: 2,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box
              component="img"
              src={event.imageUrl}
              alt={event.title}
              sx={{ display: "block", width: "100%", height: 160, objectFit: "cover" }}
            />
          </Box>
        ) : null}

        <Typography variant="h5" fontWeight={700} gutterBottom>
           {event.title}
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          {event.summary}
        </Typography>

        <Stack spacing={1.25} sx={{ mb: 2.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CalendarMonthIcon color="primary" fontSize="small" />
            <Typography variant="body2">{formatEventDate(event.startAt, event.timezone)}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <ForumIcon color="primary" fontSize="small" />
            <Typography variant="body2">
              {event.platform} · com{" "}
              {event.organizers?.length
                ? event.organizers.length === 1
                  ? event.organizers[0].name
                  : `${event.organizers.slice(0, -1).map((o) => o.name).join(", ")} e ${event.organizers.at(-1)!.name}`
                : (event.creatorName ?? event.host)}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <PlaceOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="body2">{event.location}</Typography>
          </Stack>
          {typeof event.userCount === "number" && event.userCount > 0 ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <GroupsIcon color="primary" fontSize="small" />
              <Typography variant="body2">{event.userCount} pessoa(s) interessadas</Typography>
            </Stack>
          ) : null}
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {event.tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" variant="outlined" />
          ))}
        </Stack>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        <Button
          component={Link}
          href={event.href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          variant="outlined"
          endIcon={isExternal ? <OpenInNewIcon /> : undefined}
        >
          {event.ctaLabel}
        </Button>
      </CardActions>
    </Card>
  );
}

function scrollToAgenda(): void {
  document.getElementById("agenda")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function EventosPage(): React.JSX.Element {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [sources, setSources] = useState<EventSourceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [visiblePastCount, setVisiblePastCount] = useState(12);
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>("all");

  useEffect(() => {
    let active = true;

    async function loadEvents(): Promise<void> {
      try {
        const response = await fetch(EVENTS_MANIFEST_URL);
        if (!response.ok) {
          throw new Error("Events index unavailable");
        }

        const payload = (await response.json()) as EventIndexFile;
        if (!active) {
          return;
        }

        setSources(payload.sources);
        setEvents(payload.events);
        setLoading(false);
      } catch {
        if (active) {
          setHasError(true);
          setLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      active = false;
    };
  }, []);

  const sourcesById = useMemo(
    () =>
      Object.fromEntries(sources.map((source) => [source.sourceKey, source])) as Record<
        string,
        EventSourceSummary
      >,
    [sources]
  );

  const filteredEvents = useMemo(
    () =>
      selectedSourceKey === "all"
        ? events
        : events.filter((event) => event.sourceKey === selectedSourceKey),
    [events, selectedSourceKey]
  );

  const upcomingEvents = useMemo(
    () =>
      [...filteredEvents]
        .filter((event) => event.status !== "completed")
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [filteredEvents]
  );

  const pastEvents = useMemo(
    () =>
      [...filteredEvents]
        .filter((event) => event.status === "completed")
        .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()),
    [filteredEvents]
  );

  const primaryDiscordSource = sources.find((source) => source.source === "discord");

  useEffect(() => {
    setVisiblePastCount(12);
  }, [selectedSourceKey]);

  return (
    <Layout
      title="Eventos"
      description="Acompanhe os próximos encontros, cursos e atividades da comunidade Codaqui."
    >
      <PageHero
        eyebrow="Agenda da comunidade"
        title="Eventos da Codaqui"
        subtitle="Descubra encontros da Associação Codaqui e de comunidades parceiras, com filtros para explorar cada iniciativa sem perder a visão geral."
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
          <Button
            onClick={scrollToAgenda}
            variant="contained"
            size="large"
            sx={{
              bgcolor: "common.white",
              color: "primary.dark",
              fontWeight: 700,
              "&:hover": { bgcolor: "grey.100" },
            }}
          >
            Ver agenda
          </Button>
          <Button
            component={Link}
            href={primaryDiscordSource?.ctaHref ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            size="large"
            endIcon={<OpenInNewIcon />}
            sx={{
              color: "common.white",
              borderColor: "rgba(255,255,255,0.45)",
              fontWeight: 700,
              "&:hover": { borderColor: "common.white", bgcolor: "rgba(255,255,255,0.08)" },
            }}
            disabled={!primaryDiscordSource?.ctaHref}
          >
            {primaryDiscordSource?.ctaLabel ?? "Entrar na comunidade"}
          </Button>
        </Stack>
      </PageHero>

      <Box sx={{ bgcolor: "background.default", py: { xs: 4, md: 5 } }}>
        <Container maxWidth="lg">
          <Alert severity="info" variant="outlined">
            A agenda é atualizada automaticamente a partir das nossas integrações com plataformas da
            comunidade, reunindo os próximos encontros em um só lugar.
          </Alert>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ pt: { xs: 4, md: 5 } }}>
        <Grid container spacing={2}>
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Grid key={`stat-skeleton-${String(index)}`} size={{ xs: 12, md: 4 }}>
                <Skeleton variant="rounded" height={110} />
              </Grid>
            ))
          ) : (
            <>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">
                      Eventos publicados
                    </Typography>
                    <Typography variant="h4" fontWeight={800}>
                      {filteredEvents.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedSourceKey === "all"
                        ? "Total de eventos publicados."
                        : "Total de eventos na comunidade filtrada."}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">
                      Recorrentes
                    </Typography>
                    <Typography variant="h4" fontWeight={800}>
                      {filteredEvents.filter((event) => Boolean(event.recurrenceRule)).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Eventos que se repetem regularmente.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">
                      Inscrições somadas
                    </Typography>
                    <Typography variant="h4" fontWeight={800}>
                      {filteredEvents.reduce((total, event) => total + (event.userCount ?? 0), 0)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total de participantes interessados.
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}
        </Grid>
      </Container>

      <Box id="agenda" sx={{ bgcolor: "action.hover", py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={3} alignItems="stretch">
            <Grid size={{ xs: 12, lg: 7 }}>
              {primaryDiscordSource?.widgetUrl ? (
                <DiscordServerWidget widgetUrl={primaryDiscordSource.widgetUrl} />
              ) : (
                <Alert severity="info" variant="outlined">
                  Nenhuma fonte Discord configurada nos índices de eventos.
                </Alert>
              )}
            </Grid>
            <Grid size={{ xs: 12, lg: 5 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Typography variant="h5" fontWeight={700} gutterBottom>
                    Fontes de eventos
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Eventos agregados de diferentes comunidades e plataformas parceiras da Codaqui.
                  </Typography>

                  <Stack spacing={1.5} sx={{ mb: 3 }}>
                    {sources.map((source) => (
                      <Box
                        key={source.sourceKey}
                        sx={{
                          p: 1.5,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                          bgcolor: "background.default",
                        }}
                      >
                        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                          {source.emoji} {source.label}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {source.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                          {source.itemCount} evento(s)
                          {source.generatedAt
                            ? ` · atualizado em ${new Date(source.generatedAt).toLocaleDateString("pt-BR")}`
                            : null}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>

                  <Stack spacing={1.5}>
                    {sources
                      .filter((source) => source.ctaHref && source.ctaLabel)
                      .map((source) => {
                        const isExternal = source.ctaHref?.startsWith("http") ?? false;
                        return (
                        <Button
                          key={source.sourceKey}
                          component={Link}
                          href={source.ctaHref}
                          target={isExternal ? "_blank" : undefined}
                          rel={
                            isExternal ? "noopener noreferrer" : undefined
                          }
                          variant="outlined"
                          endIcon={
                            isExternal ? <OpenInNewIcon /> : undefined
                          }
                        >
                          {source.ctaLabel}
                        </Button>
                        );
                      })}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        {loading ? null : (
          <Card variant="outlined" sx={{ mb: 4 }}>
            <CardContent sx={{ p: { xs: 2, md: 3 } }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    label={`Tudo (${events.length})`}
                    color={selectedSourceKey === "all" ? "primary" : "default"}
                    variant={selectedSourceKey === "all" ? "filled" : "outlined"}
                    onClick={() => setSelectedSourceKey("all")}
                    clickable
                  />
                  {sources.map((source) => (
                    <Chip
                      key={source.sourceKey}
                      label={`${source.emoji} ${source.label} (${source.itemCount})`}
                      color={selectedSourceKey === source.sourceKey ? "primary" : "default"}
                      variant={selectedSourceKey === source.sourceKey ? "filled" : "outlined"}
                      onClick={() => setSelectedSourceKey(source.sourceKey)}
                      clickable
                    />
                  ))}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {selectedSourceKey === "all"
                    ? "Você está vendo a visão geral com todas as comunidades integradas."
                    : `Filtro ativo: ${sourcesById[selectedSourceKey]?.label ?? "comunidade selecionada"}.`}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        )}

        <Stack spacing={2} sx={{ mb: 4 }}>
            <Typography variant="h4" fontWeight={800}>
              Agenda completa
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Eventos futuros da seleção atual, reunidos em um único lugar.
            </Typography>
          </Stack>

        {loading && (
          <Grid container spacing={3}>
            {Array.from({ length: 3 }).map((_, index) => (
              <Grid key={`upcoming-skeleton-${String(index)}`} size={{ xs: 12, md: 6, xl: 4 }}>
                <Skeleton variant="rounded" height={280} />
              </Grid>
            ))}
          </Grid>
        )}
        
        {!loading && hasError && (
          <Alert severity="warning" variant="outlined">
            Não foi possível carregar a agenda completa neste momento.
          </Alert>
        )}
        
        {!loading && !hasError && upcomingEvents.length > 0 && (
          <Grid container spacing={3}>
            {upcomingEvents.map((event) => (
              <Grid key={`${event.sourceKey}:${event.id}`} size={{ xs: 12, md: 6, xl: 4 }}>
                <EventCard event={event} sourceMeta={sourcesById[event.sourceKey]} />
              </Grid>
            ))}
          </Grid>
        )}
        
        {!loading && !hasError && upcomingEvents.length === 0 && (
          <Alert severity="info" variant="outlined">
            Nenhum evento foi publicado ainda.
          </Alert>
        )}
      </Container>

      <Box sx={{ bgcolor: "action.hover", py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Stack spacing={2} sx={{ mb: 4 }}>
            <Typography variant="h4" fontWeight={800}>
              Histórico da comunidade
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Eventos anteriores continuam acessíveis para consulta, com espaço para destacar a trajetória de cada comunidade.
            </Typography>
          </Stack>

          {loading && (
            <Grid container spacing={3}>
              {Array.from({ length: 3 }).map((_, index) => (
                <Grid key={`past-skeleton-${String(index)}`} size={{ xs: 12, md: 6, xl: 4 }}>
                  <Skeleton variant="rounded" height={280} />
                </Grid>
              ))}
            </Grid>
          )}
          
          {!loading && pastEvents.length > 0 && (
            <>
              <Grid container spacing={3}>
                {pastEvents.slice(0, visiblePastCount).map((event) => (
                  <Grid key={`${event.sourceKey}:${event.id}`} size={{ xs: 12, md: 6, xl: 4 }}>
                    <EventCard event={event} sourceMeta={sourcesById[event.sourceKey]} />
                  </Grid>
                ))}
              </Grid>

              {visiblePastCount < pastEvents.length ? (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
                  <Button variant="outlined" onClick={() => setVisiblePastCount((count) => count + 12)}>
                    Carregar mais eventos passados
                  </Button>
                </Box>
              ) : null}
            </>
          )}
          
          {!loading && pastEvents.length === 0 && (
            <Alert severity="info" variant="outlined">
              Ainda não há eventos passados indexados.
            </Alert>
          )}
        </Container>
      </Box>
    </Layout>
  );
}
