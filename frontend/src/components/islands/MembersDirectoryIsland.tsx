// Port da listagem dinâmica de src/pages/membros/index.tsx (Docusaurus) para
// ilha React: members + donors + club/business members, busca e filtros.
// Shell estático (PageHero) fica em pages/membros/index.astro.
// apiUrl sai do useDocusaurusContext e vem de lib/api-url (resolveApiUrl).
import React, { useEffect, useMemo, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import FavoriteIcon from "@mui/icons-material/Favorite";
import TokenIcon from "@mui/icons-material/Token";
import BusinessIcon from "@mui/icons-material/Business";
import PeopleIcon from "@mui/icons-material/People";
import MuiIslandProvider from "./MuiIslandProvider";
import PaginationControls from "./ui/PaginationControls";
import { resolveApiUrl } from "../../lib/api-url";
import { PLATFORM_COLORS } from "../../data/social";
import {
  MEMBERS_PAGE_SIZE,
  rangeLabel,
  type PaginatedResponse,
} from "../../lib/pagination";

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

type FilterValue = "todos" | "club" | "club-business";
type BusinessMembershipType = "owner" | "collaborator";

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
  isClubMember,
  clubBusinessType,
}: Readonly<{
  member: Member;
  donorInfo?: DonorInfo;
  isClubMember?: boolean;
  clubBusinessType?: BusinessMembershipType;
}>) {
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
              <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
                {member.name}
              </Typography>
              {donorInfo && (
                <Chip
                  icon={<FavoriteIcon sx={{ fontSize: 14 }} />}
                  label="Doador(a)"
                  size="small"
                  color="default"
                  variant="outlined"
                />
              )}
              {isClubMember && (
                <Chip
                  icon={<TokenIcon sx={{ fontSize: 14 }} />}
                  label="CLUB"
                  size="small"
                  color="success"
                  variant="outlined"
                />
              )}
              {clubBusinessType && (
                <Chip
                  icon={<BusinessIcon sx={{ fontSize: 14 }} />}
                  label={clubBusinessType === "collaborator" ? "Business Member" : "CLUB Business"}
                  size="small"
                  color={clubBusinessType === "collaborator" ? "secondary" : "primary"}
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
                sx={{ mt: 0.5, fontWeight: 600 }}
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
                      sx={{ fontSize: "1.1rem", opacity: 0.7, color: PLATFORM_COLORS.linkedin }}
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

// ── Ilha principal ─────────────────────────────────────────────────────────

function MembersDirectoryInner(): React.JSX.Element {
  const apiUrl = resolveApiUrl(import.meta.env.SITE);

  const [membersRes, setMembersRes] = useState<PaginatedResponse<Member>>({
    data: [],
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const [donorMap, setDonorMap] = useState<Map<string, DonorInfo>>(new Map());
  const [clubMemberIds, setClubMemberIds] = useState<Set<string>>(new Set());
  const [clubBusinessRoleByMemberId, setClubBusinessRoleByMemberId] = useState<Map<string, BusinessMembershipType>>(new Map());
  const [clubBusinessMemberIds, setClubBusinessMemberIds] = useState<Set<string>>(new Set());
  const [membersLoading, setMembersLoading] = useState(true);
  const [auxLoading, setAuxLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pageError, setPageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterValue>("todos");
  const [searchTerm, setSearchTerm] = useState("");

  // Membros: fetch paginado por página (total vem do COUNT do envelope —
  // membros além do 100º ficam visíveis navegando entre páginas).
  useEffect(() => {
    let cancelled = false;
    setMembersLoading(true);
    setPageError(false);
    fetch(`${apiUrl}/members?page=${page}&limit=${MEMBERS_PAGE_SIZE}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((res: PaginatedResponse<Member>) => {
        if (!cancelled) setMembersRes(res);
      })
      .catch(() => {
        if (!cancelled) setPageError(true);
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiUrl, page, retryCount]);

  // Auxiliares (donors/club/business): fetch único — enriquecem os cards.
  useEffect(() => {
    let cancelled = false;
    setAuxLoading(true);
    Promise.all([
      fetch(`${apiUrl}/members/donors?limit=${MEMBERS_PAGE_SIZE}`).then((r) => r.json()),
      fetch(`${apiUrl}/stripe/club-members`).then((r) => r.json()),
      fetch(`${apiUrl}/stripe/business-members`).then((r) => r.json()),
    ])
      .then(
        ([
          donorsRes,
          clubRes,
          clubBusinessRes,
        ]: [
          PaginatedResponse<Member & DonorInfo>,
          { items?: Array<{ memberId: string }> },
          { items?: Array<{ memberId: string; membershipType?: BusinessMembershipType }> },
        ]) => {
          if (cancelled) return;
          const map = new Map<string, DonorInfo>();
          for (const d of donorsRes.data ?? []) {
            map.set(d.id, {
              totalDonated: d.totalDonated,
              donationCount: d.donationCount,
              lastDonatedAt: d.lastDonatedAt,
            });
          }
          setDonorMap(map);
          setClubMemberIds(
            new Set((clubRes.items ?? []).map((item) => item.memberId).filter(Boolean)),
          );
          const businessItems = (clubBusinessRes.items ?? []).filter((item) => !!item.memberId);
          setClubBusinessMemberIds(new Set(businessItems.map((item) => item.memberId)));
          setClubBusinessRoleByMemberId(new Map(
            businessItems.map((item) => [item.memberId, item.membershipType ?? "owner"]),
          ));
        },
      )
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setAuxLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const members = membersRes.data;
  const totalMembers = membersRes.total;
  const totalPages = Math.max(1, membersRes.totalPages);
  const loading = membersLoading || auxLoading;

  const filtered = useMemo(() => {
    let list = [...members];

    if (filter === "club") {
      list = list.filter((m) => clubMemberIds.has(m.id));
    } else if (filter === "club-business") {
      list = list.filter((m) => clubBusinessMemberIds.has(m.id));
    }

    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (normalizedSearch) {
      list = list.filter((member) => {
        return (
          member.name.toLowerCase().includes(normalizedSearch) ||
          member.githubHandle.toLowerCase().includes(normalizedSearch) ||
          (member.bio ?? "").toLowerCase().includes(normalizedSearch)
        );
      });
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
  }, [members, donorMap, filter, searchTerm, clubBusinessMemberIds, clubMemberIds]);

  const clubCount = clubMemberIds.size;
  const clubBusinessCount = members.filter((member) => clubBusinessMemberIds.has(member.id)).length;

  return (
    <>
      {/* Stats bar */}
      <Stack
        direction="row"
        spacing={3}
        sx={{ mb: 4, flexWrap: "wrap", alignItems: "center" }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PeopleIcon color="primary" />
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {totalMembers} membros
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <FavoriteIcon color="success" />
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {clubCount} CLUB
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {clubBusinessCount} CLUB Business
          </Typography>
        </Box>
      </Stack>

      {/* Filtros */}
      <TextField
        size="small"
        fullWidth
        placeholder="Buscar por nome, @github ou bio"
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        sx={{ mb: 2 }}
      />
      {searchTerm.trim() && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: -1, mb: 2 }}
        >
          Busca aplicada à página atual — limpe a busca para navegar entre todas
          as páginas.
        </Typography>
      )}
      <ToggleButtonGroup
        value={filter}
        exclusive
        onChange={(_, val) => val && setFilter(val as FilterValue)}
        size="small"
        sx={{ mb: 4 }}
      >
        <ToggleButton value="todos">Todos ({totalMembers})</ToggleButton>
        <ToggleButton value="club">CLUB ({clubCount})</ToggleButton>
        <ToggleButton value="club-business">CLUB Business ({clubBusinessCount})</ToggleButton>
      </ToggleButtonGroup>

      {loading && <MembersSkeleton />}

      {error && (
        <Typography variant="body2" color="text.secondary">
          Não foi possível carregar os membros no momento.
        </Typography>
      )}

      {!loading && pageError && !error && (
        <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
          <Typography variant="body2" color="text.secondary">
            Não foi possível carregar esta página.
          </Typography>
          <Link
            component="button"
            variant="body2"
            onClick={() => setRetryCount((c) => c + 1)}
          >
            Tentar novamente
          </Link>
        </Stack>
      )}

      {!loading && !error && !pageError && filtered.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Nenhum membro encontrado para este filtro.
        </Typography>
      )}

      {!loading && !error && !pageError && filtered.length > 0 && (
        <Grid container spacing={2}>
          {filtered.map((m) => (
            <Grid key={m.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <MemberCard
                member={m}
                donorInfo={donorMap.get(m.id)}
                isClubMember={clubMemberIds.has(m.id)}
                clubBusinessType={clubBusinessRoleByMemberId.get(m.id)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Paginação — só aparece quando há mais de uma página (total > 100) */}
      {!loading && !error && !pageError && totalPages > 1 && (
        <Stack spacing={1.5} sx={{ mt: 4, alignItems: "center" }}>
          <Typography variant="body2" color="text.secondary">
            {rangeLabel(page, MEMBERS_PAGE_SIZE, totalMembers)}
          </Typography>
          <PaginationControls
            page={page}
            totalPages={totalPages}
            onChange={setPage}
            itemLabel="membros"
          />
        </Stack>
      )}
    </>
  );
}

export default function MembersDirectoryIsland(): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <MembersDirectoryInner />
    </MuiIslandProvider>
  );
}
