import React from "react";
import { useLocation } from "@docusaurus/router";
import OriginalBlogLayout from "@theme-original/BlogLayout";
import Link from "@docusaurus/Link";
import { Box, Typography, Stack, Chip } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { resolveCommunityFromPath } from "@site/src/lib/community-context";

type BlogLayoutProps = React.ComponentProps<typeof OriginalBlogLayout>;

export default function BlogLayoutWrapper(props: BlogLayoutProps): React.JSX.Element {
  const { pathname } = useLocation();
  const community = resolveCommunityFromPath(pathname);

  if (!community) {
    return <OriginalBlogLayout {...props} />;
  }

  return (
    <OriginalBlogLayout {...props}>
      <Box
        sx={{
          background: `linear-gradient(135deg, ${community.theme.primary} 0%, ${community.theme.primaryDark} 100%)`,
          color: "#fff",
          borderRadius: 2,
          p: { xs: 3, md: 4 },
          mb: 4,
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              component="img"
              src={community.logoUrl}
              alt={community.name}
              sx={{
                height: 56,
                width: 56,
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.95)",
                p: 0.5,
              }}
            />
            <Box>
              <Typography variant="h5" fontWeight={800} component="div">
                Blog da {community.shortName}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.92 }}>
                Histórias, ações e prestações de contas da comunidade.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <Chip
              component={Link}
              to={community.basePath}
              label="← Voltar à home"
              clickable
              icon={<ArrowBackIcon sx={{ color: "#fff !important" }} />}
              sx={{
                bgcolor: "rgba(255,255,255,0.18)",
                color: "#fff",
                fontWeight: 600,
                "&:hover": { bgcolor: "rgba(255,255,255,0.28)" },
              }}
            />
          </Stack>
        </Stack>
      </Box>
      {props.children}
    </OriginalBlogLayout>
  );
}
