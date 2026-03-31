import React from "react";
import Button from "@mui/material/Button";
import FavoriteIcon from "@mui/icons-material/Favorite";
import { OC_DONATE_URL } from "../../data/opencollective";

interface DonateButtonProps {
  /** Button label — default is "Apoiar a Codaqui" */
  label?: string;
  /** MUI button variant */
  variant?: "contained" | "outlined" | "text";
  /** Full width */
  fullWidth?: boolean;
  size?: "small" | "medium" | "large";
  /** Override the default OC donate URL */
  href?: string;
}

export default function DonateButton({
  label = "Apoiar a Codaqui",
  variant = "contained",
  fullWidth = false,
  size = "medium",
  href = OC_DONATE_URL,
}: DonateButtonProps): React.JSX.Element {
  return (
    <Button
      variant={variant}
      color="primary"
      size={size}
      fullWidth={fullWidth}
      startIcon={<FavoriteIcon />}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        fontWeight: 700,
        borderRadius: 2,
        ...(variant === "contained" && {
          "&:hover": {
            transform: "translateY(-1px)",
            boxShadow: 4,
          },
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }),
      }}
    >
      {label}
    </Button>
  );
}
