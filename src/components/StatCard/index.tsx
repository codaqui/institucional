import React from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

interface StatCardProps {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  color?: string;
  /** "outlined" uses MUI Card with hover shadow; "filled" uses Paper with action.hover bg */
  variant?: "outlined" | "filled";
}

export default function StatCard({
  icon,
  value,
  label,
  color = "primary.main",
  variant = "outlined",
}: Readonly<StatCardProps>) {
  if (variant === "filled") {
    return (
      <Paper
        elevation={0}
        sx={{ textAlign: "center", py: 2.5, px: 1, bgcolor: "action.hover", borderRadius: 2 }}
      >
        <Box sx={{ color, mb: 0.5 }}>{icon}</Box>
        <Typography
          variant="h5"
          fontWeight={800}
          color={color}
          sx={{ fontSize: { xs: "1.1rem", sm: "1.25rem", md: "1.4rem" }, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Paper>
    );
  }

  return (
    <Card
      variant="outlined"
      sx={{
        textAlign: "center",
        p: { xs: 2, md: 3 },
        transition: "box-shadow 0.2s",
        "&:hover": { boxShadow: 4 },
      }}
    >
      <Box sx={{ color, mb: 1 }}>{icon}</Box>
      <Typography
        variant="h4"
        fontWeight={800}
        color={color}
        sx={{
          lineHeight: 1.2,
          fontSize: { xs: "1.25rem", sm: "1.5rem", md: "1.75rem", lg: "2rem" },
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {label}
      </Typography>
    </Card>
  );
}
