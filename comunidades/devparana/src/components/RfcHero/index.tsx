import React from "react";
import {
  Avatar,
  Box,
  Card,
  Chip,
  Container,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import ForumIcon from "@mui/icons-material/Forum";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import community from "../../../community.config";
import { useCodaquiMembersBatch } from "../../hooks/useCodaquiMembers";
import type { RfcFrontmatter } from "../../data/rfc-schema";
import { displayAvatar, displayName, findMember } from "../../utils/rfc-members";

const accent = community.theme.primary;
const accentDark = community.theme.primaryDark;

interface RfcHeroProps {
  readonly frontmatter: RfcFrontmatter;
}

function AvatarSkeleton() {
  return <Skeleton variant="circular" width={40} height={40} />;
}

export default function RfcHero({ frontmatter }: RfcHeroProps): React.JSX.Element {
  const allPeople = [...frontmatter.authors, ...(frontmatter.approvers ?? [])];
  const batchHandles = allPeople
    .map((p) => p.githubHandle?.trim())
    .filter((h): h is string => Boolean(h));

  const { members, loading } = useCodaquiMembersBatch(batchHandles);

  const [primaryAuthor] = frontmatter.authors;
  const authorMember = primaryAuthor ? findMember(primaryAuthor, members) : undefined;
  const approvers = frontmatter.approvers ?? [];

  return (
    <Box
      sx={{
        bgcolor: (t) => (t.palette.mode === "dark" ? accentDark : accent),
        color: "#fff",
        py: { xs: 6, md: 8 },
        mb: { xs: 4, md: 6 },
      }}
    >
      <Container maxWidth="xl">
        <Card
          elevation={0}
          sx={{
            bgcolor: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(8px)",
            border: "1px solid",
            borderColor: "rgba(255,255,255,0.2)",
            borderRadius: 3,
            p: { xs: 3, md: 5 },
            color: "#fff",
          }}
        >
          <Grid container spacing={{ xs: 3, md: 5 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Stack spacing={3}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip
                    icon={<ForumIcon sx={{ color: "#fff !important" }} />}
                    label={`RFC ${frontmatter.rfcId}`}
                    sx={{ bgcolor: "rgba(255,255,255,0.18)", color: "#fff", fontWeight: 700 }}
                  />
                  <Chip
                    icon={<CheckCircleIcon sx={{ color: "#fff !important" }} />}
                    label={frontmatter.status}
                    sx={{ bgcolor: "rgba(255,255,255,0.18)", color: "#fff", fontWeight: 700 }}
                  />
                </Stack>

                <Typography variant="h2" component="h1" fontWeight={800}>
                  {frontmatter.title}
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.95, fontWeight: 400 }}>
                  {frontmatter.summary}
                </Typography>

                {primaryAuthor && (
                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                    {loading ? (
                      <AvatarSkeleton />
                    ) : (
                      <Avatar
                        src={displayAvatar(primaryAuthor, authorMember)}
                        alt={displayName(primaryAuthor, authorMember)}
                        sx={{ width: 48, height: 48, border: "2px solid rgba(255,255,255,0.4)" }}
                      />
                    )}
                    <Box>
                      <Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
                        Autor{frontmatter.authors.length > 1 ? "es" : ""}
                      </Typography>
                      <Typography fontWeight={700}>
                        {frontmatter.authors.map((a) => displayName(a, findMember(a, members))).join(", ")}
                      </Typography>
                    </Box>
                  </Stack>
                )}

                <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
                  {frontmatter.writtenAt && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CalendarTodayIcon fontSize="small" sx={{ opacity: 0.8 }} />
                      <Typography variant="body2">
                        <strong>Escrita:</strong> {frontmatter.writtenAt}
                      </Typography>
                    </Stack>
                  )}
                  {frontmatter.publishedAt && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CalendarTodayIcon fontSize="small" sx={{ opacity: 0.8 }} />
                      <Typography variant="body2">
                        <strong>Publicação:</strong> {frontmatter.publishedAt}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Stack>
            </Grid>

            {approvers.length > 0 && (
              <Grid size={{ xs: 12, md: 4 }}>
                <Box
                  sx={{
                    bgcolor: "rgba(0,0,0,0.15)",
                    borderRadius: 2,
                    p: 3,
                    height: "100%",
                  }}
                >
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                    Aprovadores
                  </Typography>
                  <Stack spacing={2}>
                    {approvers.map((ref, index) => {
                      const key = ref.email ?? ref.githubHandle ?? ref.name ?? String(index);
                      const member = loading ? undefined : findMember(ref, members);
                      return (
                        <Stack key={key} direction="row" spacing={1.5} alignItems="center">
                          {loading ? (
                            <AvatarSkeleton />
                          ) : (
                            <Avatar
                              src={displayAvatar(ref, member)}
                              alt={displayName(ref, member)}
                              sx={{ width: 32, height: 32 }}
                            />
                          )}
                          <Typography variant="body2" fontWeight={500}>
                            {displayName(ref, member)}
                          </Typography>
                        </Stack>
                      );
                    })}
                  </Stack>
                </Box>
              </Grid>
            )}
          </Grid>
        </Card>
      </Container>
    </Box>
  );
}
