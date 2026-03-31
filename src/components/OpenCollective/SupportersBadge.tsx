import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import GroupsIcon from "@mui/icons-material/Groups";
import Link from "@docusaurus/Link";
import { OC_MEMBERS_API, OC_COLLECTIVE_URL, type OCMember } from "../../data/opencollective";

/**
 * Compact social-proof badge showing backer count.
 * Intended for placement in hero sections or feature highlights.
 * Non-intrusive: shows the community, not a donation request.
 */
export default function SupportersBadge(): React.JSX.Element {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(OC_MEMBERS_API)
      .then((r) => r.json())
      .then((data: OCMember[]) => {
        const backers = data.filter(
          (m) => m.role === "BACKER" && m.totalAmountDonated > 0
        );
        setCount(backers.length);
      })
      .catch(() => setCount(null));
  }, []);

  if (count === null) {
    return <Skeleton variant="rounded" width={180} height={28} />;
  }

  return (
    <Link
      href={OC_COLLECTIVE_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: "none" }}
    >
      <Box
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          px: 1.5,
          py: 0.75,
          borderRadius: 99,
          border: "1px solid",
          borderColor: "primary.main",
          color: "primary.main",
          bgcolor: "transparent",
          fontSize: "0.8rem",
          fontWeight: 600,
          cursor: "pointer",
          transition: "background-color 0.15s ease",
          "&:hover": {
            bgcolor: "primary.main",
            color: "#fff",
          },
        }}
      >
        <GroupsIcon sx={{ fontSize: "1rem" }} />
        <Typography component="span" variant="caption" fontWeight={700}>
          {count} apoiadores
        </Typography>
      </Box>
    </Link>
  );
}
