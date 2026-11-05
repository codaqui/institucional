import React, { useEffect, useRef, useState } from "react";

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const UNAVAILABLE_MESSAGE = "Verificação de segurança indisponível. Recarregue a página para tentar novamente.";

type TurnstileOptions = {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileOptions) => string;
      remove: (widgetId: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | undefined;

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.head.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    const script = existingScript ?? document.createElement("script");
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Turnstile script failed to load")), {
      once: true,
    });
    if (!existingScript) {
      script.src = SCRIPT_URL;
      script.setAttribute("async", "");
      script.setAttribute("defer", "");
      document.head.appendChild(script);
    }
  });
  return scriptPromise;
}

interface TurnstileFieldProps {
  onTokenChange: (token: string) => void;
}

export default function TurnstileField({
  onTokenChange,
}: Readonly<TurnstileFieldProps>): React.JSX.Element | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenChangeRef = useRef(onTokenChange);
  const [error, setError] = useState<string | null>(null);
  const siteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY?.trim();

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    if (!siteKey) {
      if (import.meta.env.DEV && import.meta.env.MODE !== "production") {
        onTokenChangeRef.current("development");
      }
      return;
    }
    let active = true;
    let widgetId: string | undefined;

    loadTurnstileScript()
      .then(() => {
        if (!active || !containerRef.current) return;
        if (!window.turnstile) {
          setError(UNAVAILABLE_MESSAGE);
          onTokenChangeRef.current("");
          return;
        }
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token) => {
            if (!active) return;
            setError(null);
            onTokenChangeRef.current(token);
          },
          "error-callback": () => {
            if (!active) return;
            setError("Não foi possível concluir a verificação de segurança. Tente novamente.");
            onTokenChangeRef.current("");
          },
          "expired-callback": () => {
            if (!active) return;
            setError("Verificação de segurança expirada. Complete o desafio novamente.");
            onTokenChangeRef.current("");
          },
        });
      })
      .catch(() => {
        if (!active) return;
        setError(UNAVAILABLE_MESSAGE);
        onTokenChangeRef.current("");
      });

    return () => {
      active = false;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey]);

  if (!siteKey) {
    if (import.meta.env.MODE === "production") return null;
    return <p role="alert">Turnstile não configurado. Defina PUBLIC_TURNSTILE_SITE_KEY.</p>;
  }

  return (
    <div>
      <div ref={containerRef} />
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
