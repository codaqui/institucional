import React from "react";
import Layout from "@theme/Layout";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import SchoolIcon from "@mui/icons-material/School";
import GroupsIcon from "@mui/icons-material/Groups";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";

interface Track {
  icon: string;
  title: string;
  description: string;
  lessonCount: number;
  level: string;
  topics: string[];
  href: string;
}

const tracks: Track[] = [
  {
    icon: "🐍",
    title: "Python 101",
    description:
      "Aprenda Python do zero com exercícios práticos. Abrange desde variáveis e estruturas de controle até orientação a objetos e projetos reais.",
    lessonCount: 16,
    level: "Iniciante",
    topics: [
      "Lógica de programação",
      "Variáveis e tipos",
      "Condicionais e laços",
      "Funções",
      "Arquivos",
      "POO",
      "Projetos práticos",
    ],
    href: "/trilhas/python/page-1",
  },
  {
    icon: "🐙",
    title: "GitHub 101",
    description:
      "Domine Git e GitHub para colaborar em projetos de software. Aprenda versionamento, colaboração e automação com GitHub Actions.",
    lessonCount: 8,
    level: "Iniciante",
    topics: [
      "Git básico",
      "Repositórios",
      "Commits e branches",
      "Pull requests",
      "Colaboração",
      "GitHub Actions",
    ],
    href: "/trilhas/github/page-1",
  },
];

const howItWorks = [
  {
    icon: <AutoStoriesIcon fontSize="large" />,
    title: "Curadoria de conteúdo",
    description:
      "Não criamos do zero — curatamos o melhor da internet. Cada lição aponta para materiais verificados pela comunidade de mentores.",
  },
  {
    icon: <GroupsIcon fontSize="large" />,
    title: "Aprendizado colaborativo",
    description:
      "Os próprios participantes e mentores atualizam continuamente os currículos. Você aprende e contribui ao mesmo tempo.",
  },
  {
    icon: <SchoolIcon fontSize="large" />,
    title: "Metodologia GitBased",
    description:
      "Todo o material está no GitHub — aberto, versionado e em constante evolução. Você acompanha o progresso como num projeto real.",
  },
];

function TrackCard({ icon, title, description, lessonCount, level, topics, href }: Readonly<Track>) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.2s",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: 4,
          borderColor: "primary.main",
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ fontSize: "3rem", mb: 1.5 }}>{icon}</Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          {title}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 0.5 }}>
          <Chip label={`${lessonCount} aulas`} color="primary" size="small" />
          <Chip label={level} color="success" size="small" variant="outlined" />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 1 }}>
          O QUE VOCÊ VAI APRENDER
        </Typography>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
          {topics.map((topic) => (
            <Chip key={topic} label={topic} size="small" variant="outlined" sx={{ fontSize: "0.7rem" }} />
          ))}
        </Stack>
      </CardContent>
      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          href={href}
          fullWidth
        >
          Começar trilha
        </Button>
      </CardActions>
    </Card>
  );
}

export default function TrilhasPage(): React.JSX.Element {
  return (
    <Layout
      title="Trilhas de Aprendizado"
      description="Aprenda programação com trilhas estruturadas e curadas pela comunidade Codaqui."
    >
      {/* Hero */}
      <Box
        sx={{
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
          py: { xs: 6, md: 8 },
          textAlign: "center",
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="h3" component="h1" fontWeight={800} color="white">
            🗺️ Trilhas de Aprendizado
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: "rgba(255,255,255,0.85)", maxWidth: 640, mx: "auto", mt: 2 }}
          >
            Percursos estruturados e curados pela comunidade para você aprender programação no
            seu ritmo — com suporte real de mentores.
          </Typography>
        </Container>
      </Box>

      {/* Track cards */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Typography variant="h4" fontWeight={700} textAlign="center" gutterBottom>
          Trilhas disponíveis
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          textAlign="center"
          sx={{ mb: 5, maxWidth: 560, mx: "auto" }}
        >
          Comece por qualquer trilha. Se ainda não conhece Git, recomendamos começar pelo
          GitHub 101 antes de avançar para outras linguagens.
        </Typography>
        <Grid container spacing={4} justifyContent="center">
          {tracks.map((track) => (
            <Grid key={track.title} size={{ xs: 12, md: 6 }}>
              <TrackCard {...track} />
            </Grid>
          ))}
        </Grid>

        {/* Under construction notice */}
        <Card
          variant="outlined"
          sx={{ mt: 4, p: 3, bgcolor: "action.hover", textAlign: "center" }}
        >
          <Typography variant="body1" color="text.secondary">
            🏗️ Novas trilhas estão sendo construídas. Quer ajudar?{" "}
            <Button
              variant="text"
              size="small"
              href="https://github.com/orgs/codaqui/discussions/new/choose"
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir uma discussão no GitHub
            </Button>
          </Typography>
        </Card>
      </Container>

      {/* How it works */}
      <Box sx={{ bgcolor: "action.hover", py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight={700} textAlign="center" gutterBottom>
            Como funciona
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            textAlign="center"
            sx={{ mb: 5, maxWidth: 560, mx: "auto" }}
          >
            Nossa metodologia é simples: curar, estruturar e compartilhar o melhor conteúdo
            disponível, com acompanhamento humano.
          </Typography>
          <Grid container spacing={4}>
            {howItWorks.map((item) => (
              <Grid key={item.title} size={{ xs: 12, md: 4 }}>
                <Card variant="outlined" sx={{ height: "100%", p: 1 }}>
                  <CardContent>
                    <Box sx={{ color: "primary.main", mb: 1.5 }}>{item.icon}</Box>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* What students get */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Grid container spacing={4} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              O que você vai ganhar
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Nossas trilhas são desenhadas para quem está começando, mas com profundidade
              suficiente para quem quer realmente evoluir.
            </Typography>
            <Stack spacing={1.5}>
              {[
                "Acesso gratuito a todo o conteúdo",
                "Suporte da comunidade no Discord",
                "Mentores voluntários disponíveis",
                "Material atualizado pela própria comunidade",
                "Certificado de participação ao concluir",
              ].map((benefit) => (
                <Box key={benefit} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CheckCircleOutlineIcon sx={{ color: "primary.main", flexShrink: 0 }} />
                  <Typography variant="body1">{benefit}</Typography>
                </Box>
              ))}
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                p: 4,
                textAlign: "center",
                color: "white",
              }}
            >
              <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
                Pronto para começar?
              </Typography>
              <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.85)", mb: 3 }}>
                Inscreva-se gratuitamente e junte-se à comunidade Codaqui. Acesse mentores,
                Discord exclusivo e certificados.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
                <Button
                  variant="contained"
                  size="large"
                  href="/participe/estudar"
                  sx={{
                    bgcolor: "white",
                    color: "primary.dark",
                    fontWeight: 700,
                    "&:hover": { bgcolor: "rgba(255,255,255,0.9)" },
                  }}
                >
                  Quero me inscrever
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  href="https://discord.com/invite/xuTtxqCPpz"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    borderColor: "white",
                    color: "white",
                    "&:hover": { borderColor: "rgba(255,255,255,0.7)", bgcolor: "rgba(255,255,255,0.1)" },
                  }}
                >
                  Entrar no Discord
                </Button>
              </Stack>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Layout>
  );
}
