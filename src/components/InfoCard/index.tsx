import React from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";

interface InfoCardProps {
  title: string;
  description: string;
  /** Optional icon rendered above the title */
  icon?: React.ReactNode;
  /** Border highlight color (MUI token, e.g. "primary.main") */
  borderColor?: string;
  children?: React.ReactNode;
}

export default function InfoCard({
  title,
  description,
  icon,
  borderColor,
  children,
}: Readonly<InfoCardProps>) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        transition: "all 0.2s ease",
        "&:hover": { boxShadow: 3, transform: "translateY(-2px)" },
        ...(borderColor ? { borderColor } : {}),
      }}
    >
      <CardContent>
        {icon && (
          <Typography component="span" sx={{ color: borderColor ?? "primary.main", mb: 1, display: "block" }}>
            {icon}
          </Typography>
        )}
        <Typography variant="h6" fontWeight={700} color={borderColor ?? "primary.main"} gutterBottom>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}
