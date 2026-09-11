import React from "react";
import Layout from "@theme/Layout";
import {
  Avatar,
  Box,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import InstagramIcon from "@mui/icons-material/Instagram";
import CommunityHead from "@site/comunidades/shared/components/CommunityHead";
import community from "../../community.config";
import { mentores, type Mentor } from "../data/team";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;

function MentorCard({ name, role, specialty, avatar, linkedin, instagram }: Readonly<Mentor>) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.2s",
        "&:hover": { transform: "translateY(-2px)", boxShadow: 3, borderColor: accent },
      }}
    >
      <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 1 }}>
        <Avatar
          src={avatar}
          alt={`Foto de ${name}`}
          sx={{ width: 80, height: 80, border: "3px solid", borderColor: "divider" }}
        />
        <Typography variant="h6" fontWeight={700}>{name}</Typography>
        <Chip variant="outlined" size="small" label={role} sx={{ mt: 0.5 }} />
        {specialty && (
          <Chip
            variant="filled"
            size="small"
            label={specialty}
            sx={{ bgcolor: accent, color: "#fff", fontWeight: 600 }}
          />
        )}
      </CardContent>
      <CardActions sx={{ justifyContent: "center", pt: 0 }}>
        {linkedin && (
          <IconButton
            size="small"
            component="a"
            href={linkedin}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`LinkedIn de ${name}`}
          >
            <LinkedInIcon sx={{ color: accent }} />
          </IconButton>
        )}
        {instagram && (
          <IconButton
            size="small"
            component="a"
            href={instagram}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Instagram de ${name}`}
          >
            <InstagramIcon />
          </IconButton>
        )}
      </CardActions>
    </Card>
  );
}

export default function MentoresCamposTechPage(): React.JSX.Element {
  return (
    <Layout
      title={`Mentores — ${community.shortName}`}
      description={`Conheça os mentores voluntários da ${community.name}`}
    >
      <CommunityHead
        community={community}
        title={`Mentores — ${community.shortName}`}
        description={`Conheça os mentores voluntários da ${community.name}`}
      />
      <main>
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
                Nossos mentores
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400 }}>
                Contamos com um espaço para que mentores voluntários ofereçam algumas horas de
                seu mês para compartilhar conhecimento com a comunidade. Quem tiver interesse em
                ser mentorado basta entrar em contato com os mentores.
              </Typography>
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
          <Box component="section" sx={{ mb: 8 }}>
            <Typography variant="h4" component="h2" sx={{ mb: 1, fontWeight: 700 }}>
              Mentores voluntários
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 700 }}>
              Profissionais de diversas áreas que dedicam tempo para mentorar a comunidade.
            </Typography>
            <Divider sx={{ mb: 4 }} />
            <Grid container spacing={3}>
              {mentores.map((m) => (
                <Grid key={m.name} size={{ xs: 12, sm: 6, md: 4 }}>
                  <MentorCard {...m} />
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>
      </main>
    </Layout>
  );
}
