import React from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

interface SelectableCardProps {
  selected: boolean;
  onClick: () => void;
  /** Primary label */
  primary: string;
  /** Optional secondary text */
  secondary?: string;
  /** Avatar src or emoji to show */
  avatar?: string;
  /** Fallback content inside Avatar (emoji, initials) */
  avatarFallback?: React.ReactNode;
  /** Optional badge/chip rendered at top-right */
  badge?: React.ReactNode;
  /** Compact padding for dense layouts */
  compact?: boolean;
  /** Custom avatar size (default: 40, compact: 34) */
  avatarSize?: number;
  children?: React.ReactNode;
}

export default function SelectableCard({
  selected,
  onClick,
  primary,
  secondary,
  avatar,
  avatarFallback,
  badge,
  compact = false,
  avatarSize,
  children,
}: Readonly<SelectableCardProps>) {
  const size = avatarSize ?? (compact ? 34 : 40);
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderColor: selected ? "primary.main" : "divider",
        borderWidth: selected ? 2 : 1,
        transition: "all 0.2s ease",
        "&:hover": { boxShadow: 3, borderColor: "primary.light" },
        position: "relative",
      }}
    >
      <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
        <CardContent
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            ...(compact && { py: "10px !important", px: "14px !important" }),
          }}
        >
          {(avatar || avatarFallback) && (
            <Avatar
              src={avatar}
              alt={primary}
              sx={{ width: size, height: size, fontSize: compact ? "1.1rem" : "1.25rem", flexShrink: 0 }}
            >
              {avatarFallback}
            </Avatar>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>
              {primary}
            </Typography>
            {secondary && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {secondary}
              </Typography>
            )}
          </Box>
          {selected && <CheckCircleIcon color="primary" sx={{ flexShrink: 0, fontSize: compact ? "1.1rem" : undefined }} />}
          {children}
        </CardContent>
      </CardActionArea>
      {badge && (
        <Box sx={{ position: "absolute", top: 6, right: 6 }}>
          {badge}
        </Box>
      )}
    </Card>
  );
}
