import React, { useEffect, useState } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import GitHubIcon from "@mui/icons-material/GitHub";
import LinkedInIcon from "@mui/icons-material/LinkedIn";

interface Member {
  id: string;
  githubHandle: string;
  name: string;
  avatarUrl: string;
  bio: string | null;
  linkedinUrl: string | null;
  role: "membro" | "admin";
  joinedAt: string;
}

interface MembersWallProps {
  readonly limit?: number;
}

export default function MembersWall({ limit }: MembersWallProps): React.JSX.Element {
  const { siteConfig } = useDocusaurusContext();
  const apiUrl = (siteConfig.customFields?.apiUrl as string) ?? "http://api.localhost:8000";

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${apiUrl}/members`)
      .then((r) => r.json())
      .then((data: Member[]) => {
        setMembers(limit ? data.slice(0, limit) : data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [apiUrl, limit]);

  if (loading) {
    const skeletonKeys = Array.from({ length: 6 }, (_, i) => `member-sk-${i}`);
    return (
      <Grid container spacing={2}>
        {skeletonKeys.map((sKey) => (
          <Grid key={sKey} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined">
              <CardContent sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <Skeleton variant="circular" width={56} height={56} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton width="60%" />
                  <Skeleton width="40%" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  if (error || members.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {error
          ? "Não foi possível carregar os apoiadores no momento."
          : "Nenhum apoiador cadastrado ainda."}
      </Typography>
    );
  }

  return (
    <Grid container spacing={2}>
      {members.map((m) => (
        <Grid key={m.id} size={{ xs: 12, sm: 6, md: 4 }}>
          <Card
            variant="outlined"
            sx={{
              height: "100%",
              "&:hover": { boxShadow: 3, transform: "translateY(-2px)", transition: "all 0.2s ease" },
            }}
          >
            <CardContent sx={{ display: "flex", gap: 2 }}>
              <Avatar
                src={m.avatarUrl}
                alt={m.name}
                sx={{ width: 56, height: 56, flexShrink: 0 }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="subtitle1" fontWeight={700} noWrap>
                    {m.name}
                  </Typography>
                  {m.role === "admin" && (
                    <Chip label="Organização" size="small" color="primary" variant="outlined" />
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                  @{m.githubHandle}
                </Typography>
                {m.bio && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {m.bio}
                  </Typography>
                )}
                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                  <Tooltip title={`GitHub: ${m.githubHandle}`}>
                    <Link
                      href={`https://github.com/${m.githubHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      color="inherit"
                    >
                      <GitHubIcon sx={{ fontSize: "1.1rem", opacity: 0.7 }} />
                    </Link>
                  </Tooltip>
                  {m.linkedinUrl && (
                    <Tooltip title="LinkedIn">
                      <Link
                        href={m.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        color="inherit"
                      >
                        <LinkedInIcon sx={{ fontSize: "1.1rem", opacity: 0.7, color: "#0077b5" }} />
                      </Link>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
