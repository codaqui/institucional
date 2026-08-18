import React from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from "@mui/material";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import community from "../../../community.config";

const accent = community.theme.primary;

export interface RfcRegion {
  name: string;
  cities: string[];
}

export default function RfcRegionCard({ region }: { readonly region: RfcRegion }): React.JSX.Element {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        transition: "all 0.2s",
        "&:hover": { transform: "translateY(-2px)", boxShadow: 3, borderColor: accent },
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, color: accent }}>
          <PlaceOutlinedIcon fontSize="small" />
          <Typography variant="h6" fontWeight={700}>
            {region.name}
          </Typography>
        </Stack>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
          {region.cities.map((city) => (
            <Chip key={city} label={city} size="small" variant="outlined" />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}
