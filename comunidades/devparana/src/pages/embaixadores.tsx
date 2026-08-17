import React from "react";
import Layout from "@theme/Layout";
import {
  Alert,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import GitHubIcon from "@mui/icons-material/GitHub";
import EmailIcon from "@mui/icons-material/Email";
import community from "../../community.config";
import { regions, type Region, type Ambassador } from "../data/ambassadors";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;

const responsibilities = [
  "Liderar as iniciativas da comunidade na região;",
  "Representar a comunidade e seus interesses;",
  "Zelar pela boa imagem e reputação da comunidade;",
  "Garantir que o código de conduta seja aplicado;",
  "Identificar e formar novas lideranças, apoiando eventos locais;",
  "Ser o representante principal em eventos de entidades parceiras;",
  "Participar das reuniões da associação quando convocado;",
  "Gerenciar e entregar brindes da associação na região.",
];

function AmbassadorCard({ ambassador }: { ambassador: Ambassador }) {
  return (
    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
      <Avatar
        src={ambassador.avatar}
        alt={ambassador.name}
        sx={{ width: 64, height: 64, border: "3px solid", borderColor: "divider" }}
      />
      <Box>
        <Typography fontWeight={700}>{ambassador.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {ambassador.role}
        </Typography>
        <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
          {ambassador.email && (
            <Box component="a" href={`mailto:${ambassador.email}`} aria-label={`E-mail de ${ambassador.name}`}>
              <EmailIcon fontSize="small" sx={{ color: accent }} />
            </Box>
          )}
          {ambassador.linkedin && (
            <Box component="a" href={ambassador.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`LinkedIn de ${ambassador.name}`}>
              <LinkedInIcon fontSize="small" sx={{ color: accent }} />
            </Box>
          )}
          {ambassador.github && (
            <Box component="a" href={ambassador.github} target="_blank" rel="noopener noreferrer" aria-label={`GitHub de ${ambassador.name}`}>
              <GitHubIcon fontSize="small" sx={{ color: accent }} />
            </Box>
          )}
        </Stack>
      </Box>
    </Stack>
  );
}

function RegionCard({ region }: { region: Region }) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        transition: "all 0.2s",
        "&:hover": { transform: "translateY(-2px)", boxShadow: 3, borderColor: accent },
      }}
    >
      <CardContent>
        <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: accent }}>
          {region.name}
        </Typography>

        {region.ambassador ? (
          <AmbassadorCard ambassador={region.ambassador} />
        ) : (
          <Alert severity="info" sx={{ mb: 2 }}>
            Vaga aberta — entre em contato caso queira representar esta região.
          </Alert>
        )}

        <Typography variant="subtitle2" fontWeight={700}>
          Cidades
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
          {region.cities.map((city) => (
            <Chip key={city} label={city} size="small" variant="outlined" />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DevParanaEmbaixadores(): React.JSX.Element {
  return (
    <Layout
      title={`Embaixadores — ${community.shortName}`}
      description="Conheça as regiões do Paraná e os embaixadores do DevParaná."
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
              label={community.name}
              sx={{
                bgcolor: "rgba(255,255,255,0.18)",
                color: "#fff",
                width: "fit-content",
                fontWeight: 600,
              }}
            />
            <Typography variant="h2" component="h1" fontWeight={800}>
              Embaixadores
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400 }}>
              O Projeto Embaixadores organiza o DevParaná em regiões do estado,
              garantindo que cada cidade tenha uma pessoa de referência.
            </Typography>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
          Responsabilidades
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 700 }}>
          Os embaixadores são referências regionais que representam a comunidade,
          fomentam novos grupos e apoiam eventos locais.
        </Typography>
        <Grid container spacing={2} sx={{ mb: { xs: 6, md: 8 } }}>
          {responsibilities.map((text) => (
            <Grid key={text} size={{ xs: 12, md: 6 }}>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <CheckCircleIcon sx={{ color: accent, mt: 0.3, fontSize: 20 }} />
                <Typography variant="body1">{text}</Typography>
              </Stack>
            </Grid>
          ))}
        </Grid>

        <Typography variant="h4" component="h2" fontWeight={700} gutterBottom>
          Regiões do Paraná
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          O estado está dividido em {regions.length} regiões. Em breve todas terão
          embaixadores confirmados.
        </Typography>
        <Grid container spacing={3}>
          {regions.map((region) => (
            <Grid key={region.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <RegionCard region={region} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Layout>
  );
}
