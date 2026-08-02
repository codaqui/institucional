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
import CommunityLoginCTA from "@site/src/components/CommunityLoginCTA";
import community from "../../community.config";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;

export default function ElasNoCodigoApoiar(): React.JSX.Element {
  return (
    <Layout
      title={`Apoiar — ${community.shortName}`}
      description={`Faça uma doação para a comunidade ${community.name}.`}
    >
      <Box
        sx={{
          bgcolor: (t) => (t.palette.mode === "dark" ? accentDark : accent),
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
              💜 Apoie a {community.shortName}
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400 }}>
              Sua contribuição fortalece encontros, lives e iniciativas que promovem a inclusão de mulheres na tecnologia.
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
        <CommunityLoginCTA
          accentColor={accent}
          accentColorDark={accentDark}
          message={`Entre com GitHub para apoiar a ${community.shortName} com recibo e histórico. Você volta automaticamente para esta página.`}
        />
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
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Para que será usado?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manutenção de encontros, lives, cursos e criação de novas iniciativas para mulheres na tecnologia.
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Transparência
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Todo valor entra no ledger da Codaqui vinculado à comunidade e pode ser consultado a qualquer momento.
              </Typography>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Layout>
  );
}
