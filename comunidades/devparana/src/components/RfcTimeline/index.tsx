import React from "react";
import {
  Box,
  Typography,
} from "@mui/material";
import community from "../../../community.config";

const accent = community.theme.primary;

export interface RfcTimelineItem {
  date: string;
  label: string;
}

export default function RfcTimeline({ items }: { readonly items: RfcTimelineItem[] }): React.JSX.Element {
  return (
    <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
      {items.map((item, index) => (
        <Box
          component="li"
          key={item.date + item.label}
          sx={{
            position: "relative",
            pl: 4,
            pb: index < items.length - 1 ? 3 : 0,
            "&::before": {
              content: '""',
              position: "absolute",
              left: 6,
              top: 8,
              bottom: index < items.length - 1 ? -8 : 0,
              width: 2,
              bgcolor: "divider",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              left: 0,
              top: 6,
              width: 14,
              height: 14,
              borderRadius: "50%",
              bgcolor: accent,
              border: 2,
              borderColor: "background.paper",
            },
          }}
        >
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: accent }}>
            {item.date}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {item.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
