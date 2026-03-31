import React from "react";
import Layout from "@theme/Layout";
import {
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Box,
  Typography,
  Container,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { projects, type Project } from "../data/projects";

function ProjectCard({ emoji, title, description, href }: Project) {
  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: 1,
        borderColor: "divider",
        transition: "all 0.2s",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: 6,
          borderColor: "primary.main",
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ fontSize: "2.5rem", mb: 1 }}>{emoji}</Box>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </CardContent>
      <CardActions>
        <Button
          variant="outlined"
          size="small"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          endIcon={<OpenInNewIcon />}
        >
          Ver no GitHub
        </Button>
      </CardActions>
    </Card>
  );
}

export default function ProjetosPage(): React.JSX.Element {
  return (
    <Layout title="Projetos" description="Projetos mantidos pela comunidade Codaqui">
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Box sx={{ textAlign: "center", mb: 6 }}>
          <Typography variant="h3" fontWeight={700} gutterBottom>
            Projetos 🛠️
          </Typography>
          <Typography variant="body1" color="text.secondary">
            A Codaqui é uma comunidade viva. Abaixo estão projetos que mantemos — em laboratório
            ou em produção — abertos para contribuição.
          </Typography>
        </Box>

        <Card variant="outlined" sx={{ mb: 6, p: 3, bgcolor: "action.hover" }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Como contribuir?
          </Typography>
          <Box component="ol" sx={{ pl: 3, m: 0 }}>
            <Typography component="li" variant="body1" sx={{ mb: 0.5 }}>
              Escolha um projeto que desperte seu interesse.
            </Typography>
            <Typography component="li" variant="body1" sx={{ mb: 0.5 }}>
              Abra uma <em>issue</em> descrevendo o que gostaria de fazer.
            </Typography>
            <Typography component="li" variant="body1">
              Aguarde o ok da equipe e mãos à obra!
            </Typography>
          </Box>
        </Card>

        <Grid container spacing={3}>
          {projects.map((project) => (
            <Grid key={project.title} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard {...project} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Layout>
  );
}
