import React, { useState, useEffect, useCallback } from "react";
import { Alert, Collapse, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

const CHECK_INTERVAL_MS = 60_000;
const TIMEOUT_MS = 8_000;

interface ApiHealthBannerProps {
  readonly apiUrl: string;
}

export default function ApiHealthBanner({
  apiUrl,
}: ApiHealthBannerProps): React.JSX.Element | null {
  const [isDown, setIsDown] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkHealth = useCallback(async () => {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(
      () => controller.abort(),
      TIMEOUT_MS,
    );
    try {
      const res = await fetch(apiUrl, { signal: controller.signal });

      if (!res.ok) {
        setIsDown(true);
        return;
      }
      const data = (await res.json()) as { status?: string };
      setIsDown(data.status !== "ok");
      if (data.status === "ok") setDismissed(false);
    } catch {
      setIsDown(true);
    } finally {
      globalThis.clearTimeout(timer);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (typeof globalThis.window === "undefined") return;

    checkHealth();
    const id = globalThis.setInterval(checkHealth, CHECK_INTERVAL_MS);
    return () => globalThis.clearInterval(id);
  }, [checkHealth]);

  if (!isDown || dismissed) return null;

  return (
    <Collapse in>
      <Alert
        severity="warning"
        variant="filled"
        sx={{
          borderRadius: 0,
          justifyContent: "center",
          "& .MuiAlert-message": { textAlign: "center", width: "100%" },
        }}
        action={
          <IconButton
            aria-label="fechar"
            color="inherit"
            size="small"
            onClick={() => setDismissed(true)}
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        }
      >
        Nossos servidores estão temporariamente indisponíveis. Algumas
        funcionalidades podem não funcionar corretamente.
      </Alert>
    </Collapse>
  );
}
