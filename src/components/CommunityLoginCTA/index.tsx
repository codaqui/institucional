import React from "react";
import { useLocation } from "@docusaurus/router";
import { Alert, Button } from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import { useAuth } from "@site/src/hooks/useAuth";
import { resolveCommunityFromPath } from "@site/src/lib/community-context";

interface CommunityLoginCTAProps {
  /** Mensagem principal. Default explica retorno automático. */
  message?: string;
  /** Cor do botão (primary/accent). */
  accentColor?: string;
  /** Cor de hover do botão. */
  accentColorDark?: string;
}

/**
 * Banner de login contextual para páginas de comunidade.
 *
 * Usado em `/comunidades/<slug>/apoiar` para convidar usuários deslogados
 * a entrarem com GitHub **sem sair do contexto** — o fluxo OAuth salva a
 * página atual no sessionStorage e retorna após a autenticação.
 */
export default function CommunityLoginCTA({
  message = "Entre com GitHub para doar identificado. Você será redirecionado de volta para esta página.",
  accentColor,
  accentColorDark,
}: CommunityLoginCTAProps): React.JSX.Element | null {
  const { pathname } = useLocation();
  const { isLoggedIn, ready, login } = useAuth();
  const community = resolveCommunityFromPath(pathname);

  if (!ready || isLoggedIn || !community) return null;

  return (
    <Alert
      severity="info"
      icon={<GitHubIcon />}
      sx={{ mb: 3 }}
      action={
        <Button
          size="small"
          variant="contained"
          startIcon={<GitHubIcon />}
          onClick={() =>
            login({
              returnTo: pathname,
              communitySlug: community.slug,
            })
          }
          sx={{
            textTransform: "none",
            fontWeight: 700,
            ...(accentColor && {
              bgcolor: accentColor,
              "&:hover": { bgcolor: accentColorDark ?? accentColor },
            }),
          }}
        >
          Entrar
        </Button>
      }
    >
      {message}
    </Alert>
  );
}
