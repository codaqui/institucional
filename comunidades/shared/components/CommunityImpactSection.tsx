import React from "react";
import { Card, CardContent, Container, Grid, Typography } from "@mui/material";
import type { CommunitySiteConfig } from "../types";

interface CommunityImpactSectionProps {
  community: CommunitySiteConfig;
}

export default function CommunityImpactSection({
  community,
}: CommunityImpactSectionProps): React.JSX.Element {
  const accent = community.theme.primary;
  const stats = community.impact?.stats ?? [];

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
      <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
        {community.impact?.title ?? "Impacto recente"}
      </Typography>
      {community.impact?.subtitle && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          {community.impact.subtitle}
        </Typography>
      )}
      <Grid container spacing={3}>
        {stats.map((stat) => (
          <Grid key={stat.label} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ height: "100%", textAlign: "center", py: 3 }}>
              <CardContent>
                <Typography
                  variant="h3"
                  fontWeight={800}
                  sx={{ color: accent, mb: 1 }}
                >
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stat.label}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
