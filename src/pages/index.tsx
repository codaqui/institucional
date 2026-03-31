import React from "react";
import clsx from "clsx";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { useColorMode } from "@docusaurus/theme-common";
import styles from "./index.module.css";
import {
  Grid,
  Card,
  CardContent,
  Box,
  Typography,
  Container,
} from "@mui/material";
import { communities, type Community } from "../data/communities";
import { DISCORD_URL, WHATSAPP_URL } from "../data/social";

function HeroBanner() {
  const { siteConfig } = useDocusaurusContext();
  const { colorMode } = useColorMode();
  // logo.png = dark green (visible on light bg) → light mode navbar & dark-mode hero
  // logo_blk.png = light mint (visible on dark bg) → dark mode navbar & light-mode hero
  // The hero uses --ifm-color-primary (#1a1a1a) as background in light mode → needs light logo
  const logoSrc = colorMode === "dark" ? "/img/logo.png" : "/img/logo_blk.png";
  return (
    <header className={clsx("hero hero--primary", styles.heroBanner)}>
      <div className="container">
        <img
          src={logoSrc}
          alt="Codaqui Logo"
          className={styles.heroLogo}
        />
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/participe/estudar"
          >
            #QueroEstudar
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/participe/apoiar"
          >
            #QueroApoiar
          </Link>
        </div>
      </div>
    </header>
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
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        🎓 Nossa solução
      </Typography>
      <Grid container spacing={3}>
        {features.map((feature) => (
          <Grid key={feature.title} size={{ xs: 12, sm: 6 }}>
            <Card sx={{ height: "100%", border: 1, borderColor: "divider" }}>
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
  return (
    <Box sx={{ bgcolor: "action.hover", py: 6 }}>
      <Container maxWidth="lg">
        <Typography variant="h4" fontWeight={700} gutterBottom>
          🤝 Comunidades Participantes
        </Typography>
        <Grid container spacing={2} justifyContent="center">
          {communities.map((community: Community) => {
            const link = community.links[0]?.url ?? "#";
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
          <img
                    src={community.logo}
                    alt={community.name}
                    className="community-logo-img"
                    style={{ width: 64, height: 64, objectFit: "contain", borderRadius: 8 }}
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
    <Container maxWidth="lg" sx={{ py: 6 }}>
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
              sx={{
                display: "block",
                textDecoration: "none",
                color: "inherit",
                border: 1,
                borderColor: "divider",
                textAlign: "center",
                transition: "all 0.2s",
                "&:hover": {
                  transform: "translateY(-3px)",
                  boxShadow: 4,
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
