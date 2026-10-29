import { useEffect, useState } from "react";
import { API_URL } from "../../lib/config";
import { COMMUNITY_KEY, fetchMe, RETURN_KEY } from "../../lib/auth-client";

// Paridade com o Docusaurus (src/pages/auth/callback.tsx): após o login o
// destino padrão é a Área do Membro.
const DEFAULT_RETURN = "/membro";

type Status = "processing" | "error";

/** Valida que o destino é um path relativo (anti open-redirect). */
function safeReturnPath(value: string | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes(":")
  ) {
    return DEFAULT_RETURN;
  }
  return value;
}

/** Lê o destino salvo, limpa as chaves de auth e valida (anti open-redirect). */
function consumeReturnPath(): string {
  const rawReturnTo = sessionStorage.getItem(RETURN_KEY);
  sessionStorage.removeItem(RETURN_KEY);
  sessionStorage.removeItem(COMMUNITY_KEY);
  return safeReturnPath(rawReturnTo);
}

export default function AuthCallback() {
  const [status, setStatus] = useState<Status>("processing");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const statusParam = params.get("status");

      if (statusParam === "error") {
        setStatus("error");
        return;
      }

      // Guarda: só executa o handoff do token quando vier de um redirect OAuth
      // real (o backend sempre inclui ?status=success). Acesso direto ou
      // refresh da página sem esse param cai no else (verifica sessão).
      if (statusParam !== "success") {
        const profile = await fetchMe(API_URL);
        if (profile) {
          window.location.replace(consumeReturnPath());
        } else {
          window.location.replace("/");
        }
        return;
      }

      // Token handoff efêmero: o backend coloca `#token=<JWT>` na URL de
      // redirect. O fragment não vai ao servidor — lemos no client e
      // trocamos em `/auth/finalize`, que seta o cookie httpOnly.
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const token = hash.get("token");

      // Limpa o fragment imediatamente — evita que um token stale seja
      // re-lido se o efeito re-executar ou se a página for recarregada.
      if (token) {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        );
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
      window.location.replace(consumeReturnPath());
    };
    void run();
  }, []);

  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      {status === "processing" ? (
        <output className="text-text-secondary">
          Finalizando autenticação com GitHub…
        </output>
      ) : (
        <>
          <h1 className="text-2xl font-extrabold text-text-primary">
            Não foi possível autenticar.
          </h1>
          <p className="mt-2 text-text-secondary">Tente novamente.</p>
          <a
            href="/"
            className="mt-4 inline-block font-bold text-link hover:text-link-hover"
          >
            ← Voltar para o início
          </a>
        </>
      )}
    </main>
  );
}
