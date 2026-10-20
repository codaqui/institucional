import { useEffect, useState } from "react";
import { API_URL } from "../../lib/config";
import { fetchMe, RETURN_KEY } from "../../lib/auth-client";

const DEFAULT_RETURN = "/"; // /membro só nasce na 0.4 — na POC volta para a home

type Status = "processing" | "error";

/** Valida que o destino é um path relativo (anti open-redirect). */
function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_RETURN;
  }
  return value;
}

export default function AuthCallback() {
  const [status, setStatus] = useState<Status>("processing");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("status") === "error") {
        setStatus("error");
        return;
      }

      if (params.get("status") === "success") {
        // Handoff efêmero: JWT no fragment, trocado pelo cookie httpOnly.
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const token = hash.get("token");
        window.history.replaceState(null, "", window.location.pathname);
        if (!token) {
          setStatus("error");
          return;
        }
        try {
          const res = await fetch(`${API_URL}/auth/finalize`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          if (!res.ok) {
            setStatus("error");
            return;
          }
        } catch {
          setStatus("error");
          return;
        }
      }

      const me = await fetchMe(API_URL);
      if (!me) {
        setStatus("error");
        return;
      }
      window.location.replace(safeReturnPath(sessionStorage.getItem(RETURN_KEY)));
    };
    run();
  }, []);

  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      {status === "processing" ? (
        <p className="text-text-secondary">Finalizando seu login…</p>
      ) : (
        <>
          <h1 className="text-2xl font-extrabold text-text-primary">Não foi possível entrar</h1>
          <p className="mt-2 text-text-secondary">
            Ocorreu um problema na autenticação. Tente novamente.
          </p>
          <a href="/" className="mt-4 inline-block font-bold text-link hover:text-link-hover">
            Voltar para o início
          </a>
        </>
      )}
    </main>
  );
}
