import React from "react";
import Layout from "@theme/Layout";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Grid,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import GitHubIcon from "@mui/icons-material/GitHub";
import EmailIcon from "@mui/icons-material/Email";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import community from "../../community.config";
import { team, type Member } from "../data/team";
import { useCodaquiMembersBatch, type CodaquiMember } from "../hooks/useCodaquiMembers";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;

function findApiMember(member: Member, apiMembers: CodaquiMember[]): CodaquiMember | undefined {
  const handle = member.githubHandle?.trim();
  const normalizedName = member.name.trim().toLowerCase();

  if (handle) {
    const byHandle = apiMembers.find(
      (m) => m.githubHandle.toLowerCase() === handle.toLowerCase()
    );
    if (byHandle) return byHandle;
  }

  const byName = apiMembers.find(
    (m) => m.name.trim().toLowerCase() === normalizedName
  );
  if (byName) return byName;

  return undefined;
}

interface EnrichedMember {
  name: string;
  role: string;
  specialty?: string;
  avatar: string;
  bio?: string | null;
  linkedin?: string;
  github?: string;
  email?: string;
  isVolunteerCTA: boolean;
}

function enrichMember(member: Member, apiMembers: CodaquiMember[]): EnrichedMember {
  const api = findApiMember(member, apiMembers);
  const isVolunteerCTA = member.name === "Você?";

  const githubUrl = api?.githubHandle
    ? `https://github.com/${api.githubHandle}`
    : member.github;
  const linkedinUrl = api?.linkedinUrl ?? member.linkedin;

  return {
    name: api?.name ?? member.name,
    role: member.role,
    specialty: member.specialty,
    avatar: api?.avatarUrl ?? member.avatar,
    bio: api?.bio,
    linkedin: linkedinUrl,
    github: githubUrl,
    email: member.email,
    isVolunteerCTA,
  };
}

function TeamMemberCard({ member }: { readonly member: EnrichedMember }) {
  if (member.isVolunteerCTA) {
    return (
      <Card
        variant="outlined"
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          transition: "all 0.2s",
          borderStyle: "dashed",
          borderColor: accent,
          "&:hover": { transform: "translateY(-2px)", boxShadow: 3, borderColor: accent },
        }}
      >
        <CardContent
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 1.5,
          }}
        >
          <Avatar
            src={member.avatar}
            alt="Você?"
            sx={{ width: 80, height: 80, border: "3px solid", borderColor: "divider" }}
          />
          <Typography variant="h6" fontWeight={700}>
            {member.name}
          </Typography>
          <Chip variant="outlined" size="small" label={member.role} sx={{ color: accent, borderColor: accent }} />
          {member.specialty && (
            <Chip size="small" label={member.specialty} sx={{ bgcolor: `${accent}22`, color: accent }} />
          )}
          <Typography variant="body2" color="text.secondary">
            Quer fazer parte da organização do DevParaná? Entre em contato e ajude a levar a comunidade para mais cidades.
          </Typography>
        </CardContent>
        <CardActions sx={{ justifyContent: "center", pt: 0, pb: 2 }}>
          <Button
            component="a"
            href="mailto:contato@codaqui.dev"
            size="small"
            variant="outlined"
            startIcon={<EmailIcon />}
            sx={{ borderColor: accent, color: accent, textTransform: "none" }}
          >
            Fale com a gente
          </Button>
          <Button
            component="a"
            href="https://www.meetup.com/pt-BR/developerparana/"
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            variant="contained"
            endIcon={<OpenInNewIcon />}
            sx={{
              bgcolor: accent,
              color: "#fff",
              textTransform: "none",
              "&:hover": { bgcolor: community.theme.primaryLight },
            }}
          >
            Conheça o Meetup
          </Button>
        </CardActions>
      </Card>
    );
  }

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
      <CardContent
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 1,
        }}
      >
        <Avatar
          src={member.avatar}
          alt={`Foto de ${member.name}`}
          sx={{ width: 80, height: 80, border: "3px solid", borderColor: "divider" }}
        />
        <Typography variant="h6" fontWeight={700}>
          {member.name}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 0.5 }}>
          <Chip variant="outlined" size="small" label={member.role} />
          {member.specialty && (
            <Chip
              size="small"
              label={member.specialty}
              sx={{ bgcolor: `${accent}22`, color: accent }}
            />
          )}
        </Box>
        {member.bio && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {member.bio}
          </Typography>
        )}
      </CardContent>
      <CardActions sx={{ justifyContent: "center", pt: 0, pb: 2 }}>
        {member.linkedin && (
          <IconButton
            size="small"
            component="a"
            href={member.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`LinkedIn de ${member.name}`}
          >
            <LinkedInIcon sx={{ color: accent }} />
          </IconButton>
        )}
        {member.github && (
          <IconButton
            size="small"
            component="a"
            href={member.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`GitHub de ${member.name}`}
          >
            <GitHubIcon />
          </IconButton>
        )}
      </CardActions>
    </Card>
  );
}

const teamHandles = team
  .map((m) => m.githubHandle?.trim())
  .filter((h): h is string => Boolean(h));

export default function DevParanaEquipePage(): React.JSX.Element {
  const { members: apiMembers, loading, error } = useCodaquiMembersBatch(teamHandles);
  const enriched = team.map((member) => enrichMember(member, apiMembers));

  return (
    <Layout
      title={`Equipe — ${community.shortName}`}
      description={`Conheça as pessoas por trás do ${community.name}`}
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
                Equipe
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400 }}>
                O DevParaná é movido por voluntários que acreditam no poder da
                comunidade para transformar a carreira de pessoas desenvolvedoras.
              </Typography>
            </Stack>
          </Container>
        </Box>

        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
          <Box component="section" sx={{ mb: 8 }}>
            <Typography variant="h4" component="h2" sx={{ mb: 1, fontWeight: 700 }}>
              Coordenação e Voluntários
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 700 }}>
              Conheça quem ajuda a manter a comunidade ativa em todo o Paraná.
            </Typography>

            {error && (
              <Alert severity="warning" variant="outlined" sx={{ mb: 3 }}>
                {error} Os dados locais estão sendo exibidos enquanto isso.
              </Alert>
            )}

            {loading && !error && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress sx={{ color: accent }} />
              </Box>
            )}

            <Grid container spacing={3}>
              {enriched.map((member) => (
                <Grid key={member.name} size={{ xs: 12, sm: 6, md: 4 }}>
                  <TeamMemberCard member={member} />
                </Grid>
              ))}
            </Grid>
          </Box>
        </Container>
      </main>
    </Layout>
  );
}
