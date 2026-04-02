import React, { useEffect, useMemo, useState } from "react";
import Link from "@docusaurus/Link";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import ForumIcon from "@mui/icons-material/Forum";
import GroupsIcon from "@mui/icons-material/Groups";
import HeadsetMicIcon from "@mui/icons-material/HeadsetMic";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { DISCORD_URL } from "../../data/social";

interface DiscordWidgetChannel {
  id: string;
  name: string;
  position: number;
}

interface DiscordWidgetMember {
  id: string;
  username: string;
  status: "online" | "idle" | "dnd" | "offline";
  avatar_url: string;
}

interface DiscordWidgetPayload {
  id: string;
  name: string;
  instant_invite: string;
  channels: DiscordWidgetChannel[];
  members: DiscordWidgetMember[];
  presence_count?: number;
}

interface DiscordServerWidgetProps {
  readonly widgetUrl: string;
  readonly compact?: boolean;
  /** Total de canais do servidor (dado estático do sync, complementa o widget da API) */
  readonly channelCount?: number | null;
}

function formatChannelName(name: string): string {
  return name.replaceAll(/\s+/g, " ").trim();
}

function formatMemberName(name: string): string {
  if (name.startsWith("[bot]")) {
    return name;
  }
  if (name.length <= 18) {
    return name;
  }
  return `${name.slice(0, 18)}…`;
}

export default function DiscordServerWidget({
  widgetUrl,
  compact = false,
  channelCount,
}: DiscordServerWidgetProps): React.JSX.Element {
  const [data, setData] = useState<DiscordWidgetPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;

    fetch(widgetUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Discord widget unavailable");
        }
        return response.json();
      })
      .then((payload: DiscordWidgetPayload) => {
        if (active) {
          setData(payload);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
        }
      });

    return () => {
      active = false;
    };
  }, [widgetUrl]);

  const members = useMemo(
    () =>
      (data?.members ?? [])
        .filter((member) => member.id !== "0")
        .slice(0, compact ? 4 : 8),
    [data, compact]
  );

  const channels = useMemo(
    () => [...(data?.channels ?? [])].sort((a, b) => a.position - b.position).slice(0, 4),
    [data]
  );

  if (error) {
    return (
      <Alert severity="info" variant="outlined">
        Não foi possível carregar o resumo do Discord agora. Você ainda pode entrar diretamente
        na comunidade.
      </Alert>
    );
  }

  if (!data) {
    return <Skeleton variant="rounded" height={compact ? 180 : 320} />;
  }

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent sx={{ p: compact ? { xs: 2, md: 3 } : { xs: 3, md: 4 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          sx={{ mb: compact ? 2 : 3 }}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: compact ? 0 : 1 }}>
              <ForumIcon color="primary" />
              <Typography variant={compact ? "h6" : "h5"} fontWeight={700}>
                {data.name} no Discord
              </Typography>
            </Stack>
            {!compact && (
              <Typography variant="body2" color="text.secondary">
                Um resumo em tempo real da comunidade para complementar a agenda publicada no site.
              </Typography>
            )}
          </Box>
          <Button
            component={Link}
            href={data.instant_invite || DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            size={compact ? "small" : "medium"}
            endIcon={<OpenInNewIcon />}
          >
            Entrar no Discord
          </Button>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap sx={{ mb: compact ? 2 : 3 }}>
          <Chip
            icon={<GroupsIcon />}
            label={`${data.presence_count ?? data.members.length} pessoas online`}
            color="primary"
            variant="outlined"
            size={compact ? "small" : "medium"}
          />
          {!compact && (
            <Chip
              icon={<HeadsetMicIcon />}
              label={
                channelCount == null
                  ? `${data.channels.length} salas com membros`
                  : `${channelCount} canais`
              }
              color="info"
              variant="outlined"
            />
          )}
        </Stack>

        {!compact && <Divider sx={{ mb: 3 }} />}

        <Stack spacing={compact ? 2 : 3}>
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
              Pessoas online agora
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
              {members.length > 0 ? (
                members.map((member) => (
                  <Chip
                    key={member.id}
                    avatar={<Avatar alt={member.username} src={member.avatar_url} />}
                    label={formatMemberName(member.username)}
                    variant="outlined"
                    size={compact ? "small" : "medium"}
                    sx={{ bgcolor: "background.default" }}
                  />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma pessoa listada pelo widget neste momento.
                </Typography>
              )}
            </Stack>
          </Box>

          {!compact && (
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
                Salas em destaque
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                {channels.map((channel) => (
                  <Box
                    key={channel.id}
                    sx={{
                      p: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      bgcolor: "background.default",
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {formatChannelName(channel.name)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
