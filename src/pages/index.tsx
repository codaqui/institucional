import React from "react";
import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Link from "@docusaurus/Link";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { communities, type Community } from "../data/communities";
import { DISCORD_URL, DISCORD_WIDGET_URL, socialChannels } from "../data/social";
import DiscordServerWidget from "../components/DiscordServerWidget";

function HeroBanner() {
  return (
    <Box
      component="header"
      sx={{
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
        py: { xs: 7, md: 10 },
        textAlign: "center",
      }}
    >
      <Container maxWidth="md">
        {/* Logo is the wordmark — no separate title text needed */}
        <Box
          component="img"
          src="/img/logo_monocromatica.svg"
          alt="Codaqui"
          sx={{ width: { xs: 160, md: 200 }, height: "auto", mb: 4 }}
        />
        <Typography
          variant="h5"
          component="p"
          sx={{ color: "rgba(255,255,255,0.9)", maxWidth: 560, mx: "auto", mb: 4, lineHeight: 1.6 }}
        >
          Democratizando o ensino de tecnologia para jovens brasileiros 🇧🇷
        </Typography>
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Button
            variant="contained"
            size="large"
            href="/participe/estudar"
            sx={{
              bgcolor: "white",
              color: "primary.dark",
              fontWeight: 700,
              "&:hover": { bgcolor: "grey.100" },
            }}
          >
            #QueroEstudar
          </Button>
          <Button
            variant="outlined"
            size="large"
            href="/participe/apoiar"
            sx={{
              color: "white",
              borderColor: "rgba(255,255,255,0.5)",
              fontWeight: 700,
              "&:hover": { borderColor: "white", bgcolor: "rgba(255,255,255,0.1)" },
            }}
          >
            #QueroApoiar
          </Button>
        </Box>
      </Container>
    </Box>
  );
}

/** Thin social-proof strip entre hero e conteúdo */
function SocialProofStrip() {
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://api.localhost:8000";
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    fetch(`${apiUrl}/members/donors`)
      .then((r) => r.json())
      .then((res: { total?: number; data?: unknown[] }) =>
        setCount(res.total ?? res.data?.length ?? 0),
      )
      .catch(() => {});
  }, [apiUrl]);

  return (
    <Box
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
        py: 1.5,
        textAlign: "center",
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {count === null
          ? "Carregando apoiadores…"
          : `${count} pessoas apoiam e constroem a Codaqui 💚`}
      </Typography>
    </Box>
  );
}

type FeatureItem = {
  title: string;
  emoji: string;
  description: string;
};

const features: FeatureItem[] = [
  {
    title: "Autonomia no aprendizado",
    emoji: "📚",
    description:
      "Os participantes percorrem de forma autônoma trilhas de aprendizado criadas com a ajuda de especialistas voluntários e, semanalmente, encontram um mentor para atividades práticas.",
  },
  {
    title: "Resolução de problemas reais",
    emoji: "🛠️",
    description:
      "Além dos projetos pessoais desenvolvidos ao longo do programa, os participantes podem contribuir com projetos reais de organizações sem fins lucrativos, podendo receber uma bolsa financeira.",
  },
  {
    title: "Acesso a computador e internet",
    emoji: "💻",
    description:
      "Incentivamos nossos membros a ocupar espaços públicos, estabelecendo parcerias para que todos tenham acesso a computador, internet e uma estação de estudo.",
  },
  {
    title: "Comunidade de Comunidades",
    emoji: "🤝",
    description:
      "Além de todos esses benefícios, a Codaqui integra outras comunidades em sua estrutura, proporcionando oportunidades adicionais de networking e compartilhamento de conhecimento.",
  },
];

function FeaturesSection() {
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        🎓 Nossa solução
      </Typography>
      <Grid container spacing={3}>
        {features.map((feature) => (
          <Grid key={feature.title} size={{ xs: 12, sm: 6 }}>
            <Card
              variant="outlined"
              sx={{
                height: "100%",
                transition: "all 0.2s",
                "&:hover": { boxShadow: 3, transform: "translateY(-2px)" },
              }}
            >
              <CardContent>
                <Box component="span" sx={{ fontSize: "2rem", display: "block", mb: 1 }}>
                  {feature.emoji}
                </Box>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

function CommunitySection() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Box sx={{ bgcolor: "action.hover", py: { xs: 6, md: 10 } }}>
      <Container maxWidth="lg">
        <Typography variant="h4" fontWeight={700} gutterBottom>
          🤝 Comunidades Participantes
        </Typography>
        <Grid container spacing={2} justifyContent="center">
          {communities.map((community: Community) => {
            const link = community.links[0]?.url ?? "#";
            const isLocal = community.logo.startsWith("/img/");
            return (
              <Grid key={community.id} size={{ xs: 6, sm: 4, md: 2 }}>
                <Box
                  component="a"
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    textAlign: "center",
                    textDecoration: "none",
                    color: "inherit",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                    p: 1,
                    borderRadius: 2,
                    transition: "all 0.2s",
                    "&:hover": { bgcolor: "action.selected" },
                  }}
                >
                  <Box
                    component="img"
                    src={community.logo}
                    alt={community.name}
                    sx={{
                      width: 64,
                      height: 64,
                      objectFit: "contain",
                      borderRadius: 2,
                      filter: isDark && isLocal ? "invert(1) brightness(2)" : "none",
                    }}
                  />
                  <Typography variant="body2" fontWeight={600}>
                    {community.name}
                  </Typography>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Container>
    </Box>
  );
}

function JoinSection() {
  const otherChannels = socialChannels.filter((c) => c.key !== "discord");

  return (
    <Box sx={{ bgcolor: "action.hover", py: { xs: 6, md: 10 } }}>
      <Container maxWidth="lg">
        <Grid container spacing={5} alignItems="flex-start">
          <Grid size={{ xs: 12, lg: 7 }}>
            <Typography variant="h4" fontWeight={800} gutterBottom>
              💬 Entre na comunidade
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Conecte-se com participantes e mentores ao vivo no Discord.
            </Typography>
            <DiscordServerWidget widgetUrl={DISCORD_WIDGET_URL} />
          </Grid>

          <Grid size={{ xs: 12, lg: 5 }}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>
              Siga e acompanhe
            </Typography>
            <Stack spacing={1.5}>
              {otherChannels.map((channel) => (
                <Card
                  key={channel.key}
                  component={Link}
                  href={channel.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  sx={{
                    display: "block",
                    textDecoration: "none",
                    color: "inherit",
                    transition: "all 0.2s",
                    "&:hover": { transform: "translateX(4px)", boxShadow: 2, borderColor: "primary.main" },
                  }}
                >
                  <CardContent sx={{ py: "12px !important", px: 2 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Typography variant="h5" component="span" sx={{ lineHeight: 1, minWidth: 28 }}>
                        {channel.emoji}
                      </Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" fontWeight={700} noWrap>
                          {channel.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {channel.description}
                        </Typography>
                      </Box>
                      <OpenInNewIcon sx={{ fontSize: 16, color: "text.disabled", flexShrink: 0 }} />
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>

            <Button
              component={Link}
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              variant="contained"
              size="large"
              endIcon={<OpenInNewIcon />}
              fullWidth
              sx={{ mt: 3 }}
            >
              Entrar no Discord
            </Button>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default function Home(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title="Página Inicial" description={siteConfig.tagline}>
      <HeroBanner />
      <SocialProofStrip />
      <main>
        <FeaturesSection />
        <CommunitySection />
        <JoinSection />
      </main>
    </Layout>
  );
}
