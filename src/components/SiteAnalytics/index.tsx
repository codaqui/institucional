import React, { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import {
  ANALYTICS_URL,
  type AnalyticsSnapshot,
  type MonthlyMetric,
} from "../../data/analytics";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".0", "")}K`;
  return String(n);
}

function periodLabel(period: string): string {
  const [y, m] = period.split("-");
  const month = new Date(Number(y), Number(m) - 1).toLocaleString("pt-BR", {
    month: "short",
  });
  return `${month}/${y.slice(2)}`;
}

function periodLong(period: string): string {
  const [y, m] = period.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function pageLabel(path: string): string {
  return path
    .replace(/^\//, "")
    .replace(/\/$/, "")
    .replaceAll("/", " › ") || "Página inicial";
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

const BAR_GAP = 2;
const BAR_MIN_H = 2;
const CHART_H = 80;
const YEAR_H = 18;

function MonthlyChart({
  monthly,
  peakMonth,
}: Readonly<{
  monthly: MonthlyMetric[];
  peakMonth: string;
}>) {
  const theme = useTheme();
  const [hovered, setHovered] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<SVGSVGElement>(null);

  if (monthly.length === 0) return null;

  const maxViews = Math.max(...monthly.map((m) => m.screenPageViews));
  const primary = theme.palette.primary.main;
  const primaryDark = theme.palette.primary.dark;
  const dimColor =
    theme.palette.mode === "dark"
      ? "rgba(255,255,255,0.12)"
      : "rgba(0,0,0,0.1)";

  // Compute bar widths — they're equal, so just use fractional width
  const n = monthly.length;
  const svgW = 560;
  const barW = (svgW - BAR_GAP * (n - 1)) / n;

  const yearBoundaries: { x: number; year: string }[] = [];
  let lastYear = "";
  monthly.forEach((m, i) => {
    const yr = m.period.slice(0, 4);
    if (yr !== lastYear) {
      yearBoundaries.push({ x: i * (barW + BAR_GAP), year: yr });
      lastYear = yr;
    }
  });

  const hoveredMonth = hovered === null ? null : monthly[hovered];

  return (
    <Box sx={{ position: "relative", width: "100%" }}>
      {/* Tooltip */}
      {hoveredMonth && (
        <Box
          sx={{
            position: "absolute",
            top: tooltipPos.y - 72,
            left: Math.min(tooltipPos.x, 220),
            transform: "translateX(-50%)",
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
            px: 1.5,
            py: 0.75,
            pointerEvents: "none",
            zIndex: 10,
            boxShadow: 4,
            minWidth: 140,
          }}
        >
          <Typography variant="caption" fontWeight={700} display="block">
            {periodLong(hoveredMonth.period)}
          </Typography>
          <Typography variant="caption" color="primary.main" display="block" fontWeight={600}>
            {hoveredMonth.screenPageViews.toLocaleString("pt-BR")} visualizações
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            {hoveredMonth.activeUsers.toLocaleString("pt-BR")} usuários
          </Typography>
        </Box>
      )}

      <Box
        component="svg"
        ref={containerRef}
        viewBox={`0 0 ${svgW} ${CHART_H + YEAR_H}`}
        sx={{ width: "100%", height: "auto", display: "block" }}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Horizontal grid lines */}
        {[0.25, 0.5, 0.75, 1].map((frac) => {
          const y = CHART_H - frac * (CHART_H - BAR_MIN_H);
          return (
            <line
              key={frac}
              x1={0}
              y1={y}
              x2={svgW}
              y2={y}
              stroke={dimColor}
              strokeWidth={1}
              strokeDasharray={frac === 1 ? "0" : "3 3"}
            />
          );
        })}

        {/* Bars */}
        {monthly.map((m, i) => {
          const isPeak = m.period === peakMonth;
          const isHovered = hovered === i;
          const h = Math.max(
            BAR_MIN_H,
            (m.screenPageViews / maxViews) * (CHART_H - BAR_MIN_H)
          );
          const x = i * (barW + BAR_GAP);
          const y = CHART_H - h;
          let fill = dimColor;
          if (isPeak) {
            fill = primaryDark;
          } else if (isHovered) {
            fill = primary;
          }

          return (
            <rect
              key={m.period}
              x={x}
              y={y}
              width={barW}
              height={h}
              fill={fill}
              rx={1}
              style={{ cursor: "pointer", transition: "fill 0.15s" }}
              onMouseEnter={(e) => {
                setHovered(i);
                const svg = containerRef.current;
                if (svg) {
                  const rect = svg.getBoundingClientRect();
                  setTooltipPos({
                    x: (x + barW / 2) * (rect.width / svgW),
                    y: y * (rect.height / (CHART_H + YEAR_H)),
                  });
                }
              }}
            />
          );
        })}

        {/* Year labels */}
        {yearBoundaries.map(({ x, year }) => (
          <text
            key={year}
            x={x}
            y={CHART_H + YEAR_H - 2}
            fontSize={10}
            fill={
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.4)"
                : "rgba(0,0,0,0.4)"
            }
            fontWeight={600}
            fontFamily="inherit"
          >
            {year}
          </text>
        ))}

        {/* Peak label */}
        {(() => {
          const pi = monthly.findIndex((m) => m.period === peakMonth);
          if (pi === -1) return null;
          const h = Math.max(
            BAR_MIN_H,
            (monthly[pi].screenPageViews / maxViews) * (CHART_H - BAR_MIN_H)
          );
          const bx = pi * (barW + BAR_GAP) + barW / 2;
          const by = CHART_H - h - 4;
          return (
            <text
              x={Math.min(bx, svgW - 18)}
              y={by}
              fontSize={9}
              fill={primaryDark}
              fontWeight={800}
              textAnchor="middle"
              fontFamily="inherit"
            >
              ★
            </text>
          );
        })()}
      </Box>
    </Box>
  );
}

// ─── Traffic sources bar ───────────────────────────────────────────────────────

function TrafficBar({ sources }: Readonly<{ sources: Record<string, number> }>) {
  const LABELS: Record<string, { label: string; emoji: string; show: boolean }> = {
    google: { label: "Google", emoji: "🔍", show: true },
    new: { label: "Novos visitantes", emoji: "🆕", show: true },
    returning: { label: "Retorno", emoji: "↩️", show: true },
    "(direct)": { label: "Direto", emoji: "🔗", show: true },
    "(not set)": { label: "Outros", emoji: "❓", show: true },
    "github.com": { label: "GitHub", emoji: "🐙", show: true },
  };

  const total = Object.values(sources).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  const known = Object.entries(sources)
    .filter(([k]) => LABELS[k]?.show)
    .map(([k, v]) => ({ key: k, ...LABELS[k], value: v, pct: (v / total) * 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <Stack spacing={1}>
      {known.map((s) => (
        <Tooltip key={s.key} title={`${s.value.toLocaleString("pt-BR")} acessos`}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.3 }}>
              <Typography variant="caption" sx={{ minWidth: 120 }}>
                {s.emoji} {s.label}
              </Typography>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ ml: "auto !important", minWidth: 32, textAlign: "right" }}
              >
                {Math.round(s.pct)}%
              </Typography>
            </Stack>
            <Box
              sx={{
                height: 4,
                borderRadius: 2,
                bgcolor: "action.hover",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  height: "100%",
                  width: `${s.pct}%`,
                  bgcolor: "primary.main",
                  borderRadius: 2,
                }}
              />
            </Box>
          </Box>
        </Tooltip>
      ))}
    </Stack>
  );
}

// ─── Top pages ────────────────────────────────────────────────────────────────

function TopPages({
  pages,
  latestPeriod,
}: Readonly<{
  pages: AnalyticsSnapshot["topPages"];
  latestPeriod: string;
}>) {
  if (pages.length === 0) return null;
  const max = pages[0].screenPageViews;

  return (
    <Stack spacing={1.25}>
      {pages.slice(0, 5).map((p) => (
        <Box key={p.pagePath}>
          <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mb: 0.3 }}>
            <Typography
              variant="caption"
              sx={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {pageLabel(p.pagePath)}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
              {p.screenPageViews.toLocaleString("pt-BR")}
            </Typography>
          </Stack>
          <Box
            sx={{
              height: 4,
              borderRadius: 2,
              bgcolor: "action.hover",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                height: "100%",
                width: `${(p.screenPageViews / max) * 100}%`,
                bgcolor: "secondary.main",
                borderRadius: 2,
              }}
            />
          </Box>
        </Box>
      ))}
      <Typography variant="caption" color="text.disabled" sx={{ pt: 0.5 }}>
        Top páginas em {periodLong(latestPeriod)}
      </Typography>
    </Stack>
  );
}

// ─── Hero metric ──────────────────────────────────────────────────────────────

function HeroMetric({
  icon,
  value,
  sub,
  label,
}: Readonly<{
  icon: React.ReactNode;
  value: string;
  sub?: string;
  label: string;
}>) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
      <Box
        sx={{
          mt: 0.25,
          width: 36,
          height: 36,
          borderRadius: 1.5,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.5 }}>
          <Typography variant="h5" fontWeight={800} lineHeight={1}>
            {value}
          </Typography>
          {sub && (
            <Typography variant="caption" color="text.disabled" fontWeight={600}>
              {sub}
            </Typography>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SiteAnalytics() {
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);

  useEffect(() => {
    fetch(ANALYTICS_URL)
      .then((r) => r.json())
      .then((d: AnalyticsSnapshot) => setData(d))
      .catch(() => {
        // Silently skip — analytics are non-critical
      });
  }, []);

  if (!data) return null;

  const { totals, monthly, topPages, trafficSources, latestPeriod } = data;

  return (
    <Box sx={{ bgcolor: "background.paper", borderTop: 1, borderColor: "divider", py: { xs: 5, md: 7 } }}>
      <Box sx={{ maxWidth: "lg", mx: "auto", px: { xs: 2, sm: 3, lg: 4 } }}>
        {/* Header */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "baseline" }}
          spacing={1}
          sx={{ mb: 4 }}
        >
          <Typography variant="h5" fontWeight={800}>
            📊 Alcance do Site
          </Typography>
          <Typography variant="caption" color="text.disabled" sx={{ ml: { sm: 1 } }}>
            Google Analytics · dados via{" "}
            <Box
              component="a"
              href="https://github.com/codaqui/dados"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: "inherit", textDecoration: "underline" }}
            >
              codaqui/dados
            </Box>
            {" "}· desde jan/2024
          </Typography>
        </Stack>

        {/* Hero metrics row */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 2.5, sm: 4 }}
          sx={{ mb: 4, flexWrap: "wrap" }}
        >
          <HeroMetric
            icon={<TrendingUpIcon fontSize="small" />}
            value={fmtViews(totals.screenPageViews)}
            label="visualizações totais (26 meses)"
          />
          <HeroMetric
            icon={<PeopleAltIcon fontSize="small" />}
            value={fmtViews(totals.activeUsers)}
            label="usuários únicos"
          />
          <HeroMetric
            icon={<EmojiEventsIcon fontSize="small" />}
            value={fmtViews(totals.peakViews)}
            sub={periodLabel(totals.peakMonth)}
            label="recorde mensal"
          />
        </Stack>

        {/* Chart */}
        <Paper
          elevation={0}
          sx={{ p: { xs: 2, sm: 3 }, mb: 3, bgcolor: "action.hover", borderRadius: 2 }}
        >
          <Typography
            variant="caption"
            color="text.disabled"
            display="block"
            fontWeight={600}
            sx={{ mb: 1.5, textTransform: "uppercase", letterSpacing: "0.08em" }}
          >
            Visualizações por mês ★ = pico
          </Typography>
          <MonthlyChart monthly={monthly} peakMonth={totals.peakMonth} />
        </Paper>

        {/* Sources + Top pages */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography
              variant="caption"
              fontWeight={700}
              color="text.secondary"
              display="block"
              sx={{ mb: 1.5, textTransform: "uppercase", letterSpacing: "0.08em" }}
            >
              Origem do tráfego
            </Typography>
            <TrafficBar sources={trafficSources} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography
              variant="caption"
              fontWeight={700}
              color="text.secondary"
              display="block"
              sx={{ mb: 1.5, textTransform: "uppercase", letterSpacing: "0.08em" }}
            >
              Conteúdos mais acessados
            </Typography>
            <TopPages pages={topPages} latestPeriod={latestPeriod} />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
