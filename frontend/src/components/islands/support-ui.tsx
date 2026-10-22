/**
 * Port de `src/components/SupportCheckoutUi` (Docusaurus) — helpers visuais
 * compartilhados entre DonationFlowIsland e CompanyDonationIsland.
 */
import type { ReactNode } from "react";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import type { SxProps, Theme } from "@mui/material/styles";

interface IdentityHandleChipProps {
  user: {
    avatarUrl: string;
    name: string;
    handle: string;
  };
  labelPrefix?: string;
  color?: "default" | "primary" | "secondary" | "success" | "error" | "info" | "warning";
  variant?: "filled" | "outlined";
  sx?: SxProps<Theme>;
}

export function IdentityHandleChip({
  user,
  labelPrefix = "Doando como",
  color = "primary",
  variant = "outlined",
  sx,
}: Readonly<IdentityHandleChipProps>) {
  return (
    <Chip
      avatar={
        <Avatar
          src={user.avatarUrl}
          alt={user.name}
          sx={{ width: "22px !important", height: "22px !important" }}
        />
      }
      label={`${labelPrefix} @${user.handle}`}
      variant={variant}
      color={color}
      sx={sx}
    />
  );
}

interface SupportPrimaryButtonProps {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  startIcon?: ReactNode;
  accentColor?: string;
  accentColorDark?: string;
}

export function SupportPrimaryButton({
  label,
  loading = false,
  disabled = false,
  onClick,
  startIcon,
  accentColor,
  accentColorDark,
}: Readonly<SupportPrimaryButtonProps>) {
  return (
    <Button
      variant="contained"
      size="large"
      fullWidth
      disabled={disabled || loading}
      onClick={onClick}
      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : startIcon}
      sx={{
        py: 1.5,
        fontWeight: 700,
        fontSize: "1rem",
        textTransform: "none",
        ...(accentColor && {
          bgcolor: accentColor,
          "&:hover": { bgcolor: accentColorDark ?? accentColor },
        }),
      }}
    >
      {label}
    </Button>
  );
}
