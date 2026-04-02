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
} from "@mui/material";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import GitHubIcon from "@mui/icons-material/GitHub";
import { diretoria, membros, alumni, mentores, type Member } from "../../data/team";
import PageHero from "../../components/PageHero";

function MemberCard({ name, role, specialty, avatar, linkedin, github }: Member) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.2s",
        "&:hover": { transform: "translateY(-2px)", boxShadow: 3 },
      }}
    >
      <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 1 }}>
        <Avatar
          src={avatar}
          alt={`Foto de ${name}`}
          sx={{ width: 80, height: 80, border: "3px solid", borderColor: "divider" }}
        />
        <Typography variant="h6">{name}</Typography>
        <Chip variant="outlined" size="small" label={role} sx={{ mt: 0.5 }} />
        {specialty && (
          <Chip variant="filled" color="primary" size="small" label={specialty} />
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
            <LinkedInIcon color="primary" />
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

function Section({
  title,
  members,
  description,
  id,
}: {
  title: string;
  members: Member[];
  description?: string;
  id?: string;
}) {
  return (
    <Box id={id} sx={{ mb: 8 }}>
      <Typography variant="h4" component="h2" sx={{ mb: 1, fontWeight: 700 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 700 }}>
          {description}
        </Typography>
      )}
      <Divider sx={{ mb: 4 }} />
      <Grid container spacing={3}>
        {members.map((m) => (
          <Grid key={m.name + m.role} size={{ xs: 12, sm: 6, md: 4 }}>
            <MemberCard {...m} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default function EquipePage(): React.JSX.Element {
  return (
    <Layout title="Equipe" description="Conheça a diretoria, membros, mentores e alumni da Codaqui">
      <main>
        <PageHero
          eyebrow="Associação Codaqui · CNPJ 44.593.429/0001-05"
          title="Quem somos"
          subtitle="Quebramos barreiras e democratizamos o acesso à tecnologia. Uma associação sem fins lucrativos que atua como guarda-chuva de comunidades tech."
        />

        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
          <Section
            title="Diretoria"
            description="Responsável pela gestão, representação legal e prestação de contas da associação."
            members={diretoria}
          />
          <Section title="Membros" members={membros} />
          <Section
            title="Alumni"
            description="Pessoas que fizeram parte da associação e contribuíram para sua história e fundação."
            members={alumni}
          />
          <Section
            id="mentores"
            title="Mentores"
            description="Nossos mentores participam do programa #QueroMentoria, oferecendo mentorias individuais e aulas para quem está iniciando na tecnologia."
            members={mentores}
          />
        </Container>
      </main>
    </Layout>
  );
}
