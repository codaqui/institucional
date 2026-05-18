import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import BusinessIcon from "@mui/icons-material/Business";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Pagination from "@mui/material/Pagination";
import PageHero from "../components/PageHero";

interface Sponsor {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  status: string;
  totalSupportedReais: number;
  supportCount: number;
  monthsSupporting: number;
}

interface SponsorsResponse {
  items: Sponsor[];
  total: number;
  page: number;
  limit: number;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PatrocinadoresPage(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const apiUrl =
    (siteConfig.customFields?.apiUrl as string) ?? "http://localhost:3001";

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(12);
  const totals = sponsors.reduce(
    (acc, sponsor) => ({
      totalSupportedReais: acc.totalSupportedReais + (sponsor.totalSupportedReais ?? 0),
      supportCount: acc.supportCount + (sponsor.supportCount ?? 0),
      monthsSupporting: acc.monthsSupporting + (sponsor.monthsSupporting ?? 0),
    }),
    { totalSupportedReais: 0, supportCount: 0, monthsSupporting: 0 },
  );

  useEffect(() => {
    fetch(`${apiUrl}/companies/sponsors?page=${page}&limit=${limit}`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: SponsorsResponse | Sponsor[]) => {
        if (Array.isArray(data)) {
          setSponsors(data ?? []);
          setTotal(data.length);
        } else {
          setSponsors(Array.isArray(data.items) ? data.items : []);
          setTotal(data.total ?? 0);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [apiUrl, page, limit]);

  return (
    <Layout
      title="Patrocinadores"
      description="Empresas que apoiam o ecossistema Codaqui e ajudam a democratizar tecnologia."
    >
      <PageHero
        eyebrow="Patrocinadores"
        title="Empresas que acreditam"
        subtitle="Estas empresas investem no ecossistema Codaqui e ajudam a democratizar tecnologia para jovens em todo o Brasil."
      />

      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
        {loading && (
          <Grid container spacing={3}>
            {[1, 2, 3].map((i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                <Skeleton variant="rounded" height={200} />
              </Grid>
            ))}
          </Grid>
        )}

        {!loading && sponsors.length === 0 && (
          <Box sx={{ textAlign: "center", py: 10 }}>
            <BusinessIcon sx={{ fontSize: 72, color: "text.disabled", mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Nenhum patrocinador ativo no momento.
            </Typography>
            <Typography
              variant="body2"
              color="text.disabled"
              sx={{ mb: 3 }}
            >
              Sua empresa pode ser a primeira! Apoie a Codaqui e apareça aqui.
            </Typography>
            <Button variant="contained" href="/participe/apoiar">
              Quero apoiar como empresa
            </Button>
          </Box>
        )}

        {!loading && sponsors.length > 0 && (
          <>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">
                      Total apoiado (página atual)
                    </Typography>
                    <Typography variant="h5" fontWeight={800}>
                      {formatCurrency(totals.totalSupportedReais)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">
                      Apoios confirmados (página atual)
                    </Typography>
                    <Typography variant="h5" fontWeight={800}>
                      {totals.supportCount}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="overline" color="text.secondary">
                      Meses apoiando (página atual)
                    </Typography>
                    <Typography variant="h5" fontWeight={800}>
                      {totals.monthsSupporting}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={3}>
              {sponsors.map((s) => (
                <Grid key={s.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      "&:hover": {
                        boxShadow: 6,
                        transform: "translateY(-4px)",
                      },
                      transition: "all .2s",
                    }}
                  >
                    <CardContent
                      sx={{
                        flexGrow: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        pt: 4,
                      }}
                    >
                      {s.logoUrl ? (
                        <Box
                          component="img"
                          src={s.logoUrl}
                          alt={s.name}
                          sx={{
                            height: 64,
                            maxWidth: 180,
                            objectFit: "contain",
                            mb: 2,
                          }}
                        />
                      ) : (
                        <Avatar
                          sx={{
                            width: 64,
                            height: 64,
                            mb: 2,
                            bgcolor: "primary.main",
                          }}
                          alt={s.name}
                        >
                          <BusinessIcon />
                        </Avatar>
                      )}
                      <Typography variant="h6" fontWeight={700}>
                        {s.name}
                      </Typography>
                      <Chip
                        label="Patrocinador"
                        color="primary"
                        size="small"
                        variant="outlined"
                        sx={{ mt: 1, mb: 1.5 }}
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                        <strong>{formatCurrency(s.totalSupportedReais ?? 0)}</strong>
                        {" em "}
                        <strong>{s.supportCount ?? 0}</strong>
                        {" apoio"}{(s.supportCount ?? 0) !== 1 ? "s" : ""}
                        {(s.monthsSupporting ?? 0) > 0 && (
                          <>{" · "}<strong>{s.monthsSupporting}</strong>{" mês"}{s.monthsSupporting !== 1 ? "es" : ""}</>
                        )}
                      </Typography>
                    </CardContent>

                    {s.websiteUrl && (
                      <Box sx={{ px: 2, pb: 2 }}>
                        <Button
                          fullWidth
                          variant="outlined"
                          size="small"
                          href={s.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          endIcon={<OpenInNewIcon />}
                        >
                          Visitar site
                        </Button>
                      </Box>
                    )}
                  </Card>
                </Grid>
              ))}
            </Grid>
            {total > limit && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
                <Pagination
                  page={page}
                  count={Math.max(1, Math.ceil(total / limit))}
                  onChange={(_, value) => setPage(value)}
                  color="primary"
                />
              </Box>
            )}
          </>
        )}

        {/* CTA para novas empresas */}
        <Box
          sx={{
            mt: 8,
            p: { xs: 3, md: 5 },
            bgcolor: "action.hover",
            borderRadius: 3,
            textAlign: "center",
          }}
        >
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Sua empresa também pode apoiar
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 3, maxWidth: 560, mx: "auto" }}
          >
            A partir de R$&nbsp;200/mês, sua empresa ganha visibilidade nesta
            página, SortCoins para os sorteios e impacto real no ecossistema
            tech brasileiro.
          </Typography>
          <Button variant="contained" size="large" href="/participe/apoiar">
            Apoiar como empresa
          </Button>
        </Box>

        {/* Minha Empresa — link para a página dedicada */}
        <Box sx={{ mt: 6, textAlign: "center" }}>
          <Button
            variant="outlined"
            color="success"
            size="medium"
            startIcon={<BusinessIcon />}
            href="/membros/empresa"
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Gerenciar minha empresa
          </Button>
        </Box>
      </Container>
    </Layout>
  );
}
