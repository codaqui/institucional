import React from "react";
import Link from "@docusaurus/Link";
import { Box, Button, Chip, Container, Stack, Typography } from "@mui/material";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { CommunitySiteConfig } from "../types";

interface CommunityTextHeroProps {
  community: CommunitySiteConfig;
  chipLabel?: string;
}

export default function CommunityTextHero({
  community,
  chipLabel = "Comunidade parceira da Codaqui",
}: CommunityTextHeroProps): React.JSX.Element {
  const accent = community.theme.primary;
  const accentDark = community.theme.primaryDark;
  const accentLight = community.theme.primaryLight;

  return (
    <Box
      sx={{
        bgcolor: (t) => (t.palette.mode === "dark" ? accentDark : accent),
        color: "#fff",
        py: { xs: 6, md: 10 },
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={3} maxWidth={760}>
          <Chip
            label={chipLabel}
            sx={{
              bgcolor: "rgba(255,255,255,0.15)",
              color: "#fff",
              width: "fit-content",
              fontWeight: 600,
            }}
          />
          <Typography variant="h2" component="h1" fontWeight={800}>
            {community.hero.title}
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400 }}>
            {community.hero.subtitle}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button
              component={Link}
              to={community.hero.ctaPrimary.to}
              variant="contained"
              size="large"
              sx={{
                bgcolor: (t) => (t.palette.mode === "dark" ? accent : "#fff"),
                color: (t) => (t.palette.mode === "dark" ? "#fff" : accentDark),
                "&:hover": {
                  bgcolor: (t) =>
                    t.palette.mode === "dark" ? accentLight : "#f1f5f9",
                },
              }}
              startIcon={<VolunteerActivismIcon />}
            >
              {community.hero.ctaPrimary.label}
            </Button>
            {community.hero.ctaSecondary && (
              <Button
                component="a"
                href={community.hero.ctaSecondary.href}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                size="large"
                sx={{
                  color: "#fff",
                  borderColor: "rgba(255,255,255,0.6)",
                  "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
                }}
                endIcon={<OpenInNewIcon />}
              >
                {community.hero.ctaSecondary.label}
              </Button>
            )}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
