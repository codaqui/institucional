import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import InfoIcon from "@mui/icons-material/Info";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SchoolIcon from "@mui/icons-material/School";
import PageHero from "../../components/PageHero";
import InfoCard from "../../components/InfoCard";
import { DISCORD_URL, WHATSAPP_URL } from "../../data/social";

const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSdt1Klx324MMMCswN7ot-FnvTLvWEEQW711ySbHomHCd0OGLw/viewform";

const TURMAS = [
  { mes: "Fevereiro", modalidade: "Gestão e Produtividade", datas: "18/02 (Intro), 24/02 e 02/03", instrutor: "Danilo Mesquita", plataforma: "Discord" },
  {
    mes: "Abril e Maio",
    modalidade: "Educação Financeira",
    datas: "13/04, 20/04, 27/04, 03/05 e 11/05 às 19h30",
    instrutor: "Valnaire Nascimento",
    plataforma: "Discord",
  },
  { mes: "Abril", modalidade: "Lógica de Programação com Python", datas: "20/04, 22/04, 27/04 e 29/04 às 20h30", instrutor: "Paulinea", plataforma: "Discord" },
  { mes: "Maio", modalidade: "Product Discovery & Plataforma como Produto", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
  { mes: "Junho", modalidade: "FinOps / CloudSRE", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
  { mes: "Julho", modalidade: "C# e SQL", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
  { mes: "Agosto", modalidade: "First Steps and Understanding Rust", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
  { mes: "Setembro", modalidade: "NodeJS", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
  { mes: "Setembro", modalidade: "Cibersegurança", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
  { mes: "Outubro", modalidade: "A confirmar", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
  { mes: "Novembro", modalidade: "Kotlin e KMP", datas: "A confirmar", instrutor: "A confirmar", plataforma: "Discord" },
];

const GRUPOS_ESTUDO = [
  { tema: "Arquitetura de Software e DDD", mediador: "Eugênio Tavares" },
];

const TRACKS = [
  { emoji: "🐍", name: "Python", href: "/trilhas/python" },
  { emoji: "🐙", name: "GitHub", href: "/trilhas/github" },
];

const HOW_IT_WORKS = [
  {
    number: "01",
    title: "Encontros semanais",
    description:
      "Encontros virtuais via Discord com um mentor, abordando conteúdos do mundo da tecnologia conforme o nível do grupo.",
    href: DISCORD_URL,
    linkLabel: "Entrar no Discord →",
    external: true,
  },
  {
    number: "02",
    title: "Trilhas de aprendizado",
    description:
      "Estude de forma autônoma com nossas trilhas de Python e GitHub — disponíveis a qualquer hora.",
    href: "/trilhas",
    linkLabel: "Ver trilhas →",
    external: false,
  },
  {
    number: "03",
    title: "Mentoria individual",
    description:
      "Precisa de acompanhamento mais próximo? Solicite uma mentoria individual com um de nossos voluntários.",
    href: "/participe/mentoria",
    linkLabel: "Saiba mais sobre mentoria →",
    external: false,
  },
];

const CERTIFICATE_STEPS = [
  {
    number: "01",
    text: "Aceitar o convite para iniciar o certificado",
    href: "https://classroom.github.com/a/jFE-cOK3",
    linkLabel: "Aceitar convite →",
  },
  {
    number: "02",
    text: "O convite cria automaticamente um repositório para você em github.com/codaqui/python-101-SEUUSUARIO",
    href: null,
    linkLabel: null,
  },
  {
    number: "03",
    text: "Responda todos os exercícios e crie os arquivos necessários no repositório.",
    href: null,
    linkLabel: null,
  },
  {
    number: "04",
    text: "Abra uma issue solicitando o certificado — descreva como foi realizar os exercícios.",
    href: "https://github.com/codaqui/institucional/issues/new/choose",
    linkLabel: "Abrir issue →",
  },
];

export default function EstudarPage(): React.JSX.Element {
  return (
    <Layout
      title="#QueroEstudar"
      description="Encontros semanais, trilhas de aprendizado e mentoria individual — de graça."
    >
      {/* ── Hero ── */}
      <PageHero
        eyebrow="Quero Estudar"
        title="Aprenda Tecnologia"
        subtitle="Encontros semanais, trilhas de aprendizado e mentoria individual — de graça."
      >
        <Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
          <Button
            variant="contained"
            size="large"
            component={Link}
            href={GOOGLE_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              bgcolor: "common.white",
              color: "primary.dark",
              fontWeight: 700,
              "&:hover": { bgcolor: "grey.100" },
            }}
          >
            Inscrever-se (2026)
          </Button>
          <Button
            variant="outlined"
            size="large"
            component={Link}
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              borderColor: "common.white",
              color: "common.white",
              fontWeight: 700,
              "&:hover": { borderColor: "common.white", bgcolor: "rgba(255,255,255,0.1)" },
            }}
          >
            Acessar comunidade
          </Button>
        </Box>
      </PageHero>

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>

        {/* ── Público Alvo ── */}
        <Box sx={{ mb: 8 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <SchoolIcon sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Para quem é?
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 680 }}>
            Nosso programa é aberto — sem restrição de idade ou nível prévio.
          </Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InfoCard
                title="Início de carreira ou transição"
                description="Nosso formato de encontros em grupo é ideal para quem está dando os primeiros passos ou migrando de área. Não limitamos idade ou critério de entrada — apenas pedimos frequência e participação ativa."
                borderColor="primary.main"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <InfoCard
                title="Grupos de Estudo"
                description="Para participantes com experiência intermediária ou avançada que queiram aprofundar temas específicos. Os grupos se reúnem para explorar conteúdos técnicos em maior profundidade."
                borderColor="primary.main"
              />
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 6 }} />

        {/* ── Como funciona ── */}
        <Box sx={{ mb: 8 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <InfoIcon sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Como funciona?
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 680 }}>
            Cada participante evolui no seu ritmo, com suporte da comunidade e dos mentores.
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
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
                      href={step.href}
                      target={step.external ? "_blank" : undefined}
                      rel={step.external ? "noopener noreferrer" : undefined}
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

          <Alert severity="info" icon={false}>
            💬 Tire dúvidas a qualquer momento no{" "}
            <Link href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
              Discord
            </Link>{" "}
            — toda a comunidade de participantes, mentores e colaboradores está lá.
          </Alert>
        </Box>

        <Divider sx={{ my: 6 }} />

        {/* ── Trilhas disponíveis ── */}
        <Box sx={{ mb: 8 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <MenuBookIcon sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Trilhas disponíveis
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 680 }}>
            Estude de forma autônoma e peça ajuda na comunidade quando precisar.
          </Typography>

          <Grid container spacing={3}>
            {TRACKS.map((track) => (
              <Grid key={track.name} size={{ xs: 12, sm: 6 }}>
                <Card
                  variant="outlined"
                  sx={{
                    height: "100%",
                    borderColor: "primary.main",
                    "&:hover": { boxShadow: 3, transform: "translateY(-2px)", transition: "all 0.2s ease" },
                  }}
                >
                  <CardContent>
                    <Typography variant="h4" sx={{ mb: 1 }}>
                      {track.emoji}
                    </Typography>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                      {track.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Trilha de aprendizado autônomo com suporte da comunidade no Discord.
                    </Typography>
                    <Link href={track.href}>
                      <Typography variant="body2" fontWeight={600} color="primary.main">
                        Começar trilha →
                      </Typography>
                    </Link>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Divider sx={{ my: 6 }} />

        {/* ── Cronograma 2026 ── */}
        <Box sx={{ mb: 8 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <CalendarMonthIcon sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Cronograma 2026
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 680 }}>
            Novos temas e instrutores ao longo do ano — inscreva-se para ser avisado.
          </Typography>

          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            Turmas
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 6 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Mês</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Modalidade</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Datas / Horário</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Instrutor</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Plataforma</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {TURMAS.map((row, i) => {
                  const muted = row.instrutor === "A confirmar";
                  return (
                    <TableRow key={`${row.mes}-${row.modalidade}`} hover>
                      <TableCell sx={muted ? { color: "text.disabled" } : undefined}>
                        {row.mes}
                      </TableCell>
                      <TableCell sx={muted ? { color: "text.disabled" } : undefined}>
                        {row.modalidade}
                      </TableCell>
                      <TableCell sx={muted ? { color: "text.disabled" } : undefined}>
                        {row.datas}
                      </TableCell>
                      <TableCell sx={muted ? { color: "text.disabled" } : undefined}>
                        {row.instrutor}
                      </TableCell>
                      <TableCell sx={muted ? { color: "text.disabled" } : undefined}>
                        {row.plataforma}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            Grupos de Estudos
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Tema</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Mediador</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {GRUPOS_ESTUDO.map((row) => (
                  <TableRow key={row.tema} hover>
                    <TableCell>{row.tema}</TableCell>
                    <TableCell>{row.mediador}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Divider sx={{ my: 6 }} />

        {/* ── Certificado ── */}
        <Box sx={{ mb: 8 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <EmojiEventsIcon sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Certificado
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
            <Chip label="Em desenvolvimento" color="warning" size="small" />
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 680 }}>
            Ao concluir os exercícios da trilha, você pode solicitar seu certificado de conclusão.
          </Typography>

          <Grid container spacing={2}>
            {CERTIFICATE_STEPS.map((step) => (
              <Grid key={step.number} size={{ xs: 12, sm: 6 }}>
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
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {step.text}
                    </Typography>
                    {step.href && step.linkLabel && (
                      <Link href={step.href} target="_blank" rel="noopener noreferrer">
                        <Typography variant="body2" fontWeight={600} color="primary.main">
                          {step.linkLabel}
                        </Typography>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Divider sx={{ my: 6 }} />

        {/* ── Comunidade ── */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <GroupsIcon sx={{ color: "primary.main" }} />
            <Typography variant="h4" fontWeight={700}>
              Comunidade
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
            Participe da nossa comunidade para interagir com outros membros, tirar dúvidas
            e estudar em grupo.
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
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
                  borderColor: "primary.main",
                  borderRadius: 2,
                  color: "primary.main",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "primary.main", color: "primary.contrastText" },
                  transition: "all 0.15s ease",
                }}
              >
                📱 WhatsApp
              </Box>
            </Link>
            <Link href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
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
                Discord
              </Box>
            </Link>
          </Box>
        </Box>

      </Container>
    </Layout>
  );
}
