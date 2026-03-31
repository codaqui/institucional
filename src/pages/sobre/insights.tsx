import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GroupsIcon from "@mui/icons-material/Groups";
import EventIcon from "@mui/icons-material/Event";
import SchoolIcon from "@mui/icons-material/School";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import GitHubIcon from "@mui/icons-material/GitHub";
import YouTubeIcon from "@mui/icons-material/YouTube";
import InstagramIcon from "@mui/icons-material/Instagram";
import SiteAnalytics from "../../components/SiteAnalytics";
import { timelineEvents, type TimelineEvent, type TimelineStats } from "../../data/timeline";
import { communities } from "../../data/communities";
import { codaquiSocialProfiles } from "../../data/social";
import {
  SOCIAL_STATS_URL,
  type SocialStatsSnapshot,
  type SocialStatEntry,
} from "../../data/social-stats";

// ─── Platform helpers ─────────────────────────────────────────────────────────

const PLATFORM_META: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  discord: {
    icon: <GroupsIcon fontSize="small" />,
    color: "#5865f2",
    label: "Discord",
  },
  meetup: {
    icon: <EventIcon fontSize="small" />,
    color: "#e0393e",
    label: "Meetup",
  },
  youtube: {
    icon: <YouTubeIcon fontSize="small" />,
    color: "#ff0000",
    label: "YouTube",
  },
  instagram: {
    icon: <InstagramIcon fontSize="small" />,
    color: "#e1306c",
    label: "Instagram",
  },
  github: {
    icon: <GitHubIcon fontSize="small" />,
    color: "text.primary",
    label: "GitHub",
  },
  cncf: {
    icon: (
      <Box
        component="img"
        src="https://avatars.githubusercontent.com/u/13455738?v=4"
        alt="CNCF"
        sx={{ width: 16, height: 16, borderRadius: "50%" }}
      />
    ),
    color: "#446ca9",
    label: "CNCF Community",
  },
  website: {
    icon: (
      <Typography component="span" sx={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>
        🌐
      </Typography>
    ),
    color: "text.secondary",
    label: "Website",
  },
  twitter: {
    icon: (
      <Typography component="span" sx={{ fontSize: 14, fontWeight: 800, lineHeight: 1 }}>
        𝕏
      </Typography>
    ),
    color: "#1da1f2",
    label: "Twitter/X",
  },
  whatsapp: {
    icon: (
      <Typography component="span" sx={{ fontSize: 13, lineHeight: 1 }}>
        💬
      </Typography>
    ),
    color: "#25d366",
    label: "WhatsApp",
  },
};

function platformIcon(platform: string) {
  return PLATFORM_META[platform]?.icon ?? null;
}

function platformColor(platform: string) {
  return PLATFORM_META[platform]?.color ?? "primary.main";
}

// ─── Number formatting ────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}K`;
  return n > 0 ? String(n) : "–";
}

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  value: string;
  label: string;
  color?: string;
}

function StatCard({ icon, value, label, color }: StatCardProps) {
  return (
    <Paper
      elevation={0}
      sx={{ textAlign: "center", py: 2.5, px: 1, bgcolor: "action.hover", borderRadius: 2 }}
    >
      <Box sx={{ color: color ?? "primary.main", mb: 0.5 }}>{icon}</Box>
      <Typography variant="h5" fontWeight={800} color={color ?? "primary.main"}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

// ─── Social stat chip ─────────────────────────────────────────────────────────

function SocialStatChip({ entry }: { entry: SocialStatEntry }) {
  const color = platformColor(entry.platform);
  const icon = platformIcon(entry.platform);
  // Platforms without automated fetch show as link-only chips (no count)
  const hasCount = !entry.isFallback || entry.count > 0;

  return (
    <Tooltip
      title={
        !hasCount
          ? `${entry.handle} — clique para visitar`
          : entry.isFallback
          ? "Valor estimado — ainda não sincronizado"
          : `Atualizado em ${entry.fetchedAt ? new Date(entry.fetchedAt).toLocaleDateString("pt-BR") : "—"}`
      }
    >
      <Chip
        component="a"
        href={entry.url}
        target="_blank"
        rel="noopener noreferrer"
        clickable
        icon={
          <Box component="span" sx={{ color: `${color} !important`, display: "flex" }}>
            {icon}
          </Box>
        }
        label={
          hasCount ? (
            <Box component="span">
              <Box component="span" sx={{ fontWeight: 800 }}>
                {formatCount(entry.count)}
              </Box>{" "}
              <Box component="span" sx={{ fontWeight: 400, opacity: 0.8 }}>
                {entry.countLabel}
              </Box>
              {entry.isFallback && (
                <Box component="span" sx={{ ml: 0.5, opacity: 0.5, fontSize: "0.7rem" }}>
                  ~
                </Box>
              )}
            </Box>
          ) : (
            <Box component="span" sx={{ fontWeight: 400, opacity: 0.85 }}>
              {entry.handle}
            </Box>
          )
        }
        variant="outlined"
        sx={{
          "& .MuiChip-icon": { ml: "6px" },
          "&:hover": { bgcolor: "action.selected" },
        }}
      />
    </Tooltip>
  );
}

// ─── Presence card (unified: Codaqui + communities) ──────────────────────────

interface PresenceCardProps {
  entityId: string;
  name: string;
  logo: string;
  description: string;
  profiles: SocialStatEntry[];
  location?: string;
  tags?: string[];
  primaryLink?: { label: string; url: string };
}

function PresenceCard({
  entityId: _entityId,
  name,
  logo,
  description,
  profiles,
  location,
  tags,
  primaryLink,
}: PresenceCardProps) {
  // Always show all profiles: those with count show stats, those without show as links
  return (
    <Card variant="outlined" sx={{ height: "100%", "&:hover": { boxShadow: 3 }, transition: "box-shadow 0.2s" }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 0.5 }}>
          <Avatar src={logo} alt={name} sx={{ width: 44, height: 44 }} />
          <Box>
            <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
              {name}
            </Typography>
            {location && (
              <Typography variant="caption" color="text.secondary">
                📍 {location}
              </Typography>
            )}
          </Box>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, mt: 1 }}>
          {description}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: tags?.length ? 1.5 : 0 }}>
          {profiles.length === 0 ? (
            <Typography variant="caption" color="text.disabled">
              Estatísticas ainda não disponíveis
            </Typography>
          ) : (
            profiles.map((p) => (
              <SocialStatChip key={`${p.entityId}-${p.platform}`} entry={p} />
            ))
          )}
        </Stack>
        {tags && tags.length > 0 && (
          <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: primaryLink ? 1 : 0 }}>
            {tags.map((t) => (
              <Chip key={t} label={t} size="small" variant="outlined" />
            ))}
          </Stack>
        )}
        {primaryLink && (
          <Button
            href={primaryLink.url}
            target="_blank"
            rel="noopener noreferrer"
            endIcon={<OpenInNewIcon />}
            size="small"
            variant="text"
            sx={{ mt: 0.5, textTransform: "none" }}
          >
            {primaryLink.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Timeline components ───────────────────────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  success: "success.main",
  info: "info.main",
  warning: "warning.main",
  error: "error.main",
  primary: "primary.main",
  secondary: "secondary.main",
  grey: "grey.500",
};

function StatsFigures({ stats }: { stats: TimelineStats[] }) {
  return (
    <Stack
      direction="row"
      sx={{ flexWrap: "wrap", gap: { xs: "6px 16px", sm: "4px 24px" }, mb: 2 }}
    >
      {stats.map((s) => (
        <Box key={s.label}>
          <Typography
            component="span"
            variant="h6"
            fontWeight={800}
            sx={{ lineHeight: 1, mr: 0.5 }}
          >
            {s.value}
          </Typography>
          <Typography
            component="span"
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}
          >
            {s.label}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function ChapterItems({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);
  const threshold = 4;
  const hasMore = items.length > threshold;
  const visible = hasMore && !open ? items.slice(0, threshold) : items;

  return (
    <>
      <Box component="ul" sx={{ pl: 2, m: 0, "& li + li": { mt: 0.5 } }}>
        {visible.map((item, i) => (
          <Box component="li" key={i}>
            <Typography variant="body2" color="text.secondary">
              {item}
            </Typography>
          </Box>
        ))}
      </Box>
      {hasMore && (
        <Collapse in={open}>
          <Box component="ul" sx={{ pl: 2, mt: 0.5, m: 0, "& li + li": { mt: 0.5 } }}>
            {items.slice(threshold).map((item, i) => (
              <Box component="li" key={i}>
                <Typography variant="body2" color="text.secondary">
                  {item}
                </Typography>
              </Box>
            ))}
          </Box>
        </Collapse>
      )}
      {hasMore && (
        <Button
          size="small"
          onClick={() => setOpen((v) => !v)}
          endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ textTransform: "none", mt: 1, px: 0, color: "text.secondary" }}
        >
          {open ? "Recolher" : `+${items.length - threshold} detalhes`}
        </Button>
      )}
    </>
  );
}

function TimelineChapter({
  event,
  index,
  isMobile,
  isLast,
}: {
  event: TimelineEvent;
  index: number;
  isMobile: boolean;
  isLast: boolean;
}) {
  const isEven = index % 2 === 0;
  const isCurrent = event.tag === "Em andamento";
  const accentColor = COLOR_MAP[event.color] ?? "primary.main";

  const card = (
    <Box
      sx={{
        position: "relative",
        bgcolor: isCurrent ? "action.selected" : "background.paper",
        border: "1px solid",
        borderColor: isCurrent ? "primary.main" : "divider",
        borderRadius: 2,
        overflow: "hidden",
        transition: "box-shadow 0.2s",
        "&:hover": { boxShadow: 4 },
      }}
    >
      {/* Top accent bar */}
      <Box sx={{ height: 3, bgcolor: accentColor }} />

      {/* Faded year watermark */}
      <Typography
        sx={{
          position: "absolute",
          top: -8,
          right: 12,
          fontSize: { xs: "4.5rem", md: "6rem" },
          fontWeight: 900,
          lineHeight: 1,
          color: "text.primary",
          opacity: 0.04,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {event.year}
      </Typography>

      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        {/* Header */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }} flexWrap="wrap">
          <Typography component="span" sx={{ fontSize: "1.25rem", lineHeight: 1 }}>
            {event.icon}
          </Typography>
          <Typography variant="h6" fontWeight={800} sx={{ lineHeight: 1.2 }}>
            {event.label}
          </Typography>
          {event.tag && (
            <Chip
              label={event.tag}
              size="small"
              color={event.color === "grey" ? "default" : event.color}
              variant={isCurrent ? "filled" : "outlined"}
              sx={{ fontWeight: 700, fontSize: "0.7rem" }}
            />
          )}
        </Stack>

        {/* Description */}
        {event.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: event.stats?.length ? 2 : 1.5, lineHeight: 1.6 }}
          >
            {event.description}
          </Typography>
        )}

        {/* Stats as figures */}
        {event.stats && event.stats.length > 0 && (
          <>
            <StatsFigures stats={event.stats} />
            <Divider sx={{ mb: 1.5 }} />
          </>
        )}

        {/* Highlights as left-bordered callout */}
        {event.highlights && event.highlights.length > 0 && (
          <Box
            sx={{
              borderLeft: 3,
              borderColor: accentColor,
              pl: 1.5,
              mb: 1.5,
              "& + &": { mt: 0.5 },
            }}
          >
            {event.highlights.map((h) => (
              <Typography key={h} variant="body2" fontWeight={600} sx={{ lineHeight: 1.5 }}>
                {h}
              </Typography>
            ))}
          </Box>
        )}

        {/* Items */}
        <ChapterItems items={event.items} />
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Box sx={{ display: "flex", gap: 2, mb: isLast ? 0 : 1 }}>
        {/* Line + dot */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              bgcolor: accentColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1rem",
              flexShrink: 0,
              boxShadow: 2,
            }}
          >
            {event.icon}
          </Box>
          {!isLast && (
            <Box sx={{ width: 2, flex: 1, mt: 1, mb: -1, bgcolor: "divider", minHeight: 32 }} />
          )}
        </Box>

        {/* Year + card */}
        <Box sx={{ flex: 1, pb: isLast ? 0 : 4 }}>
          <Typography variant="overline" fontWeight={800} color="text.disabled" sx={{ lineHeight: 1, mb: 0.75, display: "block" }}>
            {event.year}
          </Typography>
          {card}
        </Box>
      </Box>
    );
  }

  // Desktop: alternating layout
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "1fr 56px 1fr",
        mb: isLast ? 0 : 1,
        alignItems: "start",
      }}
    >
      {/* Left column */}
      <Box sx={{ pr: 3, textAlign: "right", pt: 1, pb: isLast ? 0 : 5 }}>
        {!isEven && card}
        {isEven && (
          <Typography
            variant="h3"
            fontWeight={900}
            sx={{ color: "text.disabled", opacity: 0.35, lineHeight: 1 }}
          >
            {event.year}
          </Typography>
        )}
      </Box>

      {/* Center line + dot */}
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            bgcolor: accentColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.25rem",
            flexShrink: 0,
            boxShadow: 3,
            zIndex: 1,
          }}
        >
          {event.icon}
        </Box>
        {!isLast && (
          <Box sx={{ width: 2, flex: 1, bgcolor: "divider", minHeight: 40 }} />
        )}
      </Box>

      {/* Right column */}
      <Box sx={{ pl: 3, pt: 1, pb: isLast ? 0 : 5 }}>
        {isEven && card}
        {!isEven && (
          <Typography
            variant="h3"
            fontWeight={900}
            sx={{ color: "text.disabled", opacity: 0.35, lineHeight: 1 }}
          >
            {event.year}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InsightsPage(): React.JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [snapshot, setSnapshot] = useState<SocialStatsSnapshot | null>(null);

  useEffect(() => {
    fetch(SOCIAL_STATS_URL)
      .then((r) => r.json())
      .then((data: SocialStatsSnapshot) => setSnapshot(data))
      .catch(() => {
        // Build fallback from config baselines
        const now = new Date().toISOString();
        const profiles = [
          ...codaquiSocialProfiles.map((p) => ({
            ...p,
            entityId: "codaqui",
            count: p.baselineCount ?? 0,
            isFallback: true,
            fetchedAt: now,
          })),
          ...communities.flatMap((c) =>
            (c.socialProfiles ?? []).map((p) => ({
              ...p,
              entityId: c.id,
              count: p.baselineCount ?? 0,
              isFallback: true,
              fetchedAt: now,
            }))
          ),
        ];
        setSnapshot({ generatedAt: now, totalEvents: 0, profiles });
      });
  }, []);

  function profilesFor(entityId: string): SocialStatEntry[] {
    return snapshot?.profiles.filter((p) => p.entityId === entityId) ?? [];
  }

  // Hero stats: events + discord + meetup devparana
  const totalEvents = snapshot?.totalEvents ?? 0;
  const discordCount = snapshot?.profiles.find(
    (p) => p.entityId === "codaqui" && p.platform === "discord"
  )?.count ?? 0;
  const meetupCount = snapshot?.profiles.find(
    (p) => p.entityId === "devparana" && p.platform === "meetup"
  )?.count ?? 0;

  const heroStats = [
    {
      icon: <EventIcon />,
      value: totalEvents > 0 ? `${totalEvents}+` : "370+",
      label: "Eventos organizados",
    },
    {
      icon: <GroupsIcon />,
      value: discordCount > 0 ? `${discordCount.toLocaleString("pt-BR")}` : "692+",
      label: "Membros no Discord",
    },
    {
      icon: <PeopleAltIcon />,
      value: meetupCount > 0 ? `${meetupCount.toLocaleString("pt-BR")}` : "2.100+",
      label: "Membros no Meetup",
    },
    {
      icon: <SchoolIcon />,
      value: "126+",
      label: "Mentorias realizadas",
    },
    {
      icon: <AccessTimeIcon />,
      value: "89h+",
      label: "Horas de mentoria",
    },
  ];

  return (
    <Layout
      title="Insights"
      description="Impacto, presença digital e linha do tempo da Codaqui e suas comunidades parceiras"
    >
      {/* ── Hero ── */}
      <Box
        sx={{
          background: (t) =>
            `linear-gradient(135deg, ${t.palette.primary.dark}, ${t.palette.primary.main})`,
          py: { xs: 6, md: 8 },
          textAlign: "center",
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h3" component="h1" fontWeight={800} color="white">
            🔍 Insights
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: "rgba(255,255,255,0.85)", maxWidth: 600, mx: "auto", mt: 2 }}
          >
            Impacto, presença digital e trajetória da Codaqui e das comunidades parceiras
          </Typography>
        </Container>
      </Box>

      {/* ── Stats bar ── */}
      <Box sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}>
        <Container maxWidth="lg" sx={{ py: 3 }}>
          <Grid container spacing={2}>
            {heroStats.map((s) => (
              <Grid key={s.label} size={{ xs: 6, sm: 4, md: 12 / 5 }}>
                <StatCard {...s} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── Alcance do Site ── */}
      <SiteAnalytics />

      {/* ── Presença Digital ── */}
      <Box sx={{ bgcolor: "background.default", py: { xs: 5, md: 7 } }}>
        <Container maxWidth="lg">
          <Typography variant="h5" fontWeight={800} gutterBottom>
            📡 Presença Digital
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Canais oficiais da Codaqui e das comunidades parceiras — acompanhe onde estamos.
            Instagram e YouTube aparecem como links diretos (sem API pública de contagem).
          </Typography>

          <Grid container spacing={3}>
            {/* Codaqui */}
            <Grid size={{ xs: 12, md: 6 }}>
              <PresenceCard
                entityId="codaqui"
                name="Codaqui"
                logo="/img/logo.png"
                description="Associação sem fins lucrativos que democratiza o acesso à educação em tecnologia para jovens."
                profiles={profilesFor("codaqui")}
                tags={["educação", "tecnologia", "inclusão"]}
                primaryLink={{ label: "codaqui.dev", url: "https://codaqui.dev" }}
              />
            </Grid>

            {/* All communities */}
            {communities.map((c) => (
              <Grid key={c.id} size={{ xs: 12, md: 6 }}>
                <PresenceCard
                  entityId={c.id}
                  name={`${c.emoji} ${c.name}`}
                  logo={c.logo}
                  description={c.description}
                  profiles={profilesFor(c.id)}
                  location={c.location}
                  tags={c.tags}
                  primaryLink={c.links[0] ? { label: c.links[0].label, url: c.links[0].url } : undefined}
                />
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ── Linha do Tempo ── */}
      <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 } }}>
        <Typography variant="h5" fontWeight={800} gutterBottom>
          🕐 Linha do Tempo
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 5 }}>
          De uma conversa em 2020 a centenas de participantes impactados.
        </Typography>

        <Box>
          {timelineEvents.map((event: TimelineEvent, index: number) => (
            <TimelineChapter
              key={event.year}
              event={event}
              index={index}
              isMobile={isMobile}
              isLast={index === timelineEvents.length - 1}
            />
          ))}
        </Box>
      </Container>
    </Layout>
  );
}
