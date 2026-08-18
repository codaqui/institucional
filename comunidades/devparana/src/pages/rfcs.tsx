import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import ArticleIcon from "@mui/icons-material/Article";
import community from "../../community.config";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;

interface RfcMeta {
  id: string;
  title: string;
  authors: string;
  status: "Ready" | "Draft";
  summary: string;
  to: string;
}

// Nota: esses metadados devem bater com o frontmatter de cada RFC em
// `comunidades/devparana/docs/rfcs/*.mdx`.
const rfcs: RfcMeta[] = [
  {
    id: "001",
    title: "Projeto Embaixadores",
    authors: "Everton Tavares",
    status: "Ready",
    summary:
      "Formaliza a organização do DevParaná por regiões do Paraná, definindo responsabilidades, processo de nomeação e acompanhamento dos embaixadores.",
    to: "/comunidades/devparana/docs/rfcs/projeto-embaixadores",
  },
  {
    id: "002",
    title: "DevParaná na Estrada 2026",
    authors: "Everton Tavares, Luiz Schons",
    status: "Ready",
    summary:
      "Planejamento executado da edição 2026 do evento itinerante, com formatos de meetup e workshop+palestras, patrocínios locais, custos e cronograma.",
    to: "/comunidades/devparana/docs/rfcs/devparana-na-estrada-2026",
  },
];

function getStatusColor(status: RfcMeta["status"]): "success" | "default" {
  return status === "Ready" ? "success" : "default";
}

export default function DevParanaRfcsPage(): React.JSX.Element {
  return (
    <Layout
      title={`RFCs — ${community.shortName}`}
      description="Propostas e decisões da comunidade DevParaná."
    >
      <Box
        sx={{
          bgcolor: (t) => (t.palette.mode === "dark" ? accentDark : accent),
          color: "#fff",
          py: { xs: 6, md: 8 },
        }}
      >
        <Container maxWidth="lg">
          <Stack spacing={2} maxWidth={760}>
            <Chip
              label={community.name}
              sx={{
                bgcolor: "rgba(255,255,255,0.18)",
                color: "#fff",
                width: "fit-content",
                fontWeight: 600,
              }}
            />
            <Typography variant="h2" component="h1" fontWeight={800}>
              RFCs
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400 }}>
              Propostas e decisões da comunidade. Aqui documentamos iniciativas
              em discussão, aprovadas e em implementação.
            </Typography>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        <Grid container spacing={3}>
          {rfcs.map((rfc) => (
            <Grid key={rfc.id} size={{ xs: 12, md: 6 }}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  transition: "all 0.2s",
                  "&:hover": { transform: "translateY(-4px)", boxShadow: 3, borderColor: accent },
                }}
              >
                <CardActionArea
                  component={Link}
                  to={rfc.to}
                  sx={{ height: "100%", alignItems: "flex-start" }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, color: accent }}>
                      <ArticleIcon fontSize="small" />
                      <Typography variant="overline" fontWeight={700}>
                        RFC {rfc.id}
                      </Typography>
                    </Stack>
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                      {rfc.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {rfc.summary}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip label={rfc.status} color={getStatusColor(rfc.status)} size="small" />
                      <Chip variant="outlined" size="small" label={`Por ${rfc.authors}`} />
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Layout>
  );
}
