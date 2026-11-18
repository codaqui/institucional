import React, { useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MuiIslandProvider from "./MuiIslandProvider";
import { resolveApiUrl } from "../../lib/api-url";

interface MemberEngagement {
  designations: Array<{ key: string; label: string }>;
  communities: Array<{ slug: string; name: string; href: string }>;
  mentor: { id: string; href: string } | null;
}

function isValidEngagement(value: unknown): value is MemberEngagement {
  if (!value || typeof value !== "object") return false;
  const input = value as Record<string, unknown>;
  const mentor = input.mentor;
  return Array.isArray(input.designations)
    && input.designations.every((item) => item && typeof item.key === "string" && typeof item.label === "string")
    && Array.isArray(input.communities)
    && input.communities.every((item) => item && typeof item.slug === "string"
      && typeof item.name === "string" && typeof item.href === "string")
    && (mentor === null || (typeof mentor === "object" && mentor !== null
      && "id" in mentor && "href" in mentor
      && typeof mentor.id === "string" && typeof mentor.href === "string"));
}

function MemberEngagementContent({ routeHandle }: Readonly<{ routeHandle: string }>) {
  const [data, setData] = useState<MemberEngagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const apiUrl = resolveApiUrl(import.meta.env.SITE);
    fetch(`${apiUrl}/members/by-handle/${encodeURIComponent(routeHandle)}/engagement`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (!isValidEngagement(payload)) throw new Error("Invalid engagement");
        setData(payload);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [routeHandle, attempt]);

  if (loading) {
    return <Box aria-label="Carregando vínculos públicos" sx={{ mt: 4 }}><Skeleton height={120} /></Box>;
  }
  if (error) {
    return (
      <Alert severity="warning" sx={{ mt: 4 }} action={<Button onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</Button>}>
        Não foi possível carregar os vínculos públicos.
      </Alert>
    );
  }
  if (!data || (data.designations.length === 0 && data.communities.length === 0 && !data.mentor)) {
    return null;
  }

  return (
    <Box component="section" aria-labelledby="member-engagement-title" sx={{ mt: 4 }}>
      <Typography id="member-engagement-title" variant="h5" component="h2" sx={{ mb: 2 }}>
        Vínculos na Codaqui
      </Typography>
      {data.designations.length > 0 && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", mb: 2 }} aria-label="Papéis por vínculo institucional">
          {data.designations.map((designation) => <Chip key={designation.key} label={designation.label} variant="outlined" />)}
        </Stack>
      )}
      {data.communities.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          {data.communities.map((community) => (
            <Grid key={community.slug} size={{ xs: 12, sm: 6 }}>
              <Card variant="outlined"><CardContent>
                <Button component="a" href={community.href} variant="text" sx={{ px: 0 }}>{community.name}</Button>
              </CardContent></Card>
            </Grid>
          ))}
        </Grid>
      )}
      {data.mentor && <Button component="a" href={data.mentor.href} variant="contained">Agendar mentoria</Button>}
    </Box>
  );
}

export default function MemberEngagementIsland(props: Readonly<{ routeHandle: string }>) {
  return <MuiIslandProvider><MemberEngagementContent {...props} /></MuiIslandProvider>;
}
