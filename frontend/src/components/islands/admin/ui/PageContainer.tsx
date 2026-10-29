/**
 * Port de `src/components/AdminPageContainer` (Docusaurus) — wrapper padrão
 * das páginas do painel admin.
 */
import type { ReactNode } from "react";
import Container from "@mui/material/Container";
import type { SxProps, Theme } from "@mui/material/styles";

interface PageContainerProps {
  children: ReactNode;
  sx?: SxProps<Theme>;
}

export default function PageContainer({
  children,
  sx,
}: Readonly<PageContainerProps>): React.JSX.Element {
  return (
    <Container maxWidth="lg" sx={{ py: 6, ...(sx ? { ...sx } : {}) }}>
      {children}
    </Container>
  );
}
