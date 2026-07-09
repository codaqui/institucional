import React from "react";
import Layout from "@theme/Layout";
import {
  Avatar,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Grid,
  Box,
  Typography,
  Divider,
  Container,
  Stack,
} from "@mui/material";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import GitHubIcon from "@mui/icons-material/GitHub";
import community from "../../community.config";
import { equipeImpacto, type Member } from "../data/team";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;

function MemberCard({ name, role, specialty, avatar, linkedin, github }: Readonly<Member>) {
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
        {linkedin && linkedin !== "#" && (
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
        {github && github !== "#" && (
          <IconButton
            size="small"
            component="a"
            href={github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`GitHub de ${name}`}
          >
            <GitHubIcon />
          </IconButton>
        )}
      </CardActions>
    </Card>
  );
}

export default function EquipeTiSocialPage(): React.JSX.Element {
  return (
    <Layout 
      title={`Equipe — ${community.shortName}`} 
      description={`Conheça as pessoas por trás da ${community.name}`}
    >
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
                Equipe de Impacto
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400 }}>
                A T.I. Social Maringá é movida por pessoas apaixonadas por tecnologia e
                causas sociais. Conheça quem faz as campanhas acontecerem.
              </Typography>
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
          <Box component="section" sx={{ mb: 8 }}>
            <Typography variant="h4" component="h2" sx={{ mb: 1, fontWeight: 700 }}>
              Voluntários e Liderança
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 700 }}>
              Nossa equipe é composta por colaboradores voluntários das empresas parceiras.
            </Typography>
            <Divider sx={{ mb: 4 }} />
            <Grid container spacing={3}>
              {equipeImpacto.map((m) => (
                <Grid key={m.name + m.role} size={{ xs: 12, sm: 6, md: 4 }}>
                  <MemberCard {...m} />
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>
      </main>
    </Layout>
  );
}
