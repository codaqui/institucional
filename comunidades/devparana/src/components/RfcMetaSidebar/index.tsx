import React from "react";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import community from "../../../community.config";
import { useCodaquiMembersBatch } from "../../hooks/useCodaquiMembers";
import type { RfcFrontmatter } from "../../data/rfc-schema";
import type { RfcRegion } from "../RfcRegionCard";
import { displayAvatar, displayName, findMember } from "../../utils/rfc-members";

const accent = community.theme.primary;

interface RfcMetaSidebarProps {
  readonly frontmatter: RfcFrontmatter;
  readonly regions?: RfcRegion[];
}

export default function RfcMetaSidebar({ frontmatter, regions }: RfcMetaSidebarProps): React.JSX.Element {
  const allPeople = [...frontmatter.authors, ...(frontmatter.approvers ?? [])];
  const batchHandles = allPeople
    .map((p) => p.githubHandle?.trim())
    .filter((h): h is string => Boolean(h));
  const batchEmails = allPeople
    .map((p) => p.email?.trim())
    .filter((e): e is string => Boolean(e));

  const { members, loading } = useCodaquiMembersBatch(batchHandles, batchEmails);
  const [primaryAuthor] = frontmatter.authors;
  const authorMember = primaryAuthor ? findMember(primaryAuthor, members) : undefined;

  return (
    <Card
      variant="outlined"
      sx={{
        position: { md: "sticky" },
        top: { md: 24 },
        borderRadius: 2,
      }}
    >
      <CardContent>
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" fontWeight={700} color="text.secondary">
              Status
            </Typography>
            <Chip
              icon={<CheckCircleIcon />}
              label={frontmatter.status}
              color={frontmatter.status === "Ready" ? "success" : "default"}
              size="small"
              sx={{ mt: 0.5, fontWeight: 600 }}
            />
          </Box>

          {primaryAuthor && (
            <Box>
              <Typography variant="overline" fontWeight={700} color="text.secondary">
                Autor{frontmatter.authors.length > 1 ? "es" : ""}
              </Typography>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 0.5 }}>
                {loading ? (
                  <Skeleton variant="circular" width={36} height={36} />
                ) : (
                  <Avatar
                    src={displayAvatar(primaryAuthor, authorMember)}
                    alt={displayName(primaryAuthor, authorMember)}
                    sx={{ width: 36, height: 36 }}
                  />
                )}
                <Typography variant="body2" fontWeight={600}>
                  {frontmatter.authors.map((a) => displayName(a, findMember(a, members))).join(", ")}
                </Typography>
              </Stack>
            </Box>
          )}

          {(frontmatter.writtenAt || frontmatter.publishedAt) && (
            <Box>
              <Typography variant="overline" fontWeight={700} color="text.secondary">
                Datas
              </Typography>
              <Stack spacing={1} sx={{ mt: 0.5 }}>
                {frontmatter.writtenAt && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CalendarTodayIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      <strong>Escrita:</strong> {frontmatter.writtenAt}
                    </Typography>
                  </Stack>
                )}
                {frontmatter.publishedAt && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CalendarTodayIcon fontSize="small" color="action" />
                    <Typography variant="body2">
                      <strong>Publicação:</strong> {frontmatter.publishedAt}
                    </Typography>
                  </Stack>
                )}
              </Stack>
            </Box>
          )}

          {frontmatter.timeline && frontmatter.timeline.length > 0 && (
            <Box>
              <Typography variant="overline" fontWeight={700} color="text.secondary">
                Marcos
              </Typography>
              <Stack spacing={1} sx={{ mt: 0.5 }}>
                {frontmatter.timeline.map((item) => (
                  <Stack key={item.label + item.date} direction="row" spacing={1} alignItems="flex-start">
                    <CalendarTodayIcon fontSize="small" color="action" sx={{ mt: 0.3 }} />
                    <Typography variant="body2">
                      <strong>{item.date}:</strong> {item.label}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          )}

          {regions && regions.length > 0 && (
            <Box>
              <Typography variant="overline" fontWeight={700} color="text.secondary">
                Regiões
              </Typography>
              <Stack spacing={1.5} sx={{ mt: 0.5 }}>
                {regions.map((region) => (
                  <Box key={region.name}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ color: accent }}>
                      <PlaceOutlinedIcon fontSize="small" />
                      <Typography variant="body2" fontWeight={700}>
                        {region.name}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {region.cities.join(", ")}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
