import { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface ProfileBadgesProps {
  name: string;
  githubHandle: string;
}

export default function ProfileBadges({ name, githubHandle }: Readonly<ProfileBadgesProps>) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = `/badges/${encodeURIComponent(githubHandle)}.svg`;
  if (failedSrc === src) return null;

  return (
    <Box component="section" aria-labelledby="public-badge-title" sx={{ mt: 4 }}>
      <Typography id="public-badge-title" variant="h5" component="h2" sx={{ fontWeight: 700, mb: 2 }}>
        Selo público
      </Typography>
      <Box
        component="img"
        src={src}
        alt={`Selo Codaqui de ${name}`}
        width="640"
        height="120"
        loading="lazy"
        onError={() => setFailedSrc(src)}
        sx={{ display: "block", maxWidth: "100%", height: "auto" }}
      />
    </Box>
  );
}
