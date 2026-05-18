import React from "react";
import Box from "@mui/material/Box";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

export default function TabPanel({
  children,
  value,
  index,
}: TabPanelProps): React.JSX.Element {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`tab-panel-${index}`}
      aria-labelledby={`tab-${index}`}
      sx={{ width: "100%" }}
    >
      {value === index ? children : null}
    </Box>
  );
}
