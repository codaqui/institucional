import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Link,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import FavoriteIcon from "@mui/icons-material/Favorite";
import BadgeIcon from "@mui/icons-material/Badge";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { QRCodeSVG } from "qrcode.react";
import { PLATFORM_COLORS } from "../../data/social";

// ── Tipos ──────────────────────────────────────────────────────────────────

interface Member {
  id: string;
  githubHandle: string;
  name: string;
  avatarUrl: string;
  bio: string | null;
  linkedinUrl: string | null;
  role: "membro" | "admin" | "finance-analyzer";
  joinedAt: string;
}

interface Donation {
  id: string;
  amount: number;
  community: string;
  communityKey: string;
  type: string;
  createdAt: string;
}

interface DonorSummary {
  totalDonated: number;
  donationCount: number;
  lastDonatedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatShortId(uuid: string): string {
  return uuid.slice(0, 8).toUpperCase();
}

function getRoleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Organização";
    case "finance-analyzer":
      return "Analista Financeiro";
    default:
      return "Membro";
  }
}

// ── Carteirinha ────────────────────────────────────────────────────────────

function Carteirinha({
  member,
  isDonor,
  profileUrl,
}: Readonly<{
  member: Member;
  isDonor: boolean;
  profileUrl: string;
}>) {
  return (
    <Card
      sx={{
        background: (theme) =>
          theme.palette.mode === "dark"
            ? `linear-gradient(135deg, ${theme.palette.primary.dark}33 0%, ${theme.palette.background.paper} 50%, ${theme.palette.secondary.dark}33 100%)`
            : `linear-gradient(135deg, ${theme.palette.primary.light}33 0%, ${theme.palette.background.default} 50%, ${theme.palette.secondary.light}33 100%)`,
        border: "2px solid",
        borderColor: "primary.main",
        borderRadius: 3,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          bgcolor: "primary.main",
          color: "primary.contrastText",
          px: 3,
          py: 1.5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="subtitle2" fontWeight={800} letterSpacing={1}>
          ASSOCIAÇÃO CODAQUI
        </Typography>
        <Typography variant="caption" fontWeight={600}>
          CARTEIRINHA DE MEMBRO
        </Typography>
      </Box>

      <CardContent sx={{ p: 3 }}>
        <Grid container spacing={3} alignItems="center">
          {/* Avatar + Info */}
          <Grid size={{ xs: 12, sm: 8 }}>
            <Box sx={{ display: "flex", gap: 2.5, alignItems: "center" }}>
              <Avatar
                src={member.avatarUrl}
                alt={member.name}
                sx={{
                  width: 96,
                  height: 96,
                  border: "3px solid",
                  borderColor: "primary.main",
                }}
              />
              <Box>
                <Typography variant="h5" fontWeight={800}>
                  {member.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  @{member.githubHandle}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip
                    icon={<BadgeIcon sx={{ fontSize: 16 }} />}
                    label={getRoleLabel(member.role)}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  {isDonor && (
                    <Chip
                      icon={<FavoriteIcon sx={{ fontSize: 14 }} />}
                      label="Doador(a)"
                      size="small"
                      color="success"
                      variant="outlined"
                    />
                  )}
                </Stack>
              </Box>
            </Box>

            <Box sx={{ mt: 2 }}>
              <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <CalendarMonthIcon
                    sx={{ fontSize: 16, color: "text.secondary" }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    Membro desde {formatDate(member.joinedAt)}
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    fontFamily="monospace"
                  >
                    ID: {formatShortId(member.id)}
                  </Typography>
                </Box>
              </Stack>
            </Box>
          </Grid>

          {/* QR Code */}
          <Grid
            size={{ xs: 12, sm: 4 }}
            sx={{ display: "flex", justifyContent: "center" }}
          >
            <Box sx={{ textAlign: "center" }}>
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  bgcolor: "white",
                  borderRadius: 2,
                  display: "inline-block",
                }}
              >
                <QRCodeSVG
                  value={profileUrl}
                  size={120}
                  level="M"
                  includeMargin={false}
                  fgColor="#57B593"
                />
              </Paper>
              <Typography
                variant="caption"
                color="text.secondary"
                display="block"
                sx={{ mt: 0.5 }}
              >
                Escaneie para ver o perfil
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {/* Bio */}
        {member.bio && (
          <Box sx={{ mt: 2 }}>
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ display: "block", mb: 0.5 }}
            >
              Autodescrição do membro
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontStyle: "italic" }}
            >
              &ldquo;{member.bio}&rdquo;
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ── Donation History ───────────────────────────────────────────────────────

function DonationHistory({ donations }: Readonly<{ donations: Donation[] }>) {
  if (donations.length === 0) return null;

  const total = donations.reduce((sum, d) => sum + d.amount, 0);

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <VolunteerActivismIcon color="success" />
        <Typography variant="h6" fontWeight={700}>
          Histórico de Doações
        </Typography>
        <Chip
          label={`${donations.length} doação(ões) — ${formatCurrency(total)}`}
          size="small"
          color="success"
          variant="outlined"
        />
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Data</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Comunidade</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Valor
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {donations.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{formatDate(d.createdAt)}</TableCell>
                <TableCell>{d.community}</TableCell>
                <TableCell>
                  <Chip label={d.type} size="small" variant="outlined" />
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {formatCurrency(d.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ── Profile Skeleton ───────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Skeleton variant="rounded" height={280} sx={{ borderRadius: 3 }} />
      <Box sx={{ mt: 4 }}>
        <Skeleton width="40%" height={32} />
        <Skeleton variant="rounded" height={200} sx={{ mt: 2 }} />
      </Box>
    </Container>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function PerfilPage(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const apiUrl =
    (siteConfig.customFields?.apiUrl as string) ?? "http://api.localhost:8000";

  const [member, setMember] = useState<Member | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Suporta ?id=<uuid> ou ?handle=<github_handle>
  const isBrowser = globalThis.window !== undefined;
  const params = isBrowser
    ? new URLSearchParams(globalThis.location.search)
    : null;
  const memberId = params?.get("id") ?? null;
  const memberHandle = params?.get("handle") ?? null;

  // URL bonita para QR code: /@handle
  const vanityUrl =
    isBrowser && member
      ? `${globalThis.location.origin}/@${member.githubHandle}`
      : "";

  useEffect(() => {
    if (!memberId && !memberHandle) {
      setError("ID ou handle do membro não informado.");
      setLoading(false);
      return;
    }

    // Valida formato do handle para evitar path traversal
    if (memberHandle && !/^[a-zA-Z0-9_-]+$/.test(memberHandle)) {
      setError("Handle inválido.");
      setLoading(false);
      return;
    }

    // Resolve o membro: por ID ou por handle
    const memberFetch = memberId
      ? fetch(`${apiUrl}/members/${memberId}`)
      : fetch(`${apiUrl}/members/by-handle/${memberHandle}`);

    memberFetch
      .then((r) => {
        if (!r.ok) throw new Error("not_found");
        return r.json();
      })
      .then((memberData: Member) => {
        setMember(memberData);
        // Agora busca doações pelo ID resolvido
        return fetch(`${apiUrl}/members/${memberData.id}/donations`)
          .then((r) => (r.ok ? r.json() : []))
          .then((donationsData) => {
            setDonations(donationsData ?? []);
            setLoading(false);
          });
      })
      .catch((err) => {
        setError(
          err.message === "not_found"
            ? "Membro não encontrado."
            : "Erro ao carregar o perfil.",
        );
        setLoading(false);
      });
  }, [memberId, memberHandle, apiUrl]);

  const isDonor = donations.length > 0;

  return (
    <Layout
      title={member ? `${member.name} — Membro` : "Perfil de Membro"}
      description={
        member
          ? `Perfil público de ${member.name} na Associação Codaqui.`
          : "Perfil de membro da Associação Codaqui."
      }
    >
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Back link */}
        <Link
          href="/membros"
          underline="hover"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            mb: 3,
            color: "text.secondary",
            "&:hover": { color: "primary.main" },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2">Voltar para membros</Typography>
        </Link>

        {loading && <ProfileSkeleton />}

        {error && (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {error}
            </Typography>
            <Link href="/membros" underline="hover">
              ← Ver todos os membros
            </Link>
          </Box>
        )}

        {!loading && !error && member && (
          <>
            {/* Carteirinha */}
            <Carteirinha
              member={member}
              isDonor={isDonor}
              profileUrl={vanityUrl}
            />

            {/* Social links */}
            <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
              <Link
                href={`https://github.com/${member.githubHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  color: "text.secondary",
                }}
              >
                <GitHubIcon sx={{ fontSize: 20 }} />
                <Typography variant="body2">
                  @{member.githubHandle}
                </Typography>
              </Link>
              {member.linkedinUrl && (
                <Link
                  href={member.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  underline="hover"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    color: PLATFORM_COLORS.linkedin,
                  }}
                >
                  <LinkedInIcon sx={{ fontSize: 20 }} />
                  <Typography variant="body2">LinkedIn</Typography>
                </Link>
              )}
            </Stack>

            <Divider sx={{ my: 4 }} />

            {/* Donation history */}
            {isDonor && <DonationHistory donations={donations} />}

            {!isDonor && (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  Este membro ainda não fez doações públicas.
                </Typography>
              </Box>
            )}
          </>
        )}
      </Container>
    </Layout>
  );
}
