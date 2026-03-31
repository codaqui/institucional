import React from "react";
import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Typography,
  useTheme,
} from "@mui/material";
import { communities, type Community } from "../data/communities";
import { DISCORD_URL, WHATSAPP_URL } from "../data/social";
import { SupportersBadge } from "../components/OpenCollective";

function HeroBanner() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Box
      component="header"
      sx={{
        background: (theme) =>
          `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
        py: { xs: 6, md: 8 },
        textAlign: "center",
      }}
    >
      <Container maxWidth="lg">
        <Box
          component="img"
          src="/img/logo.png"
          alt="Codaqui Logo"
          sx={{ width: 120, height: "auto", mb: 3 }}
        />
        <Typography variant="h3" component="h1" fontWeight={800} color="white">
          {siteConfig.title}
        </Typography>
        <Typography
          variant="h6"
          sx={{ color: "rgba(255,255,255,0.85)", maxWidth: 600, mx: "auto", mt: 2, mb: 3 }}
        >
          {siteConfig.tagline}
        </Typography>

        {/* Non-intrusive social proof — shows backer count, links to OC */}
        <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
          <SupportersBadge />
        </Box>

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            gap: 2,
            mt: 1,
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

function LinksSection() {
  const channels = [
    {
      href: WHATSAPP_URL,
      emoji: "📱",
      title: "WhatsApp",
      description: "Entre no nosso grupo do WhatsApp",
    },
    {
      href: DISCORD_URL,
      emoji: "💬",
      title: "Discord",
      description: "Participe do nosso servidor do Discord",
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        🔗 Links Importantes
      </Typography>
      <Grid container spacing={3}>
        {channels.map((channel) => (
          <Grid key={channel.title} size={{ xs: 12, sm: 6 }}>
            <Card
              component="a"
              href={channel.href}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              sx={{
                display: "block",
                textDecoration: "none",
                color: "inherit",
                textAlign: "center",
                transition: "all 0.2s",
                "&:hover": {
                  transform: "translateY(-2px)",
                  boxShadow: 3,
                  borderColor: "primary.main",
                },
              }}
            >
              <CardContent>
                <Typography variant="h5" gutterBottom>
                  {channel.emoji} {channel.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {channel.description}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

export default function Home(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title="Página Inicial" description={siteConfig.tagline}>
      <HeroBanner />
      <main>
        <FeaturesSection />
        <CommunitySection />
        <LinksSection />
      </main>
    </Layout>
  );
}
