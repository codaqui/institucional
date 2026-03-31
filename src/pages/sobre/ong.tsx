import React from "react";
import Layout from "@theme/Layout";
import {
  Card,
  CardContent,
  CardActions,
  Button,
  Avatar,
  Box,
  Typography,
  Chip,
  Stack,
  Grid,
  Container,
  Divider,
} from "@mui/material";
import { communities, type Community } from "../../data/communities";

function CommunityCard({ community }: { community: Community }) {
  return (
    <Card
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: 1,
        borderColor: "divider",
        transition: "all 0.2s",
        "&:hover": { boxShadow: 4 },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Avatar
            src={community.logo}
            alt={community.name}
            imgProps={{ className: "community-logo-img" }}
            sx={{
              width: 56,
              height: 56,
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              "& img": { objectFit: "contain", p: 0.5 },
            }}
          />
          <Box>
            <Typography variant="h6">{community.name}</Typography>
            {community.location && (
              <Typography variant="caption" color="text.secondary">
                {community.location}
              </Typography>
            )}
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {community.description}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1} mt={2}>
          {community.tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" variant="outlined" />
          ))}
        </Stack>
      </CardContent>
      <CardActions sx={{ gap: 1, flexWrap: "wrap", pt: 0 }}>
        {community.links.map((link) => (
          <Button
            key={link.url}
            size="small"
            variant="outlined"
            href={link.url}
            target="_blank"
          >
            {link.label}
          </Button>
        ))}
      </CardActions>
    </Card>
  );
}

export default function OngPage(): React.JSX.Element {
  return (
    <Layout
      title="Associação"
      description="Programa de Apoio Institucional da Codaqui para comunidades de tecnologia"
    >
      <Box
        sx={{
          background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
          py: 8,
          textAlign: "center",
        }}
      >
        <Typography variant="h3" color="white" fontWeight={800}>
          Programa de Apoio Institucional
        </Typography>
        <Typography
          variant="h6"
          sx={{ color: "rgba(255,255,255,0.9)", maxWidth: 600, mx: "auto", mt: 2 }}
        >
          Capacite sua comunidade, amplie seu impacto e aumente seu alcance com
          nosso programa de apoio institucional e suporte especializado.
        </Typography>
      </Box>

      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h4" component="h2" mb={4} fontWeight={700}>
          Comunidades apoiadas
        </Typography>

        <Grid container spacing={3}>
          {communities.map((community: Community) => (
            <Grid key={community.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <CommunityCard community={community} />
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

        <Typography variant="h5" fontWeight={700} mb={2}>
          Transparência
        </Typography>
        <Typography variant="body1" mb={1}>
          A Codaqui acredita em gestão aberta e prestação de contas pública.
        </Typography>
        <Stack spacing={1}>
          <Typography variant="body1">
            <strong>📊 Demonstrativos Financeiros</strong>: Consulte receitas,
            despesas e repasses através do{" "}
            <a href="http://opencollective.com/codaqui" target="_blank" rel="noopener noreferrer">
              Open Collective
            </a>
            .
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
            </a>
            .
          </Typography>
        </Stack>
      </Container>
    </Layout>
  );
}
