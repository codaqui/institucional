import React, { useEffect, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

/** Entrada do histórico de edições de um override (GET /events/override/:sk/:id/history). */
export interface OverrideHistoryEntry {
  sha: string;
  message: string;
  authorHandle: string;
  authorAvatarUrl: string;
  date: string;
  url: string;
}

interface EventOverrideHistoryProps {
  apiUrl: string;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
  sourceKey: string;
  eventId: string;
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Painel "Histórico de edições" do editor de override — lista os commits do
 * arquivo `<eventId>.override.json` (autor, mensagem, data e link do commit).
 */
export default function EventOverrideHistory({
  apiUrl,
  authFetch,
  sourceKey,
  eventId,
}: EventOverrideHistoryProps): React.JSX.Element {
  const [items, setItems] = useState<OverrideHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const res = await authFetch(
          `${apiUrl}/events/override/${encodeURIComponent(sourceKey)}/${encodeURIComponent(eventId)}/history`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as OverrideHistoryEntry[];
        if (!cancelled) setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError("Não foi possível carregar o histórico.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, authFetch, sourceKey, eventId]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Histórico de edições
        </Typography>

        {loading ? (
          <Stack spacing={1.5}>
            {[0, 1, 2].map((i) => (
              <Box key={i} sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                <Skeleton variant="circular" width={28} height={28} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="text" width="50%" />
                </Box>
              </Box>
            ))}
          </Stack>
        ) : error ? (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        ) : items.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhuma edição registrada.
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {items.map((item) => (
              <Box key={item.sha} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                <Avatar
                  src={item.authorAvatarUrl}
                  alt={item.authorHandle}
                  sx={{ width: 28, height: 28 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>
                    @{item.authorHandle}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ wordBreak: "break-word" }}
                  >
                    {item.message}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(item.date)}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  aria-label={`Abrir commit ${item.sha.slice(0, 7)}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
