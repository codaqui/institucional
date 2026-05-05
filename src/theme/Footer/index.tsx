import React from "react";
import { useLocation } from "@docusaurus/router";
import OriginalFooter from "@theme-original/Footer";
import Link from "@docusaurus/Link";
import { Box, Container, Grid, Typography, Stack, Divider } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import FavoriteIcon from "@mui/icons-material/Favorite";
import { resolveCommunityFromPath } from "@site/src/lib/community-context";

export default function FooterWrapper(): React.JSX.Element | null {
  const { pathname } = useLocation();
  const community = resolveCommunityFromPath(pathname);

  if (!community) {
    return <OriginalFooter />;
  }

  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        bgcolor: community.theme.footerBg,
        color: "#e5e7eb",
        mt: "auto",
        pt: { xs: 5, md: 7 },
        pb: 3,
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Box
                component="img"
                src={community.logoUrl}
                alt={community.name}
                sx={{ height: 48, display: "block" }}
              />
              <Typography variant="h6" fontWeight={700} color="#fff">
                {community.shortName}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ opacity: 0.85, lineHeight: 1.7 }}>
              {community.description}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Typography variant="overline" sx={{ color: "#fff", fontWeight: 700 }}>
              Navegar
            </Typography>
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {community.navMenu.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{ color: "#cbd5e1", textDecoration: "none", fontSize: "0.9rem" }}
                >
                  {item.label}
                </Link>
              ))}
            </Stack>
          </Grid>

          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Typography variant="overline" sx={{ color: "#fff", fontWeight: 700 }}>
              Canais oficiais
            </Typography>
            <Stack spacing={1} sx={{ mt: 1.5 }}>
              {community.externalLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: "#cbd5e1",
                    textDecoration: "none",
                    fontSize: "0.9rem",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {link.label}
                  <OpenInNewIcon sx={{ fontSize: 14 }} />
                </a>
              ))}
              <Box sx={{ pt: 2, mt: 1, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
                <Typography variant="caption" sx={{ display: "block", opacity: 0.6, mb: 0.5 }}>
                  Sobre a associação mantenedora
                </Typography>
                <Link to="/" style={{ color: "#cbd5e1", textDecoration: "none", fontSize: "0.9rem" }}>
                  → Site da Codaqui
                </Link>
                <br />
                <Link to="/sobre/ong" style={{ color: "#cbd5e1", textDecoration: "none", fontSize: "0.9rem" }}>
                  → Sobre a Associação
                </Link>
                <br />
                <Link to="/transparencia" style={{ color: "#cbd5e1", textDecoration: "none", fontSize: "0.9rem" }}>
                  → Transparência geral
                </Link>
              </Box>
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, borderColor: "rgba(255,255,255,0.12)" }} />

        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2}
        >
          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            © {year} {community.name}. Todos os direitos reservados.
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <FavoriteIcon sx={{ fontSize: 16, color: "#ef4444" }} />
            <Typography variant="body2" sx={{ opacity: 0.85 }}>
              Comunidade parceira da{" "}
              <Link
                to="/sobre/ong"
                style={{ color: "#fff", fontWeight: 600, textDecoration: "underline" }}
              >
                Associação Codaqui
              </Link>
              {" "}— CNPJ 44.593.429/0001-05
            </Typography>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
