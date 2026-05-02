import React from "react";
import Layout from "@theme/Layout";
import {
  Box,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  Typography,
  Chip,
} from "@mui/material";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import VerifiedIcon from "@mui/icons-material/Verified";
import DonationFlow from "@site/src/components/DonationFlow";
import community from "@site/comunidades/tisocial/community.config";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;

export default function TiSocialApoiar(): React.JSX.Element {
  return (
    <Layout
      title={`Apoiar — ${community.shortName}`}
      description={`Faça uma doação para a comunidade ${community.name}.`}
    >
      <Box
        sx={{
          background: `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)`,
          color: "#fff",
          py: { xs: 6, md: 8 },
        }}
      >
        <Container maxWidth="lg">
          <Stack spacing={2} maxWidth={760}>
            <Chip
              label="Apoie esta comunidade"
              sx={{
                bgcolor: "rgba(255,255,255,0.18)",
                color: "#fff",
                width: "fit-content",
                fontWeight: 600,
              }}
            />
            <Typography variant="h2" component="h1" fontWeight={800}>
              💚 Apoie a {community.shortName}
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400 }}>
              Sua contribuição mantém vivas campanhas como AUMIGO e Páscoa Solidária,
              além dos programas de educação digital em Maringá.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
              <VerifiedIcon sx={{ fontSize: 18 }} />
              <Typography variant="body2" sx={{ opacity: 0.95 }}>
                100% rastreado no Portal de Transparência da Associação Codaqui.
              </Typography>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        <Card variant="outlined" sx={{ borderColor: accent }}>
          <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
            <DonationFlow
              lockedTargetId={community.slug}
              hideWallets
              authCommunitySlug={community.slug}
              accentColor={accent}
              accentColorDark={accentDark}
              title={`Apoiar a ${community.shortName}`}
              subtitle={`Mensal, anual ou doação única. 100% direcionado para a ${community.shortName}.`}
            />
          </CardContent>
        </Card>
      </Container>

      <Box sx={{ bgcolor: "action.hover", py: { xs: 5, md: 7 } }}>
        <Container maxWidth="md">
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: "100%" }}>
                <CardContent>
                  <VolunteerActivismIcon sx={{ color: accent, fontSize: 36, mb: 1 }} />
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Como sua doação é usada
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    100% direcionada para campanhas e ações da {community.shortName}.
                    Movimentações contabilizadas no ledger da Associação Codaqui e
                    auditáveis na página de transparência.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: "100%" }}>
                <CardContent>
                  <VerifiedIcon sx={{ color: accent, fontSize: 36, mb: 1 }} />
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Cobertura jurídica
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pagamentos processados pela Stripe; recibo emitido pela Associação
                    Codaqui (CNPJ 44.593.429/0001-05). Doações acima de R$ 100 exigem
                    login com GitHub para conformidade fiscal.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Layout>
  );
}
