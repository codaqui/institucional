/**
 * Port de `src/components/TabPanel` (Docusaurus) — conteúdo de aba MUI,
 * só monta children quando o painel está ativo.
 */
import type { ReactNode } from "react";
import Box from "@mui/material/Box";

interface TabPanelProps {
  children?: ReactNode;
  index: number;
  value: number;
}

export default function TabPanel({
  children,
  value,
  index,
}: Readonly<TabPanelProps>): React.JSX.Element {
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
