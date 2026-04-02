import React, { useEffect, useState } from "react";
import Layout from "@theme/Layout";
import { useHistory } from "@docusaurus/router";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import { useAuth } from "../../hooks/useAuth";

export default function AuthCallback(): React.JSX.Element {
  const { refreshUser } = useAuth();
  const history = useHistory();
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(globalThis.location.search);
    const status = params.get("status");

    if (status === "error") {
      setError(true);
      return;
    }

    // Hidrata o estado lendo o cookie httpOnly via GET /auth/me
    refreshUser().then((profile) => {
      if (profile) {
        const returnTo = sessionStorage.getItem("codaqui_auth_return") ?? "/membro";
        sessionStorage.removeItem("codaqui_auth_return");
        history.replace(returnTo);
      } else {
        setError(true);
      }
    });
  }, [refreshUser, history]);

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
              href="/"
              variant="body2"
              color="primary"
              sx={{ fontWeight: 600 }}
            >
              ← Voltar para o início
            </Typography>
          </>
        ) : (
          <>
            <CircularProgress color="primary" size={48} />
            <Typography variant="h6" color="text.secondary">
              Finalizando autenticação com GitHub…
            </Typography>
          </>
        )}
      </Box>
    </Layout>
  );
}
