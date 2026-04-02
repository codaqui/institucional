import React from "react";
import Layout from "@theme/Layout";
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  Grid,
  Container,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import InstagramIcon from "@mui/icons-material/Instagram";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import TwitterIcon from "@mui/icons-material/Twitter";
import ForumIcon from "@mui/icons-material/Forum";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { socialChannels, type SocialChannel } from "../data/social";
import PageHero from "../components/PageHero";

const iconMap: Record<string, React.ReactElement> = {
  email: <EmailIcon sx={{ fontSize: "2rem", color: "primary.main" }} />,
  instagram: <InstagramIcon sx={{ fontSize: "2rem", color: "primary.main" }} />,
  linkedin: <LinkedInIcon sx={{ fontSize: "2rem", color: "primary.main" }} />,
  twitter: <TwitterIcon sx={{ fontSize: "2rem", color: "primary.main" }} />,
  discord: <ForumIcon sx={{ fontSize: "2rem", color: "primary.main" }} />,
  whatsapp: <WhatsAppIcon sx={{ fontSize: "2rem", color: "primary.main" }} />,
};

function ChannelCard({ key: channelKey, name, description, href, cta }: SocialChannel) {
  const isExternal = href.startsWith("http");
  return (
    <Card
      component="a"
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      variant="outlined"
      sx={{
        textDecoration: "none",
        color: "inherit",
        display: "flex",
        alignItems: "center",
        gap: 2,
        p: 2.5,
        transition: "all 0.2s",
        "&:hover": { transform: "translateY(-2px)", boxShadow: 3, borderColor: "primary.main" },
      }}
    >
      <Box>{iconMap[channelKey]}</Box>
      <Box flex={1}>
        <Typography variant="h6">{name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      </Box>
      <Chip label={cta} variant="outlined" color="primary" size="small" sx={{ flexShrink: 0 }} />
    </Card>
  );
}

export default function ContatoPage(): React.JSX.Element {
  return (
    <Layout title="Contato" description="Entre em contato com a Codaqui">
      <main>
      <PageHero
        eyebrow="Entre em contato"
        title="Fale com a Codaqui"
        subtitle="Escolha o canal que preferir — estamos disponíveis em várias plataformas."
      />
        <Container maxWidth="md" sx={{ py: { xs: 6, md: 8 } }}>
          <Grid container spacing={2}>
            {socialChannels.map((c) => (
              <Grid key={c.key} size={{ xs: 12, sm: 6 }}>
                <ChannelCard {...c} />
              </Grid>
            ))}
          </Grid>
        </Container>
      </main>
    </Layout>
  );
}
