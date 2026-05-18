import React from "react";
import Container from "@mui/material/Container";
import { SxProps, Theme } from "@mui/material/styles";

interface AdminPageContainerProps {
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

export default function AdminPageContainer({
  children,
  sx,
}: Readonly<AdminPageContainerProps>): React.JSX.Element {
  return (
    <Container maxWidth="lg" sx={{ py: 6, ...(sx ? { ...sx } : {}) }}>
      {children}
    </Container>
  );
}
