import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ChatIcon from "@mui/icons-material/Chat";
import GitHubIcon from "@mui/icons-material/GitHub";
import SchoolIcon from "@mui/icons-material/School";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import { BackersWall, DonateButton } from "../../components/OpenCollective";
import { WHATSAPP_URL } from "../../data/social";

const CONTRIBUTION_STEPS = [
  {
    number: "01",
    title: "Discussão",
    description:
      "O espaço de discussões é o primeiro ponto. Como somos uma comunidade, todos têm voz para comentar qualquer assunto alinhado aos nossos objetivos.",
    href: "https://github.com/codaqui/institucional/discussions",
    linkLabel: "Abrir Discussões →",
  },
  {
    number: "02",
    title: "Issue",
    description:
      "Uma discussão pode se tornar uma Issue no GitHub — espaço estruturado para a comunidade planejar a resolução de um problema.",
    href: "https://github.com/codaqui/institucional/issues",
    linkLabel: "Ver Issues →",
  },
  {
    number: "03",
    title: "Pull Request",
    description:
      "A solução chega com um PR. O voluntário (ou grupo) propõe uma alteração no código e passa pela revisão da comunidade.",
    href: "https://github.com/codaqui/institucional/pulls",
    linkLabel: "Ver PRs →",
  },
  {
    number: "04",
    title: "Código de Conduta",
    description:
      "Todo esse processo é guiado por nosso Código de Conduta. Leia antes de contribuir.",
    href: "/sobre/conduta",
    linkLabel: "Ler Conduta →",
  },
];

const CONTRIBUTION_IDEAS = [
  "Sugerir temas para novas trilhas de aprendizado",
  "Interagir com postagens do Blog",
  "Opinar sobre os certificados",
  "Criar enquetes e fomentar debates",
  "Sugerir ideias em geral",
  "Criar ou responder perguntas da comunidade",
];

export default function ApoiarPage(): React.JSX.Element {
  return (
    <Layout
      title="#QueroApoiar"
      description="Saiba como apoiar a Codaqui — financeiramente ou com sua participação"
    >
      {/* Hero */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #57B593 0%, #3D8A68 100%)",
          color: "#fff",
          py: { xs: 6, md: 10 },
          textAlign: "center",
        }}
      >
        <Container maxWidth="md">
          <Chip
            label="#QueroApoiar"
            sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "#fff", mb: 2, fontWeight: 700 }}
          />
          <Typography variant="h2" fontWeight={800} gutterBottom>
            Apoie a Codaqui
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, maxWidth: 560, mx: "auto", mb: 4 }}>
            Toda contribuição — financeira ou de tempo — impacta diretamente jovens que
            aprendem tecnologia com a gente.
          </Typography>
          <DonateButton label="Fazer uma doação" size="large" />
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>

        {/* ── Apoio Financeiro ── */}
        <Box sx={{ mb: 8 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <FavoriteIcon sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Apoio Financeiro
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 680 }}>
            A Codaqui é uma associação sem fins lucrativos. Usamos o{" "}
            <Link href="https://opencollective.com/codaqui" target="_blank" rel="noopener noreferrer">
              OpenCollective
            </Link>{" "}
            para receber doações de forma transparente — você vê para onde vai cada real.
            Qualquer valor faz diferença.
          </Typography>

          <Alert
            severity="info"
            sx={{ mb: 3 }}
          >
            <AlertTitle>Níveis em discussão</AlertTitle>
            Os valores, níveis e benefícios abaixo estão em fase de teste e podem mudar.
            Quer opinar?{" "}
            <Link href="https://github.com/orgs/codaqui/discussions/447" target="_blank" rel="noopener noreferrer">
              Participe da discussão no GitHub →
            </Link>
          </Alert>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            {[
              {
                tier: "Apoiador",
                value: "R$ 20/mês",
                perks: [
                  "Nome na lista de apoiadores",
                  "Acesso antecipado a novidades",
                  "Canal privado de discussões com organizadores",
                ],
              },
              {
                tier: "Patrocinador",
                value: "R$ 100/mês",
                perks: [
                  "Logo na página de associação",
                  "Menção no blog",
                  "Canal privado de discussões com organizadores",
                  "Todos os benefícios anteriores",
                ],
              },
              {
                tier: "Patrono",
                value: "Valor único",
                perks: [
                  "Contribuição pontual",
                  "Sem compromisso de recorrência",
                  "Transparência total do uso",
                ],
              },
            ].map((plan) => (
              <Grid key={plan.tier} size={{ xs: 12, sm: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    height: "100%",
                    borderColor: "primary.main",
                    "&:hover": { boxShadow: 3, transform: "translateY(-2px)", transition: "all 0.2s ease" },
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" fontWeight={700} color="primary.main">
                      {plan.tier}
                    </Typography>
                    <Typography variant="h5" fontWeight={800} sx={{ my: 1 }}>
                      {plan.value}
                    </Typography>
                    <Divider sx={{ my: 1.5 }} />
                    {plan.perks.map((p) => (
                      <Typography key={p} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                        ✓ {p}
                      </Typography>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <DonateButton label="Fazer uma doação no OpenCollective" />
            <DonateButton
              label="Ver finanças transparentes"
              variant="outlined"
              href="https://opencollective.com/codaqui/transactions?kind=ALL"
            />
          </Box>
        </Box>

        <Divider sx={{ my: 6 }} />

        {/* ── Nossos Apoiadores ── */}
        <Box sx={{ mb: 8 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Quem já apoia a Codaqui
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 680 }}>
            Essas pessoas acreditam que tecnologia de qualidade deve chegar a todos.
            Junte-se a elas.
          </Typography>
          <BackersWall limit={24} avatarSize={60} />
        </Box>

        <Divider sx={{ my: 6 }} />

        {/* ── Apoio Institucional ── */}
        <Box sx={{ mb: 8 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <GitHubIcon sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Apoio Institucional
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 680 }}>
            Não tem como contribuir financeiramente? Seu tempo e conhecimento valem tanto.
            Veja como o processo funciona:
          </Typography>

          <Grid container spacing={2} sx={{ mb: 4 }}>
            {CONTRIBUTION_STEPS.map((step) => (
              <Grid key={step.number} size={{ xs: 12, sm: 6 }}>
                <Card
                  variant="outlined"
                  sx={{ height: "100%", "&:hover": { boxShadow: 2, transition: "box-shadow 0.2s" } }}
                >
                  <CardContent>
                    <Typography
                      variant="h3"
                      sx={{ fontSize: "2.5rem", fontWeight: 900, color: "primary.main", opacity: 0.25, lineHeight: 1, mb: 1 }}
                    >
                      {step.number}
                    </Typography>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                      {step.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {step.description}
                    </Typography>
                    <Link href={step.href} target={step.href.startsWith("http") ? "_blank" : undefined}>
                      <Typography variant="body2" fontWeight={600} color="primary.main">
                        {step.linkLabel}
                      </Typography>
                    </Link>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Card variant="outlined" sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <ChatIcon sx={{ color: "primary.main" }} />
              <Typography variant="h6" fontWeight={700}>
                Com o que posso ajudar nas discussões?
              </Typography>
            </Box>
            <Grid container spacing={1}>
              {CONTRIBUTION_IDEAS.map((idea) => (
                <Grid key={idea} size={{ xs: 12, sm: 6 }}>
                  <Typography variant="body2" color="text.secondary">
                    → {idea}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          </Card>
        </Box>

        <Divider sx={{ my: 6 }} />

        {/* ── Não sei usar GitHub ── */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <SchoolIcon sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Novo no GitHub?
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
            Sem problema. Nossa trilha de GitHub vai te colocar em dia. Enquanto isso,
            pode mandar um WhatsApp — alguém vai te ajudar.
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Link href="/trilhas/github/">
              <Box
                component="span"
                sx={{
                  display: "inline-flex", alignItems: "center", gap: 0.75,
                  px: 2, py: 1, border: 1, borderColor: "primary.main",
                  borderRadius: 2, color: "primary.main", fontWeight: 600,
                  fontSize: "0.875rem", cursor: "pointer",
                  "&:hover": { bgcolor: "primary.main", color: "#fff" },
                  transition: "all 0.15s ease",
                }}
              >
                <SchoolIcon sx={{ fontSize: "1.1rem" }} />
                Trilha GitHub 101
              </Box>
            </Link>
            <Link href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Box
                component="span"
                sx={{
                  display: "inline-flex", alignItems: "center", gap: 0.75,
                  px: 2, py: 1, border: 1, borderColor: "divider",
                  borderRadius: 2, color: "text.secondary", fontWeight: 600,
                  fontSize: "0.875rem", cursor: "pointer",
                  "&:hover": { borderColor: "primary.main", color: "primary.main" },
                  transition: "all 0.15s ease",
                }}
              >
                <OpenInNewIcon sx={{ fontSize: "1rem" }} />
                Falar no WhatsApp
              </Box>
            </Link>
          </Box>
        </Box>

      </Container>
    </Layout>
  );
}
