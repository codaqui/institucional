import React, { useState } from "react";
import Layout from "@theme/Layout";
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineDot,
  TimelineContent,
  TimelineOppositeContent,
} from "@mui/lab";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Collapse from "@mui/material/Collapse";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import GroupsIcon from "@mui/icons-material/Groups";
import SchoolIcon from "@mui/icons-material/School";
import EventIcon from "@mui/icons-material/Event";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import {
  timelineEvents,
  type TimelineEvent,
  type TimelineStats,
} from "../../data/timeline";

/* ------------------------------------------------------------------ */
/*  Overall stats — aggregated across all years                       */
/* ------------------------------------------------------------------ */
const overallStats = [
  { icon: <EventIcon />, value: "115+", label: "Encontros realizados" },
  { icon: <SchoolIcon />, value: "126+", label: "Mentorias" },
  { icon: <AccessTimeIcon />, value: "89h+", label: "Horas de mentoria" },
  { icon: <GroupsIcon />, value: "692", label: "Membros na comunidade" },
];

const COLLAPSE_THRESHOLD = 5;

/* ------------------------------------------------------------------ */
/*  Stats chips row                                                    */
/* ------------------------------------------------------------------ */
function StatsRow({ stats }: { stats: TimelineStats[] }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ flexWrap: "wrap", gap: 1, mb: 1.5 }}
    >
      {stats.map((s) => (
        <Chip
          key={s.label}
          size="small"
          label={`${s.value} ${s.label}`}
          avatar={
            <Box
              component="span"
              sx={{ fontSize: "0.85rem", display: "flex", alignItems: "center" }}
            >
              {s.icon}
            </Box>
          }
          sx={{
            fontWeight: 600,
            bgcolor: "action.selected",
            "& .MuiChip-avatar": { bgcolor: "transparent" },
          }}
        />
      ))}
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/*  Highlights list                                                    */
/* ------------------------------------------------------------------ */
function Highlights({ items }: { items: string[] }) {
  return (
    <Stack spacing={0.5} sx={{ mb: 1.5 }}>
      {items.map((h) => (
        <Stack key={h} direction="row" spacing={1} alignItems="flex-start">
          <CheckCircleIcon
            sx={{ fontSize: 18, mt: "2px", color: "primary.main" }}
          />
          <Typography variant="body2" fontWeight={600}>
            {h}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/*  Collapsible bullet list                                            */
/* ------------------------------------------------------------------ */
function ItemList({ items }: { items: string[] }) {
  const [open, setOpen] = useState(false);
  const needsCollapse = items.length > COLLAPSE_THRESHOLD;
  const visible = needsCollapse && !open ? items.slice(0, COLLAPSE_THRESHOLD) : items;

  return (
    <>
      <Box component="ul" sx={{ pl: 2, m: 0, mb: needsCollapse ? 0.5 : 0 }}>
        {visible.map((item, i) => (
          <Box component="li" key={i} sx={{ mb: 0.25 }}>
            <Typography variant="body2" color="text.secondary">
              {item}
            </Typography>
          </Box>
        ))}
      </Box>
      {needsCollapse && (
        <>
          <Collapse in={open}>
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              {items.slice(COLLAPSE_THRESHOLD).map((item, i) => (
                <Box component="li" key={i} sx={{ mb: 0.25 }}>
                  <Typography variant="body2" color="text.secondary">
                    {item}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Collapse>
          <Button
            size="small"
            onClick={() => setOpen((v) => !v)}
            endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            sx={{ textTransform: "none", mt: 0.5 }}
          >
            {open ? "Ver menos" : `Ver mais (${items.length - COLLAPSE_THRESHOLD})`}
          </Button>
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Single timeline card                                               */
/* ------------------------------------------------------------------ */
function TimelineCard({
  event,
  isMobile,
}: {
  event: TimelineEvent;
  isMobile: boolean;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        borderLeft: 4,
        borderLeftColor: `${event.color === "grey" ? "grey.500" : `${event.color}.main`}`,
        transition: "box-shadow 0.2s",
        "&:hover": { boxShadow: 4 },
      }}
    >
      <CardContent sx={{ "&:last-child": { pb: 2 } }}>
        {/* Year + tag on mobile */}
        {isMobile && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={800} color="text.secondary">
              {event.year}
            </Typography>
            {event.tag && (
              <Chip
                label={event.tag}
                size="small"
                color={event.color === "grey" ? "default" : event.color}
                variant="outlined"
              />
            )}
          </Stack>
        )}

        {/* Title */}
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.5 }}>
          {event.icon} {event.label}
        </Typography>

        {/* Description */}
        {event.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {event.description}
          </Typography>
        )}

        {/* Stats chips */}
        {event.stats && event.stats.length > 0 && (
          <StatsRow stats={event.stats} />
        )}

        {/* Highlights */}
        {event.highlights && event.highlights.length > 0 && (
          <Highlights items={event.highlights} />
        )}

        {/* Divider before bullet list */}
        {(event.stats?.length || event.highlights?.length) && (
          <Divider sx={{ my: 1 }} />
        )}

        {/* Items */}
        <ItemList items={event.items} />
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function TimelinePage(): React.JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Layout
      title="Linha do Tempo"
      description="Acompanhe os principais marcos da história da Codaqui desde 2020"
    >
      {/* ---- Hero ---- */}
      <Box
        sx={{
          background: (t) =>
            `linear-gradient(135deg, ${t.palette.primary.dark}, ${t.palette.primary.main})`,
          py: { xs: 6, md: 8 },
          textAlign: "center",
        }}
      >
        <Container maxWidth="md">
          <Typography
            variant="h3"
            component="h1"
            fontWeight={800}
            color="white"
          >
            🕐 Linha do Tempo
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: "rgba(255,255,255,0.85)",
              maxWidth: 600,
              mx: "auto",
              mt: 2,
            }}
          >
            De uma conversa em 2020 a centenas de alunos impactados — acompanhe
            a trajetória da Codaqui
          </Typography>
        </Container>
      </Box>

      {/* ---- Overall stats bar ---- */}
      <Box sx={{ bgcolor: "background.paper", borderBottom: 1, borderColor: "divider" }}>
        <Container maxWidth="md" sx={{ py: 3 }}>
          <Grid container spacing={2}>
            {overallStats.map((s) => (
              <Grid key={s.label} size={{ xs: 6, sm: 3 }}>
                <Paper
                  elevation={0}
                  sx={{
                    textAlign: "center",
                    py: 2,
                    px: 1,
                    bgcolor: "action.hover",
                    borderRadius: 2,
                  }}
                >
                  <Box sx={{ color: "primary.main", mb: 0.5 }}>{s.icon}</Box>
                  <Typography variant="h5" fontWeight={800} color="primary.main">
                    {s.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {s.label}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ---- Timeline ---- */}
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        <Timeline position={isMobile ? "right" : "alternate-reverse"}>
          {timelineEvents.map((event: TimelineEvent, index: number) => (
            <TimelineItem key={event.year}>
              {/* Opposite content — year + tag (desktop only) */}
              <TimelineOppositeContent
                sx={{
                  display: { xs: "none", sm: "flex" },
                  flexDirection: "column",
                  alignItems: index % 2 === 0 ? "flex-end" : "flex-start",
                  justifyContent: "center",
                  pr: index % 2 === 0 ? 3 : 0,
                  pl: index % 2 === 0 ? 0 : 3,
                }}
              >
                <Typography variant="h4" fontWeight={800} color="text.secondary">
                  {event.year}
                </Typography>
                {event.tag && (
                  <Chip
                    label={event.tag}
                    size="small"
                    color={event.color === "grey" ? "default" : event.color}
                    variant="outlined"
                    sx={{ mt: 0.5 }}
                  />
                )}
              </TimelineOppositeContent>

              {/* Separator */}
              <TimelineSeparator>
                <TimelineDot
                  color={event.color === "grey" ? "grey" : event.color}
                  sx={{ fontSize: "1.4rem", p: 1.5 }}
                >
                  {event.icon}
                </TimelineDot>
                {index < timelineEvents.length - 1 && (
                  <TimelineConnector sx={{ bgcolor: "divider" }} />
                )}
              </TimelineSeparator>

              {/* Content card */}
              <TimelineContent sx={{ pb: 4 }}>
                <TimelineCard event={event} isMobile={isMobile} />
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      </Container>
    </Layout>
  );
}
