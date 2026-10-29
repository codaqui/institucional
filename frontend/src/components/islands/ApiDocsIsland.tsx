// Documentação interativa da API — página /desenvolvedores/api.
//
// O Swagger UI embarcado carrega o spec OpenAPI AO VIVO do backend em runtime
// (`<api>/docs-json`): em codaqui.dev o fetch resolve para api.codaqui.dev
// (CORS whitelist cobre o domínio; o spec é público) e em builds tenant o
// proxy same-origin da Pages Function entrega /docs-json (allow-list em
// src/lib/api-proxy-paths.ts).
//
// Try-it fica ATIVO de propósito: as chamadas de teste partem do swagger-client
// direto para a API. Endpoints 🔒 pedem JWT Bearer (botão Authorize — token
// obtido via login GitHub em /auth/github). O CORS do backend
// (credentials: true + whitelist) cobre codaqui.dev e os domínios dos tenants,
// então o cookie httpOnly também viaja quando aplicável.
//
// O bundle do Swagger UI (~1,7MB) entra por dynamic import — fora do chunk
// inicial e só baixado nesta rota (code-splitting da ilha client:only).
import React, { useEffect, useRef, useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import MuiIslandProvider from "./MuiIslandProvider";
import { resolveApiUrl } from "../../lib/api-url";
import "swagger-ui-dist/swagger-ui.css";

const DOCS_CONTAINER_ID = "cq-api-docs";

type LoadStatus = "loading" | "error" | "ready";

function ApiDocsInner(): React.JSX.Element {
  const specUrl = `${resolveApiUrl(import.meta.env.SITE)}/docs-json`;
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(specUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const spec = await res.json();
        const mod = await import("swagger-ui-dist/swagger-ui-es-bundle.js");
        if (cancelled || !containerRef.current) return;
        // Limpa o container para re-mount seguro no retry (o Swagger UI não
        // é um componente React — ele renderiza imperativamente no DOM).
        containerRef.current.innerHTML = "";
        mod.default({
          spec,
          dom_id: `#${DOCS_CONTAINER_ID}`,
          deepLinking: true,
          persistAuthorization: true,
        });
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [specUrl, reloadToken]);

  if (status === "error") {
    return (
      <Alert
        severity="warning"
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              setStatus("loading");
              setReloadToken((t) => t + 1);
            }}
          >
            Tentar novamente
          </Button>
        }
      >
        Documentação indisponível no momento. Você também pode abrir o{" "}
        <Box
          component="a"
          href={specUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: "inherit", fontWeight: 700 }}
        >
          OpenAPI JSON direto
        </Box>
        .
      </Alert>
    );
  }

  return (
    <Box>
      {status === "loading" && (
        <Skeleton
          variant="rectangular"
          height={520}
          aria-label="Carregando documentação da API"
        />
      )}
      <div ref={containerRef} id={DOCS_CONTAINER_ID} data-testid="api-docs-container" />
    </Box>
  );
}

export default function ApiDocsIsland(): React.JSX.Element {
  return (
    <MuiIslandProvider>
      <ApiDocsInner />
    </MuiIslandProvider>
  );
}
