import React from "react";
import Layout from "@theme/Layout";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import FavoriteIcon from "@mui/icons-material/Favorite";
import { communities, type Community } from "../../data/communities";
import MembersWall from "../../components/MembersWall";
import PageHero from "../../components/PageHero";
import CommunityPresenceCard from "../../components/CommunityPresenceCard";
import { useSocialStatsSnapshot } from "../../hooks/useSocialStatsSnapshot";

export default function OngPage(): React.JSX.Element {
  const { profilesFor } = useSocialStatsSnapshot();
  return (
    <Layout
      title="Associação"
      description="Programa de Apoio Institucional da Codaqui para comunidades de tecnologia"
    >
      <PageHero
        eyebrow="Programa de Apoio Institucional"
        title="Codaqui para Comunidades"
        subtitle="Capacitamos comunidades tech com recursos, mentoria especializada e suporte jurídico-contábil para que ampliem seu impacto."
      />

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Typography variant="h4" component="h2" mb={4} fontWeight={700}>
          Comunidades apoiadas
        </Typography>

        <Grid container spacing={3}>
          {communities.map((community: Community) => (
            <Grid key={community.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <CommunityPresenceCard
                entityId={community.id}
                name={`${community.emoji} ${community.name}`}
                logo={community.logo}
                description={community.description}
                profiles={profilesFor(community.id)}
                location={community.location}
                tags={community.tags}
                links={community.links.map((l) => ({ label: l.label, url: l.url }))}
              />
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ my: 6 }} />

        <Typography variant="h4" component="h2" mb={3} fontWeight={700}>
          Como podemos ajudar
        </Typography>

        <Typography variant="body1" mb={3}>
          Nosso suporte institucional é desenvolvido para atender às necessidades
          únicas do seu projeto social.
        </Typography>

        <Stack spacing={1.5} mb={4}>
          {[
            {
              label: "🔧 Recursos Exclusivos",
              text: "Acesso a ferramentas e materiais de apoio, com suporte completo para que todos os aspectos do seu projeto sejam bem geridos e alinhados.",
            },
            {
              label: "⭐ Mentoria Especializada",
              text: "Orientação de especialistas nas áreas de tecnologia, desenvolvimento, jurídico e contábil.",
            },
            {
              label: "🤝 Conexão",
              text: "Acesso a uma rede de contatos com profissionais e líderes da indústria, ampliando suas oportunidades.",
            },
            {
              label: "💰 Apoio Financeiro",
              text: "Oportunidades de financiamento e patrocínio para apoiar seus projetos e eventos.",
            },
            {
              label: "📢 Visibilidade",
              text: "Assistência na promoção da sua comunidade e iniciativas.",
            },
          ].map(({ label, text }) => (
            <Typography key={label} variant="body1">
              <strong>{label}</strong>: {text}
            </Typography>
          ))}
        </Stack>

        <Typography variant="h5" fontWeight={700} mb={2}>
          Como funciona
        </Typography>
        <Typography variant="body1" mb={1}>
          O primeiro passo é bem simples: apresente seu projeto e vamos conversar
          sobre como podemos ajudar.
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Button variant="contained" href="mailto:contato@codaqui.dev">
            ✉️ Enviar e-mail
          </Button>
          <Button variant="outlined" href="/bio">
            💬 Discord / WhatsApp
          </Button>
        </Stack>

        <Divider sx={{ my: 6 }} />

        <Box sx={{ mb: 6 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <FavoriteIcon sx={{ color: "primary.main" }} />
            <Typography variant="h5" fontWeight={700}>
              Quem apoia a Codaqui
            </Typography>
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 640 }}>
            Essas pessoas e organizações acreditam que tecnologia de qualidade deve
            chegar a todos. Toda contribuição financeira é rastreada em nosso{" "}
            <a href="/transparencia">portal de transparência</a>.
          </Typography>
          <MembersWall endpoint="/members/donors" limit={12} />
          <Box sx={{ mt: 3, display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Button variant="outlined" href="/participe/apoiar">
              Quero fazer parte
            </Button>
            <Button variant="text" href="/membros">
              Ver mais membros →
            </Button>
          </Box>
        </Box>

        <Divider sx={{ my: 6 }} />

        <Typography variant="h5" fontWeight={700} mb={2}>
          Transparência
        </Typography>
        <Typography variant="body1" mb={1}>
          A Codaqui acredita em gestão aberta e prestação de contas pública.
        </Typography>
        <Stack spacing={1}>
          <Typography variant="body1">
            <strong>📊 Demonstrativos Financeiros</strong>: Consulte receitas,
            despesas e repasses no{" "}
            <a href="/transparencia">Portal de Transparência</a>.
          </Typography>
          <Typography variant="body1">
            <strong>📄 Atas de Reuniões</strong>: Todas as atas estão disponíveis
            publicamente no{" "}
            <a
              href="https://drive.google.com/drive/folders/1-5VqXGS_UaRTdrRJLbawT8FUSpKxaKSU?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Drive
            </a>{"."}
          </Typography>
        </Stack>
      </Container>
    </Layout>
  );
}
