import React, { useEffect, useMemo, useState } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { useAuth } from "../../hooks/useAuth";
import { resolveCommunityFromPath } from "../../lib/community-context";
import { resolveApiUrl } from "../../lib/api-url";

export default function AuthCallback(): React.JSX.Element {
  const { refreshUser } = useAuth();
  const { siteConfig } = useDocusaurusContext();
  const history = useHistory();
  const [error, setError] = useState(false);

  // Resolve community from the saved return-to path so we can render branded UI
  // during the OAuth round-trip (logo + theme color + name).
  const community = useMemo(() => {
    if (globalThis.window === undefined) return null;
    const returnTo =
      sessionStorage.getItem("codaqui_auth_return") ??
      sessionStorage.getItem("codaqui_auth_logout_return") ??
      "";
    return resolveCommunityFromPath(returnTo);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(globalThis.location.search);
    const status = params.get("status");

    if (status === "error") {
      setError(true);
      return;
    }

    // Token handoff via fragment: o backend coloca `#token=<JWT>` na URL
    // de redirect. O fragment não vai ao servidor — lemos no client e
    // POSTamos para `/auth/finalize`, que (por passar pelo Worker em deploys
    // whitelabel) seta o cookie httpOnly no domínio correto.
    const hash = globalThis.location.hash.startsWith("#")
      ? globalThis.location.hash.slice(1)
      : "";
    const hashParams = new URLSearchParams(hash);
    const handoffToken = hashParams.get("token");

    const finalize = async () => {
      if (handoffToken) {
        try {
          const configuredApiUrl =
            (siteConfig.customFields?.apiUrl as string) ??
            "http://localhost:3001";
          const apiUrl = resolveApiUrl(configuredApiUrl, siteConfig.url);
          const res = await fetch(`${apiUrl}/auth/finalize`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: handoffToken }),
          });
          if (!res.ok) {
            setError(true);
            return;
          }
          // Limpa o fragment para não persistir o token no histórico do browser.
          globalThis.history.replaceState(
            null,
            "",
            globalThis.location.pathname + globalThis.location.search,
          );
        } catch {
          setError(true);
          return;
        }
      }

      const profile = await refreshUser();
      if (profile) {
        const rawReturnTo =
          sessionStorage.getItem("codaqui_auth_return") ?? "/membro";
        sessionStorage.removeItem("codaqui_auth_return");
        sessionStorage.removeItem("codaqui_auth_community");
        const isRelativePath =
          rawReturnTo.startsWith("/") &&
          !rawReturnTo.startsWith("//") &&
          !rawReturnTo.includes(":");
        const returnTo = isRelativePath ? rawReturnTo : "/membro";
        history.replace(returnTo);
      } else {
        setError(true);
      }
    };

    finalize();
  }, [refreshUser, history, siteConfig.customFields, siteConfig.url]);

  const accent = community?.theme.primary ?? undefined;
  const finalizingLabel = community
    ? `Finalizando autenticação na ${community.shortName}…`
    : "Finalizando autenticação com GitHub…";

  return (
    <Layout title="Autenticando..." noFooter>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 3,
        }}
      >
        {error ? (
          <>
            <Alert severity="error" sx={{ maxWidth: 420, textAlign: "center" }}>
              Não foi possível autenticar. Tente novamente.
            </Alert>
            <Typography
              component="a"
              href={community?.basePath ?? "/"}
              variant="body2"
              color="primary"
              sx={{ fontWeight: 600 }}
            >
              ← Voltar para {community ? community.shortName : "o início"}
            </Typography>
          </>
        ) : (
          <>
            {community && (
              <Box
                component="img"
                src={community.logoUrl}
                alt={community.name}
                sx={{ height: 56, mb: 1 }}
              />
            )}
            <CircularProgress
              size={48}
              sx={accent ? { color: accent } : undefined}
              color={accent ? undefined : "primary"}
            />
            <Typography variant="h6" color="text.secondary">
              {finalizingLabel}
            </Typography>
          </>
        )}
      </Box>
    </Layout>
  );
}
