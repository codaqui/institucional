import React, { useEffect, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

interface EventOverrideCurrent {
  ownerHandle: string;
  updatedAt: string;
  reason?: string | null;
}

interface EventOverrideHistoryProps {
  readonly apiUrl: string;
  readonly sourceKey: string;
  readonly eventId: string;
}

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function HistorySkeleton(): React.JSX.Element {
  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
      <Skeleton variant="circular" width={28} height={28} />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="50%" />
      </Box>
    </Box>
  );
}

/**
 * Painel "Override atual" do editor de override.
 *
 * Antigamente listava commits do arquivo .override.json no repositorio.
 * Com a migracao para o banco de dados, exibe o override atual (autor,
 * data e motivo), buscando o endpoint publico /events/overrides/:sk/:id.
 */
export default function EventOverrideHistory({
  apiUrl,
  sourceKey,
  eventId,
}: EventOverrideHistoryProps): React.JSX.Element {
  const [override, setOverride] = useState<EventOverrideCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    (async () => {
      try {
        const res = await fetch(
          `${apiUrl}/events/overrides/${encodeURIComponent(sourceKey)}/${encodeURIComponent(eventId)}`,
        );
        if (!res.ok) {
          if (res.status === 404) {
            if (!cancelled) setOverride(null);
            return;
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as EventOverrideCurrent;
        if (!cancelled) setOverride(data);
      } catch {
        if (!cancelled) setError("Não foi possível carregar o override atual.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, sourceKey, eventId]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Override atual
        </Typography>

        {loading && <HistorySkeleton />}

        {!loading && error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}

        {!loading && !error && !override && (
          <Typography variant="body2" color="text.secondary">
            Nenhum override ativo para este evento.
          </Typography>
        )}

        {!loading && !error && override && (
          <Stack spacing={1.5}>
            <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
              <Avatar
                src={`https://avatars.githubusercontent.com/${override.ownerHandle}?v=4`}
                alt={override.ownerHandle}
                sx={{ width: 28, height: 28 }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600}>
                  @{override.ownerHandle}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Editado em {formatDate(override.updatedAt)}
                </Typography>
                {override.reason && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ wordBreak: "break-word", mt: 0.5 }}
                  >
                    Motivo: {override.reason}
                  </Typography>
                )}
              </Box>
            </Box>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
