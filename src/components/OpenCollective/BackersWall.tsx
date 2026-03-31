import React, { useEffect, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Link from "@docusaurus/Link";
import {
  OC_MEMBERS_API,
  OC_COLLECTIVE_URL,
  type OCMember,
} from "../../data/opencollective";

const FALLBACK_AVATAR = "https://opencollective.com/static/images/default-guest-logo.svg";

interface BackersWallProps {
  /** Max number of avatars to show before "+N mais" */
  limit?: number;
  /** Only show active (recurring) backers */
  activeOnly?: boolean;
  /** Avatar size in px */
  avatarSize?: number;
}

export default function BackersWall({
  limit = 24,
  activeOnly = false,
  avatarSize = 56,
}: BackersWallProps): React.JSX.Element {
  const [backers, setBackers] = useState<OCMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(OC_MEMBERS_API)
      .then((r) => r.json())
      .then((data: OCMember[]) => {
        const filtered = data
          .filter(
            (m) =>
              m.role === "BACKER" &&
              m.totalAmountDonated > 0 &&
              (!activeOnly || m.isActive)
          )
          .sort((a, b) => b.totalAmountDonated - a.totalAmountDonated);
        setBackers(filtered);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [activeOnly]);

  const visible = backers.slice(0, limit);
  const remaining = Math.max(0, backers.length - limit);
  const totalDonated = backers.reduce((s, m) => s + m.totalAmountDonated, 0);

  if (loading) {
    return (
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="circular"
            width={avatarSize}
            height={avatarSize}
          />
        ))}
      </Box>
    );
  }

  if (error || backers.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Não foi possível carregar os apoiadores. Veja em{" "}
        <Link href={OC_COLLECTIVE_URL}>opencollective.com/codaqui</Link>.
      </Typography>
    );
  }

  const formatted = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(totalDonated);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {backers.length} pessoas já contribuíram com{" "}
        <Box component="span" sx={{ fontWeight: 700, color: "primary.main" }}>
          {formatted}
        </Box>{" "}
        para a Codaqui.
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
        {visible.map((backer) => (
          <Tooltip
            key={backer.MemberId}
            title={
              <Box>
                <Typography variant="body2" fontWeight={700}>
                  {backer.name}
                </Typography>
                {backer.tier && (
                  <Typography variant="caption" display="block">
                    {backer.tier}
                  </Typography>
                )}
                <Typography variant="caption" color="success.light">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: backer.currency,
                  }).format(backer.totalAmountDonated)}{" "}
                  contribuídos
                </Typography>
              </Box>
            }
            arrow
          >
            <Avatar
              component="a"
              href={backer.profile}
              target="_blank"
              rel="noopener noreferrer"
              src={backer.image ?? FALLBACK_AVATAR}
              alt={backer.name}
              sx={{
                width: avatarSize,
                height: avatarSize,
                border: 2,
                borderColor: backer.isActive ? "primary.main" : "divider",
                cursor: "pointer",
                transition: "transform 0.15s ease, box-shadow 0.15s ease",
                "&:hover": {
                  transform: "scale(1.12)",
                  boxShadow: 3,
                  zIndex: 1,
                },
              }}
            />
          </Tooltip>
        ))}

        {remaining > 0 && (
          <Tooltip title={`+${remaining} apoiadores no OpenCollective`} arrow>
            <Avatar
              component="a"
              href={OC_COLLECTIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                width: avatarSize,
                height: avatarSize,
                bgcolor: "action.selected",
                color: "text.secondary",
                fontSize: "0.75rem",
                fontWeight: 700,
                border: 2,
                borderColor: "divider",
                cursor: "pointer",
                "&:hover": { bgcolor: "primary.main", color: "#fff" },
              }}
            >
              +{remaining}
            </Avatar>
          </Tooltip>
        )}
      </Box>

      <Typography variant="caption" color="text.disabled">
        🟢 Borda verde = apoio recorrente ativo &nbsp;·&nbsp;{" "}
        <Link href={OC_COLLECTIVE_URL}>Ver todos no OpenCollective →</Link>
      </Typography>
    </Box>
  );
}
