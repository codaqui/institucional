import React from 'react';
import Layout from '@theme/Layout';
import {
  Avatar,
  Box,
  Card,
  Chip,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import { DISCORD_URL, WHATSAPP_URL } from '../data/social';

interface LinkItem {
  label: string;
  href: string;
  external?: boolean;
}

const links: LinkItem[] = [
  { label: '📅 Cronograma 2026', href: '/participe/estudar' },
  { label: '📚 Trilhas de Aprendizado', href: '/trilhas/', external: true },
  { label: '💬 Discord', href: DISCORD_URL, external: true },
  { label: '📱 WhatsApp', href: WHATSAPP_URL, external: true },
  { label: '📝 Blog', href: '/blog/', external: true },
  { label: '🐦 Twitter / X', href: 'https://twitter.com/codaquidev', external: true },
  { label: '📸 Instagram', href: 'https://www.instagram.com/codaqui.dev/', external: true },
  { label: '💼 LinkedIn', href: 'https://www.linkedin.com/company/codaqui/', external: true },
  { label: '🐙 GitHub', href: 'https://github.com/codaqui', external: true },
];

export default function BioPage(): React.JSX.Element {
  return (
    <Layout
      title="Links | Codaqui"
      description="Encontre todos os links da Codaqui em um só lugar"
    >
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <Avatar
          src="/img/logo.png"
          sx={{
            width: 80,
            height: 80,
            mx: 'auto',
            mb: 2,
            bgcolor: 'background.paper',
            border: 2,
            borderColor: 'divider',
          }}
        />
        <Typography variant="h4" fontWeight={800}>
          Codaqui
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Associação sem fins lucrativos democratizando o acesso à tecnologia
        </Typography>
        <Chip label="2026" variant="outlined" sx={{ mb: 4 }} />

        <Stack spacing={2}>
          {links.map((link) => (
            <Card
              key={link.href}
              component="a"
              href={link.href}
              {...(link.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
              sx={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 2,
                border: 1,
                borderColor: 'divider',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  transform: 'translateY(-2px)',
                  boxShadow: 3,
                },
              }}
            >
              <Box sx={{ fontSize: '1.5rem', minWidth: 40 }}>
                {link.label.split(' ')[0]}
              </Box>
              <Typography variant="body1" fontWeight={600}>
                {link.label.split(' ').slice(1).join(' ')}
              </Typography>
            </Card>
          ))}
        </Stack>
      </Container>
    </Layout>
  );
}
