import React from "react";
import { Button, Container, Stack, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { CommunitySiteConfig } from "../types";

interface CommunityChannelsSectionProps {
  community: CommunitySiteConfig;
}

export default function CommunityChannelsSection({
  community,
}: CommunityChannelsSectionProps): React.JSX.Element {
  return (
    <Container maxWidth="md" sx={{ py: { xs: 5, md: 8 }, textAlign: "center" }}>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        {community.channelsSection?.title ?? "Quer saber mais?"}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {community.channelsSection?.subtitle
          ?? `Acesse os canais oficiais da ${community.name}.`}
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
        {community.externalLinks.map((link) => (
          <Button
            key={link.href}
            component="a"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            variant="outlined"
            endIcon={<OpenInNewIcon />}
          >
            {link.label}
          </Button>
        ))}
      </Stack>
    </Container>
  );
}
