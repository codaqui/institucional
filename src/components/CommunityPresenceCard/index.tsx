import React from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import GroupsIcon from "@mui/icons-material/Groups";
import EventIcon from "@mui/icons-material/Event";
import GitHubIcon from "@mui/icons-material/GitHub";
import InstagramIcon from "@mui/icons-material/Instagram";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import YouTubeIcon from "@mui/icons-material/YouTube";
import { PLATFORM_COLORS } from "../../data/social";
import type { SocialStatEntry } from "../../data/social-stats";

// ─── Platform metadata ────────────────────────────────────────────────────────

export const PLATFORM_META: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  discord: {
    icon: <GroupsIcon fontSize="small" />,
    color: PLATFORM_COLORS.discord,
    label: "Discord",
  },
  meetup: {
    icon: <EventIcon fontSize="small" />,
    color: PLATFORM_COLORS.meetup,
    label: "Meetup",
  },
  youtube: {
    icon: <YouTubeIcon fontSize="small" />,
    color: PLATFORM_COLORS.youtube,
    label: "YouTube",
  },
  instagram: {
    icon: <InstagramIcon fontSize="small" />,
    color: PLATFORM_COLORS.instagram,
    label: "Instagram",
  },
  github: {
    icon: <GitHubIcon fontSize="small" />,
    color: PLATFORM_COLORS.github,
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
    color: PLATFORM_COLORS.cncf,
    label: "CNCF",
  },
  website: {
    icon: (
      <Typography component="span" sx={{ fontSize: 13, fontWeight: 800, lineHeight: 1 }}>
        🌐
      </Typography>
    ),
    color: PLATFORM_COLORS.website,
    label: "Website",
  },
  twitter: {
    icon: (
      <Typography component="span" sx={{ fontSize: 14, fontWeight: 800, lineHeight: 1 }}>
        𝕏
      </Typography>
    ),
    color: PLATFORM_COLORS.twitter,
    label: "Twitter/X",
  },
  whatsapp: {
    icon: (
      <Typography component="span" sx={{ fontSize: 13, lineHeight: 1 }}>
        💬
      </Typography>
    ),
    color: PLATFORM_COLORS.whatsapp,
    label: "WhatsApp",
  },
};

export function platformIcon(platform: string): React.ReactNode {
  return PLATFORM_META[platform]?.icon ?? null;
}

export function platformColor(platform: string): string {
  return PLATFORM_META[platform]?.color ?? "primary.main";
}

export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(".0", "")}K`;
  return n > 0 ? String(n) : "–";
}

// ─── Social stat chip ─────────────────────────────────────────────────────────

interface SocialStatChipProps {
  entry: SocialStatEntry;
}

export function SocialStatChip({ entry }: Readonly<SocialStatChipProps>) {
  const color = platformColor(entry.platform);
  const icon = platformIcon(entry.platform);
  const hasCount = !entry.isFallback || entry.count > 0;

  let tooltipText = "";
  if (hasCount) {
    if (entry.isFallback) {
      tooltipText = "Valor estimado — ainda não sincronizado";
    } else {
      tooltipText = `Atualizado em ${entry.fetchedAt ? new Date(entry.fetchedAt).toLocaleDateString("pt-BR") : "—"}`;
    }
  } else {
    tooltipText = `${entry.handle} — clique para visitar`;
  }

  return (
    <Tooltip title={tooltipText}>
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

// ─── Community Presence Card ──────────────────────────────────────────────────

export interface CommunityPresenceCardProps {
  entityId: string;
  name: string;
  logo: string;
  description: string;
  profiles: SocialStatEntry[];
  location?: string;
  tags?: string[];
  /** Shown as outlined action buttons in card footer (e.g. all community links) */
  links?: { label: string; url: string }[];
  /** Shown as a subtle text link below chips — for cases with a single primary site link */
  primaryLink?: { label: string; url: string };
}

export default function CommunityPresenceCard({
  entityId: _entityId,
  name,
  logo,
  description,
  profiles,
  location,
  tags,
  links,
  primaryLink,
}: Readonly<CommunityPresenceCardProps>) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isLocal = logo.startsWith("/img/");

  // Remove links already covered by a social stat chip (same URL, normalized)
  const normalize = (url: string) => url.replace(/\/$/, "").toLowerCase();
  const chipUrls = new Set(profiles.map((p) => normalize(p.url)));
  const visibleLinks = (links ?? []).filter((l) => !chipUrls.has(normalize(l.url)));

  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.2s",
        "&:hover": { boxShadow: 3 },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 0.5 }}>
          <Avatar
            src={logo}
            alt={name}
            sx={{
              width: 44,
              height: 44,
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              "& img": {
                objectFit: "contain",
                p: 0.5,
                filter: isDark && isLocal ? "invert(1) brightness(2)" : "none",
              },
            }}
          />
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

        {primaryLink && !links?.length && (
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

      {visibleLinks.length > 0 && (
        <CardActions sx={{ gap: 1, flexWrap: "wrap", pt: 0, px: 2, pb: 2 }}>
          {visibleLinks.map((link) => (
            <Button
              key={link.url}
              size="small"
              variant="outlined"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {link.label}
            </Button>
          ))}
        </CardActions>
      )}
    </Card>
  );
}
