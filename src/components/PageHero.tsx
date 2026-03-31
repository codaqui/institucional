import React from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

interface PageHeroProps {
  tag?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function PageHero({ tag, title, subtitle, children }: PageHeroProps): React.JSX.Element {
  return (
    <Box
      sx={{
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
        color: "common.white",
        py: { xs: 6, md: 10 },
        textAlign: "center",
      }}
    >
      <Container maxWidth="md">
        {tag && (
          <Chip
            label={tag}
            sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "common.white", mb: 2, fontWeight: 700 }}
          />
        )}
        <Typography variant="h2" fontWeight={800} gutterBottom color="common.white">
          {title}
        </Typography>
        {subtitle && (
          <Typography
            variant="h6"
            sx={{ opacity: 0.9, maxWidth: 560, mx: "auto", mb: children ? 4 : 0 }}
            color="common.white"
          >
            {subtitle}
          </Typography>
        )}
        {children}
      </Container>
    </Box>
  );
}
