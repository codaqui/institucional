import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import GroupsIcon from "@mui/icons-material/Groups";
import HandshakeIcon from "@mui/icons-material/Handshake";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import InfoIcon from "@mui/icons-material/Info";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PageHero from "../../components/PageHero";
import { DISCORD_URL, WHATSAPP_URL } from "../../data/social";

const CALENDAR_URL =
  "https://calendar.google.com/calendar/appointments/AcZssZ3ofYNXgj7RZo-JvhnBpBxo5kryoqul_raZzhg=?gv=true";

const MENTORS = [
  {
    name: "Enderson Menezes",
    turma: "DevOps e Iniciantes",
    focus: "Carreira em tecnologia, ferramentas, dicas e projetos",
    availability: "Segundas 19:30h às 21h",
    link: "https://www.enderson.dev",
  },
  {
    name: "Guilherme Siquinelli",
    turma: "Frontend e Arquitetura",
    focus: "Primeiros passos em Frontend e arquitetura de software",
    availability: "Quartas 19h às 21h",
    link: null,
  },
  {
    name: "Matheus Luis",
    turma: "Backend e .NET",
    focus: "Aprender e seguir carreira no ecossistema .NET",
    availability: "Seg, Qua e Sex 19h às 20h",
    link: null,
  },
  {
    name: "Ivo Batistela",
    turma: "Organização de Eventos",
    focus: "Como organizar um evento de tecnologia na sua cidade",
    availability: "Seg à Sex 18h às 18:30h",
    link: "https://github.com/byivo",
  },
  {
    name: "Renan Ceratto",
    turma: "Empreendedorismo",
    focus: "Empreender em tecnologia — por onde começar",
    availability: "Quintas 19h às 20h",
    link: null,
  },
];

const HOW_IT_WORKS = [
  {
    number: "01",
    title: "Escolha um mentor",
    description:
      "Leia o foco de cada mentor e escolha o que melhor se encaixa com seu objetivo.",
    to: "/sobre/equipe/#mentores",
    linkLabel: "Ver equipe de mentores →",
  },
  {
    number: "02",
    title: "Agende sua sessão",
    description:
      "Clique no botão de agendamento, escolha o mentor e o horário disponível na agenda.",
    href: CALENDAR_URL,
    linkLabel: "Abrir agenda →",
  },
  {
    number: "03",
    title: "Participe da sessão",
    description:
      "Mentoria online via Discord ou Google Meet. Dúvidas antes da sessão? Entre na comunidade.",
    href: DISCORD_URL,
    linkLabel: "Entrar no Discord →",
  },
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export default function MentoriaPage(): React.JSX.Element {
  return (
    <Layout
      title="#QueroMentoria"
      description="Conectamos você a um mentor experiente para sessões individuais online — de graça."
    >
      {/* ── Hero ── */}
      <PageHero
        title="Mentoria Individual"
        subtitle="Conectamos você a um mentor experiente para sessões individuais online — de graça."
        eyebrow="Quero Mentoria"
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5, flexWrap: "wrap" }}>
          <Button
            component={Link}
            href={CALENDAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            size="large"
            sx={{
              bgcolor: "common.white",
              color: "primary.dark",
              fontWeight: 700,
              "&:hover": { bgcolor: "grey.100" },
            }}
          >
            📅 Agendar uma sessão
          </Button>
          <Chip label="BETA" color="warning" size="small" sx={{ fontWeight: 700 }} />
        </Box>
      </PageHero>

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>

        {/* ── Seção 1: O que é o #QueroMentoria ── */}
        <Box sx={{ mb: 8 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <InfoIcon sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              O que é o #QueroMentoria
            </Typography>
          </Box>
          <Card
            variant="outlined"
            sx={{ borderColor: "primary.main", bgcolor: "background.paper" }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                O <strong>#QueroMentoria</strong> é um programa <strong>gratuito</strong> da{" "}
                <strong>Associação Codaqui</strong> que conecta o{" "}
                <Link href="/participe/estudar">#QueroEstudar</Link> ao{" "}
                <Link href="/participe/apoiar">#QueroApoiar</Link> — aproximando quem quer aprender
                de quem tem experiência para compartilhar.
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                As sessões são realizadas <strong>online</strong>, via{" "}
                <strong>Discord</strong> ou <strong>Google Meet</strong>, no horário combinado com
                o mentor.
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Aberto a qualquer pessoa — sem restrição de idade ou nível de experiência.
              </Typography>
            </CardContent>
          </Card>
        </Box>

        <Divider sx={{ my: 6 }} />

        {/* ── Seção 2: Nossos Mentores ── */}
        <Box sx={{ mb: 8 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <GroupsIcon sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Conheça nossos mentores
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 680 }}>
            Cada mentor tem um foco específico. Escolha o que melhor se encaixa no seu objetivo
            e agende uma sessão diretamente na agenda deles.
          </Typography>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            {MENTORS.map((mentor) => (
              <Grid key={mentor.name} size={{ xs: 12, md: 6 }}>
                <Card
                  variant="outlined"
                  sx={{
                    height: "100%",
                    "&:hover": {
                      boxShadow: 3,
                      transform: "translateY(-2px)",
                      transition: "all 0.2s ease",
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                      <Avatar sx={{ bgcolor: "primary.main", color: "common.white", fontWeight: 700 }}>
                        {getInitials(mentor.name)}
                      </Avatar>
                      <Box>
                        {mentor.link ? (
                          <Link href={mentor.link} target="_blank" rel="noopener noreferrer">
                            <Typography variant="h6" fontWeight={700} sx={{ color: "primary.main" }}>
                              {mentor.name}
                            </Typography>
                          </Link>
                        ) : (
                          <Typography variant="h6" fontWeight={700}>
                            {mentor.name}
                          </Typography>
                        )}
                        <Chip
                          label={mentor.turma}
                          variant="outlined"
                          color="primary"
                          size="small"
                          sx={{ mt: 0.5 }}
                        />
                      </Box>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {mentor.focus}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      <CalendarTodayIcon sx={{ fontSize: "0.875rem", color: "text.disabled" }} />
                      <Typography variant="caption" color="text.disabled">
                        {mentor.availability}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Button
            component={Link}
            href={CALENDAR_URL}
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            color="primary"
            size="large"
            startIcon={<CalendarTodayIcon />}
          >
            📅 Agendar com qualquer mentor
          </Button>
        </Box>

        <Divider sx={{ my: 6 }} />

        {/* ── Seção 3: Como funciona ── */}
        <Box sx={{ mb: 8 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <HelpOutlineIcon sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Como funciona
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 680 }}>
            Em três passos simples você já pode ter sua primeira sessão de mentoria.
          </Typography>

          <Grid container spacing={2}>
            {HOW_IT_WORKS.map((step) => (
              <Grid key={step.number} size={{ xs: 12, sm: 4 }}>
                <Card
                  variant="outlined"
                  sx={{ height: "100%", "&:hover": { boxShadow: 2, transition: "box-shadow 0.2s" } }}
                >
                  <CardContent>
                    <Typography
                      variant="h3"
                      sx={{
                        fontSize: "2.5rem",
                        fontWeight: 900,
                        color: "primary.main",
                        opacity: 0.25,
                        lineHeight: 1,
                        mb: 1,
                      }}
                    >
                      {step.number}
                    </Typography>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                      {step.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {step.description}
                    </Typography>
                    <Link
                      to={step.to || step.href}
                      target={(step.to || step.href).startsWith("http") ? "_blank" : undefined}
                      rel={(step.to || step.href).startsWith("http") ? "noopener noreferrer" : undefined}
                    >
                      <Typography variant="body2" fontWeight={600} color="primary.main">
                        {step.linkLabel}
                      </Typography>
                    </Link>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Divider sx={{ my: 6 }} />

        {/* ── Seção 4: Quero ser mentor ── */}
        <Box sx={{ mb: 8 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <HandshakeIcon sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Quero ser mentor
            </Typography>
          </Box>
          <Card variant="outlined" sx={{ p: 3 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 680 }}>
              Você tem experiência em tecnologia e quer ajudar a próxima geração? A Codaqui conecta
              mentores voluntários a quem está começando. Faça parte do programa.
            </Typography>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Link
                href="https://github.com/codaqui/institucional/discussions"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 2,
                    py: 1,
                    border: 1,
                    borderColor: "primary.main",
                    borderRadius: 2,
                    color: "primary.main",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "primary.main", color: "common.white" },
                    transition: "all 0.15s ease",
                  }}
                >
                  <OpenInNewIcon sx={{ fontSize: "1.1rem" }} />
                  Abrir discussão no GitHub
                </Box>
              </Link>
              <Link href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <Box
                  component="span"
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 0.75,
                    px: 2,
                    py: 1,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 2,
                    color: "text.secondary",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    "&:hover": { borderColor: "primary.main", color: "primary.main" },
                    transition: "all 0.15s ease",
                  }}
                >
                  <OpenInNewIcon sx={{ fontSize: "1rem" }} />
                  Falar no WhatsApp
                </Box>
              </Link>
            </Box>
          </Card>
        </Box>

        <Divider sx={{ my: 6 }} />

        {/* ── CTA Final ── */}
        <Box sx={{ mb: 4 }}>
          <Card variant="outlined" sx={{ p: 3, textAlign: "center" }}>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Ainda com dúvidas?
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 520, mx: "auto" }}>
              Tire suas dúvidas na comunidade do Discord ou veja o que o{" "}
              <strong>#QueroEstudar</strong> pode oferecer para você.
            </Typography>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
              <Button
                component={Link}
                href={DISCORD_URL}
                target="_blank"
                rel="noopener noreferrer"
                variant="contained"
                color="primary"
              >
                💬 Entrar no Discord
              </Button>
              <Button
                component={Link}
                href="/participe/estudar"
                variant="outlined"
                color="primary"
              >
                Ver #QueroEstudar
              </Button>
            </Box>
          </Card>
        </Box>

      </Container>
    </Layout>
  );
}
