import React from "react";
import Layout from "@theme/Layout";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PageHero from "../../components/PageHero";
import { titulos } from "../../data/titulos";

export default function TitulosPage(): React.JSX.Element {
  return (
    <Layout
      title="Títulos e Reconhecimentos"
      description="Títulos e reconhecimentos oficiais da Associação Codaqui: Selo OSC do IPEA (Mapa das Organizações da Sociedade Civil) e declaração de utilidade pública municipal (Lei nº 12.181/2026, Maringá-PR)."
    >
      <PageHero
        eyebrow="Associação Codaqui"
        title="Títulos e Reconhecimentos"
        subtitle="Selos, leis e reconhecimentos oficiais que atestam o trabalho e a regularidade da Associação Codaqui."
      />

      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Grid container spacing={3}>
          {titulos.map((titulo) => (
            <Grid key={titulo.id} size={{ xs: 12, md: 6 }}>
              <Card
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  transition: (theme) =>
                    theme.transitions.create(["box-shadow", "transform"]),
                  "&:hover": { transform: "translateY(-4px)", boxShadow: 6 },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  {titulo.destaque && (
                    <Chip
                      label={titulo.destaque}
                      color="primary"
                      size="small"
                      sx={{ mb: 2, fontWeight: 600 }}
                    />
                  )}

                  {titulo.imagem && (
                    <Box
                      sx={{
                        bgcolor: "common.white",
                        border: (theme) =>
                          `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        p: 1.5,
                        mb: 2,
                        display: "inline-block",
                      }}
                    >
                      <Box
                        component="img"
                        src={titulo.imagem}
                        alt={titulo.imagemAlt ?? titulo.titulo}
                        sx={{ height: 44, width: "auto", display: "block" }}
                      />
                    </Box>
                  )}

                  <Typography variant="h5" fontWeight={700} gutterBottom>
                    {titulo.titulo}
                  </Typography>

                  {titulo.orgao && (
                    <Typography
                      variant="overline"
                      color="text.secondary"
                      sx={{ display: "block", lineHeight: 1.4, mb: 1 }}
                    >
                      {titulo.orgao}
                    </Typography>
                  )}

                  <Typography variant="body2" color="text.secondary" paragraph>
                    {titulo.descricao}
                  </Typography>

                  {titulo.metadados && (
                    <Box component="dl" sx={{ m: 0, mt: 1 }}>
                      {titulo.metadados.map((metadado) => (
                        <Box
                          key={metadado.label}
                          sx={{
                            display: "flex",
                            gap: 1,
                            py: 0.5,
                            borderBottom: (theme) =>
                              `1px dashed ${theme.palette.divider}`,
                            "&:last-of-type": { borderBottom: 0 },
                          }}
                        >
                          <Typography
                            component="dt"
                            variant="body2"
                            fontWeight={600}
                            sx={{ minWidth: 104, flexShrink: 0 }}
                          >
                            {metadado.label}
                          </Typography>
                          <Typography
                            component="dd"
                            variant="body2"
                            color="text.secondary"
                            sx={{ m: 0 }}
                          >
                            {metadado.value}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>

                <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                  {titulo.links.map((link) => (
                    <Button
                      key={link.url}
                      size="small"
                      href={link.url}
                      {...(link.external
                        ? { target: "_blank", rel: "noopener noreferrer" }
                        : {})}
                      endIcon={link.external ? <OpenInNewIcon /> : undefined}
                    >
                      {link.label}
                    </Button>
                  ))}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Layout>
  );
}
