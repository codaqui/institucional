import React, { useEffect, useState, useMemo } from "react";
import Layout from "@theme/Layout";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Grid,
  Link,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import FavoriteIcon from "@mui/icons-material/Favorite";
import PeopleIcon from "@mui/icons-material/People";
import PageHero from "../../components/PageHero";

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

interface DonorInfo {
  totalDonated: number;
  donationCount: number;
  lastDonatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

type FilterValue = "todos" | "doadores" | "organizacao";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    month: "short",
    year: "numeric",
  });
}

// ── Componentes ────────────────────────────────────────────────────────────

function MemberCard({
  member,
  donorInfo,
}: {
  member: Member;
  donorInfo?: DonorInfo;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        "&:hover": {
          boxShadow: 3,
          transform: "translateY(-2px)",
          transition: "all 0.2s ease",
        },
      }}
    >
      <CardActionArea
        href={`/@${member.githubHandle}`}
        sx={{ height: "100%", display: "flex", alignItems: "flex-start" }}
      >
        <CardContent sx={{ display: "flex", gap: 2, width: "100%" }}>
          <Avatar
            src={member.avatarUrl}
            alt={member.name}
            sx={{ width: 56, height: 56, flexShrink: 0 }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
                mb: 0.5,
              }}
            >
              <Typography variant="subtitle1" fontWeight={700} noWrap>
                {member.name}
              </Typography>
              {member.role === "admin" && (
                <Chip
                  label="Organização"
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
              {donorInfo && (
                <Chip
                  icon={<FavoriteIcon sx={{ fontSize: 14 }} />}
                  label="Doador(a)"
                  size="small"
                  color="success"
                  variant="outlined"
                />
              )}
            </Box>

            <Typography variant="body2" color="text.secondary">
              @{member.githubHandle}
            </Typography>

            {donorInfo && (
              <Typography
                variant="body2"
                color="success.main"
                fontWeight={600}
                sx={{ mt: 0.5 }}
              >
                {formatCurrency(donorInfo.totalDonated)} em{" "}
                {donorInfo.donationCount} doação(ões) 💚
              </Typography>
            )}

            {member.bio && (
              <>
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{ display: "block", mt: 0.5 }}
                >
                  Autodescrição
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    fontStyle: "italic",
                  }}
                >
                  &ldquo;{member.bio}&rdquo;
                </Typography>
              </>
            )}

            <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: "block" }}>
              Membro desde {formatDate(member.joinedAt)}
            </Typography>

            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
              <Tooltip title={`GitHub: ${member.githubHandle}`}>
                <Link
                  href={`https://github.com/${member.githubHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  color="inherit"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GitHubIcon sx={{ fontSize: "1.1rem", opacity: 0.7 }} />
                </Link>
              </Tooltip>
              {member.linkedinUrl && (
                <Tooltip title="LinkedIn">
                  <Link
                    href={member.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    color="inherit"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LinkedInIcon
                      sx={{ fontSize: "1.1rem", opacity: 0.7, color: "#0077b5" }}
                    />
                  </Link>
                </Tooltip>
              )}
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function MembersSkeleton() {
  return (
    <Grid container spacing={2}>
      {Array.from({ length: 6 }, (_, i) => (
        <Grid key={`sk-${i}`} size={{ xs: 12, sm: 6, md: 4 }}>
          <Card variant="outlined">
            <CardContent sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              <Skeleton variant="circular" width={56} height={56} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="60%" />
                <Skeleton width="40%" />
                <Skeleton width="30%" />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

// ── Página principal ───────────────────────────────────────────────────────

export default function MembrosPage(): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const apiUrl =
    (siteConfig.customFields?.apiUrl as string) ?? "http://api.localhost:8000";

  const [members, setMembers] = useState<Member[]>([]);
  const [donorMap, setDonorMap] = useState<Map<string, DonorInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<FilterValue>("todos");

  useEffect(() => {
    Promise.all([
      fetch(`${apiUrl}/members?limit=100`).then((r) => r.json()),
      fetch(`${apiUrl}/members/donors?limit=100`).then((r) => r.json()),
    ])
      .then(
        ([membersRes, donorsRes]: [
          PaginatedResponse<Member>,
          PaginatedResponse<Member & DonorInfo>,
        ]) => {
          setMembers(membersRes.data ?? []);

          const map = new Map<string, DonorInfo>();
          for (const d of donorsRes.data ?? []) {
            map.set(d.id, {
              totalDonated: d.totalDonated,
              donationCount: d.donationCount,
              lastDonatedAt: d.lastDonatedAt,
            });
          }
          setDonorMap(map);
          setLoading(false);
        },
      )
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [apiUrl]);

  const filtered = useMemo(() => {
    let list = [...members];

    if (filter === "doadores") {
      list = list.filter((m) => donorMap.has(m.id));
    } else if (filter === "organizacao") {
      list = list.filter((m) => m.role === "admin");
    }

    // Doadores primeiro (por total doado DESC), depois membros por joinedAt ASC
    list.sort((a, b) => {
      const aDonor = donorMap.get(a.id);
      const bDonor = donorMap.get(b.id);
      if (aDonor && !bDonor) return -1;
      if (!aDonor && bDonor) return 1;
      if (aDonor && bDonor) return bDonor.totalDonated - aDonor.totalDonated;
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });

    return list;
  }, [members, donorMap, filter]);

  const donorCount = donorMap.size;
  const totalMembers = members.length;

  return (
    <Layout
      title="Membros"
      description="Conheça as pessoas que fazem parte da Codaqui — participantes, doadores e organizadores."
    >
      <PageHero
        eyebrow="Comunidade"
        title="Membros da Codaqui"
        subtitle="Conheça as pessoas que constroem, apoiam e fazem a Codaqui acontecer."
      />

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Stats bar */}
        <Stack
          direction="row"
          spacing={3}
          sx={{ mb: 4, flexWrap: "wrap" }}
          alignItems="center"
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <PeopleIcon color="primary" />
            <Typography variant="body1" fontWeight={600}>
              {totalMembers} membros
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <FavoriteIcon color="success" />
            <Typography variant="body1" fontWeight={600}>
              {donorCount} doadores
            </Typography>
          </Box>
        </Stack>

        {/* Filtros */}
        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_, val) => val && setFilter(val as FilterValue)}
          size="small"
          sx={{ mb: 4 }}
        >
          <ToggleButton value="todos">Todos ({totalMembers})</ToggleButton>
          <ToggleButton value="doadores">Doadores ({donorCount})</ToggleButton>
          <ToggleButton value="organizacao">
            Organização ({members.filter((m) => m.role === "admin").length})
          </ToggleButton>
        </ToggleButtonGroup>

        {loading && <MembersSkeleton />}

        {error && (
          <Typography variant="body2" color="text.secondary">
            Não foi possível carregar os membros no momento.
          </Typography>
        )}

        {!loading && !error && filtered.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Nenhum membro encontrado para este filtro.
          </Typography>
        )}

        {!loading && !error && filtered.length > 0 && (
          <Grid container spacing={2}>
            {filtered.map((m) => (
              <Grid key={m.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <MemberCard member={m} donorInfo={donorMap.get(m.id)} />
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </Layout>
  );
}
