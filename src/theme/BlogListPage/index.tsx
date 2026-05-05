import React, { type ReactNode } from "react";
import clsx from "clsx";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import {
  HtmlClassNameProvider,
  PageMetadata,
  ThemeClassNames,
} from "@docusaurus/theme-common";
import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import GitHubIcon from "@mui/icons-material/GitHub";
import RssFeedRoundedIcon from "@mui/icons-material/RssFeedRounded";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Layout from "@theme/Layout";
import BlogSidebar from "@theme/BlogSidebar";
import BlogListPaginator from "@theme/BlogListPaginator";
import type { Props } from "@theme/BlogListPage";
import BlogPostItems from "@theme/BlogPostItems";
import BlogListPageStructuredData from "@theme/BlogListPage/StructuredData";
import SearchMetadata from "@theme/SearchMetadata";
import PageHero from "@site/src/components/PageHero";
import { DISCORD_URL, GITHUB_ORG } from "@site/src/data/social";
import { resolveCommunityFromPath } from "@site/src/lib/community-context";

const CATEGORIES = [
  { label: "Todos os posts", href: "/blog" },
  { label: "Institucional", href: "/blog/category/institucional" },
  { label: "Tutoriais", href: "/blog/category/tutoriais" },
  { label: "Projetos", href: "/blog/category/projetos" },
  { label: "Curiosidade", href: "/blog/category/curiosidade" },
];

function BlogListPageMetadata(props: Props): ReactNode {
  const { metadata } = props;
  const {
    siteConfig: { title: siteTitle },
  } = useDocusaurusContext();
  const { blogDescription, blogTitle, permalink } = metadata;
  const title = permalink === "/" ? siteTitle : blogTitle;

  return (
    <>
      <PageMetadata title={title} description={blogDescription} />
      <SearchMetadata tag="blog_posts_list" />
    </>
  );
}

function BlogListPageContent(props: Props): ReactNode {
  const { metadata, items, sidebar } = props;
  const currentPageCount = items.length;
  const hasSidebar = Boolean(sidebar?.items.length);
  const community = resolveCommunityFromPath(metadata.permalink);
  const metrics = [
    `${metadata.totalCount} publicações`,
    `${currentPageCount} nesta página`,
    `${metadata.totalPages} páginas de conteúdo`,
  ];

  if (community) {
    return (
      <Layout>
        <PageHero
          eyebrow={`Blog da ${community.shortName}`}
          title={`Blog da ${community.shortName}`}
          subtitle={`Histórias, prestações de contas e novidades da comunidade ${community.name}.`}
        >
          <Stack
            direction="row"
            spacing={1}
            justifyContent="center"
            flexWrap="wrap"
            useFlexGap
            sx={{ mb: 3 }}
          >
            {metrics.map((metric) => (
              <Chip
                key={metric}
                label={metric}
                sx={{
                  bgcolor: "rgba(255,255,255,0.18)",
                  color: "common.white",
                  fontWeight: 700,
                }}
              />
            ))}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              size="large"
              href="#posts"
              startIcon={<AutoStoriesRoundedIcon />}
              sx={{
                bgcolor: "common.white",
                color: "primary.dark",
                fontWeight: 700,
                "&:hover": { bgcolor: "grey.100" },
              }}
            >
              Explorar publicações
            </Button>
            <Button
              variant="outlined"
              size="large"
              href={`${community.basePath}/blog/rss.xml`}
              startIcon={<RssFeedRoundedIcon />}
              sx={{
                color: "common.white",
                borderColor: "rgba(255,255,255,0.45)",
                fontWeight: 700,
                "&:hover": { borderColor: "common.white", bgcolor: "rgba(255,255,255,0.08)" },
              }}
            >
              Assinar RSS
            </Button>
          </Stack>
        </PageHero>

        <div className="container margin-vert--lg">
          <div className="row">
            <BlogSidebar sidebar={sidebar} />
            <main
              id="posts"
              className={clsx("col codaqui-blog-list-content", {
                "col--7": hasSidebar,
                "col--9 col--offset-1": !hasSidebar,
              })}
            >
              <BlogPostItems items={items} />
              <BlogListPaginator metadata={metadata} />
            </main>
          </div>
        </div>

        <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: "background.paper" }}>
          <Container maxWidth="md">
            <Card variant="outlined">
              <CardContent sx={{ p: { xs: 3, md: 4 }, textAlign: "center" }}>
                <Typography variant="h5" fontWeight={800} gutterBottom>
                  Sobre a {community.shortName}
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  {community.description}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
                  <Button variant="contained" href={community.basePath}>
                    Voltar à home da comunidade
                  </Button>
                  <Button variant="outlined" href={`${community.basePath}/apoiar`}>
                    Apoiar
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Container>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHero
        eyebrow="Conteúdo da comunidade"
        title="Blog da Codaqui"
        subtitle="Tutoriais técnicos, bastidores da Associação, relatos de projetos e publicações que ajudam a democratizar o acesso à tecnologia."
      >
        <Stack
          direction="row"
          spacing={1}
          justifyContent="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mb: 3 }}
        >
          {metrics.map((metric) => (
            <Chip
              key={metric}
              label={metric}
              sx={{
                bgcolor: "rgba(255,255,255,0.18)",
                color: "common.white",
                fontWeight: 700,
              }}
            />
          ))}
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
          <Button
            variant="contained"
            size="large"
            href="#posts"
            startIcon={<AutoStoriesRoundedIcon />}
            sx={{
              bgcolor: "common.white",
              color: "primary.dark",
              fontWeight: 700,
              "&:hover": { bgcolor: "grey.100" },
            }}
          >
            Explorar publicações
          </Button>
          <Button
            variant="outlined"
            size="large"
            href="/blog/rss.xml"
            startIcon={<RssFeedRoundedIcon />}
            sx={{
              color: "common.white",
              borderColor: "rgba(255,255,255,0.45)",
              fontWeight: 700,
              "&:hover": { borderColor: "common.white", bgcolor: "rgba(255,255,255,0.08)" },
            }}
          >
            Assinar RSS
          </Button>
        </Stack>
      </PageHero>

      <Box sx={{ bgcolor: "background.default", py: { xs: 3, md: 4 } }}>
        <Container maxWidth="lg">
          <Card variant="outlined">
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Grid container spacing={3} alignItems="center">
                <Grid size={{ xs: 12, md: 7 }}>
                  <Stack spacing={1.5}>
                    <Typography variant="h5" fontWeight={800}>
                      Uma curadoria feita pela comunidade
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Navegue entre posts institucionais, tutoriais e relatos de iniciativas
                      práticas. A paginação, as categorias e o feed continuam ativos para facilitar
                      sua rotina de leitura.
                    </Typography>
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {CATEGORIES.map((category) => (
                      <Chip
                        key={category.label}
                        label={category.label}
                        component="a"
                        href={category.href}
                        clickable
                        variant="outlined"
                        sx={{
                          fontWeight: 700,
                          "&:hover": {
                            borderColor: "primary.main",
                            bgcolor: "action.hover",
                          },
                        }}
                      />
                    ))}
                  </Stack>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Container>
      </Box>

      <div className="container margin-vert--lg">
        <div className="row">
          <BlogSidebar sidebar={sidebar} />
          <main
            id="posts"
            className={clsx("col codaqui-blog-list-content", {
              "col--7": hasSidebar,
              "col--9 col--offset-1": !hasSidebar,
            })}
          >
            <BlogPostItems items={items} />
            <BlogListPaginator metadata={metadata} />
          </main>
        </div>
      </div>

      <Box sx={{ py: { xs: 6, md: 8 }, bgcolor: "background.paper" }}>
        <Container maxWidth="md">
          <Card variant="outlined">
            <CardContent sx={{ p: { xs: 3, md: 4 }, textAlign: "center" }}>
              <Typography variant="h5" fontWeight={800} gutterBottom>
                Quer publicar com a gente?
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Compartilhe um tutorial, conte a história de um projeto ou proponha uma pauta para
                o blog da Associação Codaqui.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
                <Button
                  variant="contained"
                  href="https://github.com/orgs/codaqui/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<GitHubIcon />}
                >
                  Abrir discussão
                </Button>
                <Button
                  variant="outlined"
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  startIcon={<ForumOutlinedIcon />}
                >
                  Conversar no Discord
                </Button>
                <Button
                  variant="outlined"
                  href={`${GITHUB_ORG}/institucional`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver repositório
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </Layout>
  );
}

export default function BlogListPage(props: Props): ReactNode {
  return (
    <HtmlClassNameProvider
      className={clsx(
        ThemeClassNames.wrapper.blogPages,
        ThemeClassNames.page.blogListPage,
      )}
    >
      <BlogListPageMetadata {...props} />
      <BlogListPageStructuredData {...props} />
      <BlogListPageContent {...props} />
    </HtmlClassNameProvider>
  );
}
