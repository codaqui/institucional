import React from "react";
import Link from "@docusaurus/Link";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Grid,
  Typography,
} from "@mui/material";
import type { CommunitySiteConfig } from "../types";

export interface FeatureCard {
  icon: React.ReactElement;
  title: string;
  description: string;
  to: string;
}

interface CommunityExploreSectionProps {
  community: CommunitySiteConfig;
  featureCards: FeatureCard[];
}

export default function CommunityExploreSection({
  community,
  featureCards,
}: CommunityExploreSectionProps): React.JSX.Element {
  const accent = community.theme.primary;

  return (
    <Box sx={{ bgcolor: "action.hover", py: { xs: 5, md: 8 } }}>
      <Container maxWidth="lg">
        <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
          {community.exploreSection?.title ?? "Explore a comunidade"}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          {community.exploreSection?.subtitle
            ?? `Tudo que a ${community.shortName} oferece dentro do portal Codaqui.`}
        </Typography>
        <Grid container spacing={3}>
          {featureCards.map((feature) => (
            <Grid key={feature.title} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                sx={{
                  height: "100%",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  "&:hover": { transform: "translateY(-4px)", boxShadow: 6 },
                }}
              >
                <CardActionArea component={Link} to={feature.to} sx={{ height: "100%" }}>
                  <CardContent>
                    <Box sx={{ color: accent, mb: 2 }}>{feature.icon}</Box>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
