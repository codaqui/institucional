import React, { type ReactNode } from 'react';
import BlogListPage from '@theme-original/BlogListPage';
import type BlogListPageType from '@theme/BlogListPage';
import type { WrapperProps } from '@docusaurus/types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import GitHubIcon from '@mui/icons-material/GitHub';

type Props = WrapperProps<typeof BlogListPageType>;

const CATEGORIES = [
  { label: 'Todos os posts', href: '/blog' },
  { label: 'Institucional', href: '/blog/category/institucional' },
  { label: 'Tutoriais', href: '/blog/category/tutoriais' },
  { label: 'Projetos', href: '/blog/category/projetos' },
  { label: 'Curiosidade', href: '/blog/category/curiosidade' },
];

export default function BlogListPageWrapper(props: Props): ReactNode {
  return (
    <>
      {/* Hero */}
      <Box
        sx={{
          background: (theme) =>
            `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
          color: '#fff',
          py: { xs: 5, md: 7 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Typography variant="h3" fontWeight={800} color="common.white" gutterBottom>
            Blog da Codaqui
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, mb: 3 }}>
            Tutoriais técnicos, novidades institucionais e projetos da nossa comunidade
          </Typography>
          <Chip
            label="20 artigos publicados"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700 }}
          />
        </Container>
      </Box>

      {/* Category filter chips */}
      <Box
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: 1.5,
          bgcolor: 'background.paper',
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center">
            {CATEGORIES.map((cat) => (
              <Chip
                key={cat.label}
                label={cat.label}
                component="a"
                href={cat.href}
                clickable
                size="small"
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  '&:hover': {
                    bgcolor: 'primary.main',
                    color: 'common.white',
                    borderColor: 'primary.main',
                  },
                }}
              />
            ))}
          </Stack>
        </Container>
      </Box>

      <BlogListPage {...props} />

      {/* Community CTA */}
      <Box
        sx={{
          borderTop: '1px solid',
          borderColor: 'divider',
          py: { xs: 6, md: 8 },
          textAlign: 'center',
          bgcolor: 'background.paper',
        }}
      >
        <Container maxWidth="sm">
          <Typography variant="h5" fontWeight={700} gutterBottom>
            ✍️ Quer escrever para o blog?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Compartilhe seu conhecimento com a comunidade Codaqui. Abra uma discussão no GitHub ou
            fale com a gente no Discord.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
            <Button
              variant="contained"
              href="https://github.com/orgs/codaqui/discussions"
              target="_blank"
              startIcon={<GitHubIcon />}
            >
              GitHub Discussions
            </Button>
            <Button
              variant="outlined"
              href="https://discord.com/invite/xuTtxqCPpz"
              target="_blank"
            >
              💬 Discord
            </Button>
          </Stack>
        </Container>
      </Box>
    </>
  );
}
