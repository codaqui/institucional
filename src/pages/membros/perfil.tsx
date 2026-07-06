import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import Head from "@docusaurus/Head";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import {
  Avatar,
  Box,
  Button,
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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import FavoriteIcon from "@mui/icons-material/Favorite";
import BadgeIcon from "@mui/icons-material/Badge";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import VolunteerActivismIcon from "@mui/icons-material/VolunteerActivism";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BusinessIcon from "@mui/icons-material/Business";
import LockIcon from "@mui/icons-material/Lock";
import TokenIcon from "@mui/icons-material/Token";
import { QRCodeSVG } from "qrcode.react";
import TabPanel from "../../components/TabPanel";
import ClubWalletTransactionsTable from "../../components/ClubWalletTransactionsTable";
import { PLATFORM_COLORS } from "../../data/social";
import { useAuth } from "../../hooks/useAuth";

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

interface ClubWallet {
  id: string;
  balances: Record<string, number>;
  frozenTypes: string[];
}

interface WalletTransaction {
  id: string;
  coinType: string;
  amount: number;
  source: string;
  referenceId?: string | null;
  description: string | null;
  createdAt: string;
}

interface PublicAffiliation {
  id: string;
  name: string;
  cnpj: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  responsibleGithubHandle: string | null;
}
type BusinessMembershipType = "owner" | "collaborator";


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
  isClubMember,
  businessMembershipType,
  profileUrl,
}: Readonly<{
  member: Member;
  isDonor: boolean;
  isClubMember: boolean;
  businessMembershipType: BusinessMembershipType | null;
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
                  {isClubMember && (
                    <Chip
                      icon={<TokenIcon sx={{ fontSize: 14 }} />}
                      label="CLUB"
                      size="small"
                      color="primary"
                      variant="filled"
                    />
                  )}
                  {businessMembershipType && (
                    <Chip
                      icon={<BusinessIcon sx={{ fontSize: 14 }} />}
                      label={businessMembershipType === "collaborator" ? "Business Member" : "Business Club"}
                      size="small"
                      color="secondary"
                      variant="filled"
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

// ── SortCoins Section ─────────────────────────────────────────────────────

function SortCoinsSection({
  wallet,
  transactions,
}: Readonly<{
  wallet: ClubWallet;
  transactions: WalletTransaction[];
}>) {
  const sortCoins = wallet.balances?.sort_coin ?? 0;
  const isFrozen = wallet.frozenTypes?.includes("sort_coin") ?? false;

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <TokenIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>
          SortCoins
        </Typography>
        <Chip
          label={`${sortCoins.toLocaleString("pt-BR")} coins`}
          size="small"
          color="primary"
          variant="outlined"
        />
        {isFrozen && (
          <Chip
            icon={<LockIcon sx={{ fontSize: 14 }} />}
            label="Congelado"
            size="small"
            color="error"
            variant="outlined"
          />
        )}
      </Box>

      {transactions.length > 0 ? (
        <ClubWalletTransactionsTable transactions={transactions} />
      ) : (
        <Typography variant="body2" color="text.secondary">
          Nenhuma transação de SortCoins ainda.{" "}
          <Link href="/participe/apoiar" underline="hover">
            Faça uma doação
          </Link>{" "}
          para começar a acumular!
        </Typography>
      )}
    </Box>
  );
}

// ── Donation History ───────────────────────────────────────────────────────

function donationTypeChip(type: string) {
  if (type.includes("Empresa")) {
    return <Chip label={type} size="small" color="success" icon={<BusinessIcon fontSize="small" />} />;
  }
  if (type.includes("mensal") || type.includes("anual")) {
    return <Chip label={type} size="small" color="info" variant="outlined" />;
  }
  return <Chip label={type} size="small" variant="outlined" />;
}

function DonationTable({ rows }: Readonly<{ rows: Donation[] }>) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Data</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Comunidade</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Tipo</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>Valor</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((d) => (
            <TableRow key={d.id}>
              <TableCell>{formatDate(d.createdAt)}</TableCell>
              <TableCell>{d.community}</TableCell>
              <TableCell>{donationTypeChip(d.type)}</TableCell>
              <TableCell align="right" sx={{ fontWeight: 600 }}>
                {formatCurrency(d.amount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DonationHistory({ donations }: Readonly<{ donations: Donation[] }>) {
  if (donations.length === 0) return null;

  const pfDonations = donations.filter((d) => !d.type.includes("Empresa"));
  const pjDonations = donations.filter((d) => d.type.includes("Empresa"));
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

      {pfDonations.length > 0 && (
        <Box sx={{ mb: pjDonations.length > 0 ? 3 : 0 }}>
          {pjDonations.length > 0 && (
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Pessoa Física
            </Typography>
          )}
          <DonationTable rows={pfDonations} />
        </Box>
      )}

      {pjDonations.length > 0 && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <BusinessIcon fontSize="small" color="action" />
            <Typography variant="subtitle2" fontWeight={700}>
              Pessoa Jurídica (CLUB Business)
            </Typography>
          </Box>
          <DonationTable rows={pjDonations} />
        </Box>
      )}
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

  const { user: loggedUser, isLoggedIn, authFetch } = useAuth();

  const [member, setMember] = useState<Member | null>(null);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clubWallet, setClubWallet] = useState<ClubWallet | null>(null);
  const [walletTxs, setWalletTxs] = useState<WalletTransaction[]>([]);
  const [publicWallet, setPublicWallet] = useState<ClubWallet | null>(null);
  const [publicWalletTxs, setPublicWalletTxs] = useState<WalletTransaction[]>([]);
  const [affiliatedCompany, setAffiliatedCompany] = useState<PublicAffiliation | null>(null);
  const [businessMembershipType, setBusinessMembershipType] = useState<BusinessMembershipType | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Suporta ?id=<uuid> ou ?handle=<github_handle>
  const isBrowser = globalThis.window !== undefined;
  const params = isBrowser
    ? new URLSearchParams(globalThis.location.search)
    : null;
  const memberId = params?.get("id") ?? null;
  const memberHandle = params?.get("handle") ?? null;

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

  // Load SortCoins wallet only when viewing own profile (requires login)
  useEffect(() => {
    if (!isLoggedIn || !member) return;
    if (loggedUser?.handle !== member.githubHandle) return;
    authFetch("/club/wallet")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ClubWallet | null) => setClubWallet(data));
    authFetch("/club/wallet/transactions?limit=10")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: WalletTransaction[]) => setWalletTxs(data ?? []));
  }, [isLoggedIn, member, loggedUser, authFetch]);

  useEffect(() => {
    if (!member) return;
    if (isLoggedIn && loggedUser?.handle === member.githubHandle) {
      setPublicWallet(null);
      setPublicWalletTxs([]);
      return;
    }
    fetch(`${apiUrl}/club/public-wallet/${member.githubHandle}?limit=10`)
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: { wallet: ClubWallet | null; transactions: WalletTransaction[] } | null) => {
        setPublicWallet(payload?.wallet ?? null);
        setPublicWalletTxs(payload?.transactions ?? []);
      })
      .catch(() => {
        setPublicWallet(null);
        setPublicWalletTxs([]);
      });
  }, [apiUrl, member, isLoggedIn, loggedUser]);

  useEffect(() => {
    if (!member) return;
    fetch(`${apiUrl}/stripe/business-members`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((payload: { items?: Array<{ memberId: string; membershipType?: BusinessMembershipType }> }) => {
        const found = (payload.items ?? []).find((item) => item.memberId === member.id);
        setBusinessMembershipType(found?.membershipType ?? (found ? "owner" : null));
      })
      .catch(() => setBusinessMembershipType(null));
  }, [apiUrl, member]);

  useEffect(() => {
    if (!member) return;
    fetch(`${apiUrl}/companies/member/${member.githubHandle}/public-affiliation`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: PublicAffiliation | null) => setAffiliatedCompany(data))
      .catch(() => setAffiliatedCompany(null));
  }, [apiUrl, member]);

  const isDonor = donations.length > 0;
  const isClubMember = donations.some(
    (d) => d.type.includes("mensal") || d.type.includes("anual"),
  );

  // URL canônica (HTTP 200, usada para SEO e QR code)
  const canonicalHandle = member?.githubHandle ?? memberHandle ?? "";
  const canonicalUrl = isBrowser && canonicalHandle
    ? `${globalThis.location.origin}/membros/perfil?handle=${canonicalHandle}`
    : "";

  // QR code usa URL canônica (não /@handle que retorna HTTP 404 no GitHub Pages)
  const vanityUrl = canonicalUrl;

  const seoTitle = member
    ? `${member.name} (@${member.githubHandle}) — Membro Codaqui`
    : "Perfil de Membro — Codaqui";
  const seoDonorSuffix = isDonor ? " Apoiador(a) da comunidade." : "";
  const seoDescription = member
    ? `Perfil público de ${member.name} na Associação Codaqui. Membro desde ${formatDate(member.joinedAt)}.${seoDonorSuffix}`
    : "Perfil de membro da Associação Codaqui.";

  return (
    <Layout title={seoTitle} description={seoDescription}>
      {/* Dynamic SEO tags — updated once member data loads */}
      {member && (
        <Head>
          <title>{seoTitle}</title>
          <meta name="description" content={seoDescription} />
          {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
          <meta property="og:title" content={seoTitle} />
          <meta property="og:description" content={seoDescription} />
          <meta property="og:image" content={member.avatarUrl} />
          {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
          <meta property="og:type" content="profile" />
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content={seoTitle} />
          <meta name="twitter:description" content={seoDescription} />
          <meta name="twitter:image" content={member.avatarUrl} />
        </Head>
      )}
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
              isClubMember={isClubMember}
              businessMembershipType={businessMembershipType}
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

            <Divider sx={{ my: 3 }} />

            {/* ── Tabs ── */}
            {(() => {
              const isOwner = loggedUser?.handle === member.githubHandle;
              const showWalletTab = isOwner || !!publicWallet;
              return (
                <>
                  <Tabs
                    value={activeTab}
                    onChange={(_, v) => setActiveTab(v)}
                    variant="scrollable"
                    allowScrollButtonsMobile
                    sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
                  >
                    <Tab label="Visão Geral" />
                    <Tab label="Histórico de Doações" />
                    {showWalletTab && (
                      <Tab label={isOwner ? "Carteira" : "Carteira pública"} />
                    )}
                  </Tabs>

                  <TabPanel value={activeTab} index={0}>
                    <Box>
                      {affiliatedCompany && (
                        <Card variant="outlined" sx={{ mb: 2 }}>
                          <CardContent sx={{ py: "12px !important" }}>
                            <Typography variant="overline" color="text.secondary" display="block">
                              CLUB Business
                            </Typography>
                            <Typography variant="body1" fontWeight={700}>
                              {affiliatedCompany.name}
                            </Typography>
                            {affiliatedCompany.responsibleGithubHandle && (
                              <Typography variant="caption" color="text.secondary">
                                Responsável: @{affiliatedCompany.responsibleGithubHandle}
                              </Typography>
                            )}
                          </CardContent>
                        </Card>
                      )}
                      {isDonor ? (
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Card variant="outlined">
                              <CardContent sx={{ py: "12px !important" }}>
                                <Typography variant="overline" color="text.secondary" display="block">
                                  Total doado
                                </Typography>
                                <Typography variant="h5" fontWeight={800} color="success.main">
                                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                                    donations.reduce((s, d) => s + d.amount, 0)
                                  )}
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Card variant="outlined">
                              <CardContent sx={{ py: "12px !important" }}>
                                <Typography variant="overline" color="text.secondary" display="block">
                                  Apoios registrados
                                </Typography>
                                <Typography variant="h5" fontWeight={800}>
                                  {donations.length}
                                </Typography>
                              </CardContent>
                            </Card>
                          </Grid>
                        </Grid>
                      ) : (
                        <Box sx={{ textAlign: "center", py: 4 }}>
                          <FavoriteIcon sx={{ fontSize: 48, color: "action.disabled", mb: 1 }} />
                          <Typography variant="body1" color="text.secondary" gutterBottom>
                            Este membro ainda não fez doações públicas.
                          </Typography>
                          <Button variant="contained" size="small" href="/participe/apoiar" sx={{ mt: 1 }}>
                            Apoie a Codaqui
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </TabPanel>

                  <TabPanel value={activeTab} index={1}>
                    <Box>
                      {isDonor ? (
                        <DonationHistory donations={donations} />
                      ) : (
                        <Box sx={{ textAlign: "center", py: 4 }}>
                          <Typography variant="body2" color="text.secondary">
                            Este membro ainda não fez doações públicas.
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </TabPanel>

                  {showWalletTab && (
                    <TabPanel value={activeTab} index={2}>
                    <Box>
                      {isOwner && clubWallet && (
                        <SortCoinsSection wallet={clubWallet} transactions={walletTxs} />
                      )}
                      {!isOwner && publicWallet && (
                        <SortCoinsSection wallet={publicWallet} transactions={publicWalletTxs} />
                      )}
                      {affiliatedCompany && (
                        <>
                          <Divider sx={{ my: 3 }} />
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                            <BusinessIcon sx={{ color: "secondary.main" }} />
                            <Typography variant="h6" fontWeight={700}>
                              {businessMembershipType === "collaborator" ? "Vinculo Business Member" : "Vinculo CLUB Business"}
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {member.name} participa da empresa <strong>{affiliatedCompany.name}</strong>
                            {affiliatedCompany.responsibleGithubHandle && (
                              <> (responsavel: @{affiliatedCompany.responsibleGithubHandle})</>
                            )}.
                          </Typography>
                        </>
                      )}
                      {isOwner && (
                        <>
                          <Divider sx={{ my: 3 }} />
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                            <BusinessIcon sx={{ color: "success.main" }} />
                            <Typography variant="h6" fontWeight={700}>Minha Empresa</Typography>
                          </Box>
                          <Button
                            variant="outlined"
                            color="success"
                            size="small"
                            startIcon={<BusinessIcon />}
                            href="/membros/empresa"
                            sx={{ textTransform: "none", fontWeight: 600 }}
                          >
                            Gerenciar empresa e carteira CLUB Business
                          </Button>
                        </>
                      )}
                    </Box>
                    </TabPanel>
                  )}
                </>
              );
            })()}
          </>
        )}
      </Container>
    </Layout>
  );
}
